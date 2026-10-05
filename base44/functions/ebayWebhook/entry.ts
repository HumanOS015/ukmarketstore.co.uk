import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import {
  getEbayConfig, verifyEbaySignature, challengeResponse, getEbayOrder, getValidAccessToken
} from "../../shared/ebay.ts";
import { protectFromExternalSale } from "../../shared/inventory.ts";

// Canonical eBay notification endpoint. This is the exact URL registered with
// eBay and used for BOTH challenge-response paths (GET ?challenge_code and POST
// body {challengeCode}). Kept as a single source of truth so a misconfigured
// EBAY_NOTIFICATION_ENDPOINT secret can never make the POST-body challenge
// compute a different challengeResponse than the GET challenge.
const EBAY_WEBHOOK_ENDPOINT = "https://ukmarketstore.base44.app/functions/ebayWebhook";

// eBay notification webhook (official eBay Notification API).
// 1) Answers the eBay endpoint challenge during destination verification.
// 2) Validates the x-ebay-signature (ECDSA, public key fetched by kid).
// 3) For a confirmed sale, locates the exact UKMS mapping, verifies the seller
//    matches, and calls the Stage 1 protection engine (idempotent).
// Never trusts an unsigned or malformed notification. Never guesses a match.
export default async function(req) {
  try {
    // --- eBay Marketplace Account Deletion endpoint challenge (GET) ---
    // eBay verifies the destination with:
    //   GET https://ukmarketstore.base44.app/functions/ebayWebhook?challenge_code=<code>
    // Response: 200 application/json
    //   { "challengeResponse": "<lowercase hex SHA-256>" }
    // where challengeResponse = SHA-256(challengeCode + verificationToken + endpoint)
    // and endpoint is EXACTLY https://ukmarketstore.base44.app/functions/ebayWebhook
    // (no query string, no trailing slash, no other hostname). The verification
    // token is never exposed or logged. This branch is independent of the full
    // eBay OAuth config so the challenge works even before RuName/OAuth setup.
    const challengeUrl = new URL(req.url, "https://ukmarketstore.base44.app");
    const challengeCode = challengeUrl.searchParams.get("challenge_code");
    if (req.method === "GET" && challengeCode) {
      const verificationToken = secrets.get("EBAY_NOTIFICATION_VERIFICATION_TOKEN");
      if (!verificationToken) {
        // Secret missing — do not invent or generate a token. Stop safely.
        return Response.json({ error: "verification_token_not_configured" }, { status: 503 });
      }
      const challengeResponseValue = await challengeResponse(
        verificationToken, challengeCode, EBAY_WEBHOOK_ENDPOINT
      );
      return new Response(JSON.stringify({ challengeResponse: challengeResponseValue }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const base44 = createClientFromRequest(req);
    const cfg = getEbayConfig(secrets);
    if (!cfg || !cfg.verificationToken || !cfg.notificationEndpoint) {
      return Response.json({ error: "eBay notifications not configured" }, { status: 503 });
    }

    const rawBody = await req.text();

    // --- Endpoint challenge (eBay destination verification) ---
    // eBay sends a JSON body { challengeCode } to confirm the endpoint.
    try {
      const parsed = rawBody ? JSON.parse(rawBody) : null;
      if (parsed && typeof parsed.challengeCode === "string" && !req.headers.get("x-ebay-signature")) {
        const response = await challengeResponse(cfg.verificationToken, parsed.challengeCode, EBAY_WEBHOOK_ENDPOINT);
        return Response.json({ challengeResponse: response });
      }
    } catch (e) {
      // Not a challenge body — continue to notification handling.
    }

    // --- Signature validation ---
    const signatureHeader = req.headers.get("x-ebay-signature");
    const verification = await verifyEbaySignature(cfg, rawBody, signatureHeader);
    if (!verification.ok) {
      console.warn("eBay webhook rejected:", verification.reason);
      return Response.json({ error: "invalid_signature" }, { status: 412 });
    }

    // --- Parse notification ---
    let notification;
    try {
      notification = JSON.parse(rawBody);
    } catch (e) {
      // Malformed payload — record nothing, reject safely.
      return Response.json({ error: "malformed_notification" }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // --- Marketplace Account Deletion notification ---
    // Valid signature already verified above. Acknowledge immediately without
    // treating it as a sale: no inventory, Stripe, escrow, or payout changes.
    // No user-data deletion workflow exists yet. The eBay user data that COULD
    // be deleted is the seller's EbayTokenStore record and MarketplaceConnection
    // row(s); that is reported here, not performed (no destructive change).
    const topic = notification?.topic || notification?.metadata?.topic || null;
    if (topic === "MARKETPLACE_ACCOUNT_DELETION") {
      return Response.json(
        { status: "acknowledged", topic: "MARKETPLACE_ACCOUNT_DELETION" },
        { status: 200 }
      );
    }

    // Identify the eBay account + order. eBay notification metadata shapes vary;
    // extract defensively and fetch authoritative order detail via Fulfillment API.
    const ebayAccount = notification?.sellerUserName || notification?.sellerUserId ||
      notification?.account_user_id || notification?.recipientUserId || null;
    const orderId = notification?.orderId || notification?.order_id ||
      notification?.data?.orderId || null;
    const notificationId = notification?.notificationId || notification?.metadata?.notificationId ||
      notification?.event_id || null;

    if (!ebayAccount) {
      await svc.entities.UnmatchedExternalEvent.create({
        marketplace: "eBay",
        external_listing_id: notification?.itemId || "unknown",
        external_order_ref: orderId || null,
        external_event_id: notificationId,
        event_payload: "missing_ebay_account",
        status: "unmatched",
        error_message: "Notification did not identify an eBay seller account"
      }).catch(() => {});
      return Response.json({ status: "no_seller" }, { status: 200 });
    }

    // Locate the UKMS connection for this eBay account.
    const conns = await svc.entities.MarketplaceConnection.filter(
      { marketplace: "eBay", seller_user_ref: ebayAccount, enabled: true }, "-created_date", 5
    );
    if (!conns || conns.length === 0) {
      await svc.entities.UnmatchedExternalEvent.create({
        seller_email: null,
        marketplace: "eBay",
        external_listing_id: notification?.itemId || "unknown",
        external_order_ref: orderId || null,
        external_event_id: notificationId,
        event_payload: "no_ukms_connection",
        status: "unmatched",
        error_message: `No UKMS connection for eBay account ${ebayAccount}`
      }).catch(() => {});
      return Response.json({ status: "no_connection" }, { status: 200 });
    }
    const connection = conns[0];
    const sellerEmail = connection.seller_email;

    if (!orderId) {
      // Cannot resolve an exact sale without an order reference — do not guess.
      await svc.entities.UnmatchedExternalEvent.create({
        seller_email: sellerEmail,
        marketplace: "eBay",
        external_listing_id: notification?.itemId || "unknown",
        external_event_id: notificationId,
        event_payload: "no_order_id",
        status: "unmatched",
        error_message: "Notification did not include an order reference"
      }).catch(() => {});
      return Response.json({ status: "no_order" }, { status: 200 });
    }

    // Fetch authoritative order detail (requires valid access token; refresh if needed).
    let order = null;
    try {
      const token = await getValidAccessToken(svc, cfg, sellerEmail);
      order = await getEbayOrder(cfg, token, orderId);
    } catch (e) {
      await svc.entities.InventoryAuditEvent.create({
        seller_email: sellerEmail, marketplace: "eBay", external_order_ref: orderId,
        event_type: "FAILED_EXTERNAL_SYNC", processing_result: "failure",
        source: "webhook", error_message: `token_unavailable: ${e.message}`
      }).catch(() => {});
      return Response.json({ status: "token_unavailable" }, { status: 200 });
    }
    if (!order || !order.lineItems || order.lineItems.length === 0) {
      return Response.json({ status: "no_line_items" }, { status: 200 });
    }

    // Process each line item against the Stage 1 engine.
    for (const li of order.lineItems) {
      // Locate the mapping for this eBay item.
      const mappings = await svc.entities.ExternalListingMapping.filter(
        { marketplace: "eBay", external_listing_id: li.itemId, active: true }, "-created_date", 5
      );
      if (!mappings || mappings.length === 0) {
        await svc.entities.UnmatchedExternalEvent.create({
          seller_email: sellerEmail, marketplace: "eBay",
          external_listing_id: li.itemId, external_order_ref: orderId,
          external_event_id: notificationId, external_sku: li.sku,
          status: "unmatched", error_message: "No active UKMS mapping for this eBay item"
        }).catch(() => {});
        continue;
      }
      const mapping = mappings[0];
      // Security: mapping must belong to the same UKMS seller as the connection.
      if (mapping.seller_email !== sellerEmail) {
        await svc.entities.InventoryAuditEvent.create({
          seller_email: sellerEmail, marketplace: "eBay",
          product_id: mapping.ukms_product_id, external_listing_id: li.itemId,
          external_order_ref: orderId, external_event_id: notificationId,
          event_type: "FAILED_EXTERNAL_SYNC", processing_result: "failure",
          source: "webhook",
          error_message: `seller_mismatch: mapping owned by ${mapping.seller_email}, notification for ${sellerEmail}`
        }).catch(() => {});
        continue;
      }

      await protectFromExternalSale(svc, {
        marketplace: "eBay",
        external_listing_id: li.itemId,
        external_order_ref: orderId,
        external_event_id: notificationId,
        external_sku: li.sku,
        seller_email: sellerEmail,
        quantity_sold: li.quantity,
        source: "webhook"
      });
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("ebayWebhook error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}