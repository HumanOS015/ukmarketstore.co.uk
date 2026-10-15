import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from "base44:runtime";
import { transferToSeller } from "../../shared/escrow.ts";

const ROYAL_MAIL_URL = "https://api.royalmail.net/mailpieces/v2";

// Extracts a normalised UK postcode (no spaces, uppercase) from a free-form
// address string, e.g. the order's shipping_address snapshot.
function extractPostcode(address) {
  if (!address || typeof address !== "string") return null;
  const m = address.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i);
  return m ? m[1].replace(/\s+/g, "").toUpperCase() : null;
}

// Extracts the recipient postcode from a Royal Mail tracking response, checking
// the common address fields. Returns null when the API does not expose one.
function extractRecipientPostcode(data) {
  const mp = Array.isArray(data?.mailPieces) ? data.mailPieces[0] : data?.mailPieces;
  if (!mp || typeof mp !== "object") return null;
  const candidates = [
    mp.recipientAddress?.postcode,
    mp.recipient?.postcode,
    mp.deliveryAddress?.postcode,
    mp.summary?.recipientPostcode,
    mp.summary?.deliveryPostcode,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.replace(/\s+/g, "").toUpperCase();
  }
  return null;
}

function findStatus(data) {
  // Royal Mail Tracking V2 returns the current summary under mailPieces.summary.
  // Do not recursively scan historical events: an old "delivered" event must
  // never be treated as the parcel's current status and trigger a payout.
  if (!data || typeof data !== "object") return "unknown";
  const mailPieces = Array.isArray(data.mailPieces) ? data.mailPieces[0] : data.mailPieces;
  const summary = mailPieces?.summary;
  if (!summary || typeof summary !== "object") return "unknown";

  const category = String(summary.statusCategory || "").trim().toLowerCase();
  if (!category) return "unknown";

  if (category === "delivered") return "delivered";
  if (category.includes("exception") || category.includes("failed") || category.includes("problem") || category.includes("return")) {
    return "exception";
  }
  if (category.includes("transit") || category.includes("progress") || category.includes("delivery office") || category.includes("processing")) {
    return "in_transit";
  }
  return "unknown";
}

async function getRoyalMailStatus(trackingNumber) {
  const clientId = secrets.get("ROYAL_MAIL_CLIENT_ID");
  const clientSecret = secrets.get("ROYAL_MAIL_CLIENT_SECRET");
  if (!clientId || !clientSecret) return { configured: false };

  const response = await fetch(
    `${ROYAL_MAIL_URL}/${encodeURIComponent(trackingNumber)}/events`,
    {
      headers: {
        "Accept": "application/json",
        "X-Accept-RMG-Terms": "yes",
        "X-IBM-Client-Id": clientId,
        "X-IBM-Client-Secret": clientSecret
      }
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Royal Mail API returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  return { configured: true, status: findStatus(data) || "unknown", raw: data };
}

async function getEvriStatus(_trackingNumber) {
  // Evri automated tracking is disabled until the business/API credentials are
  // approved. To re-enable: register EVRI_TRACKING_API_URL and EVRI_TRACKING_API_KEY
  // in the app dashboard (Settings → Secrets), then restore the adapter below.
  return { configured: false };
}

async function releaseDelivered(base44, order) {
  if (order.status === "completed" || order.status === "refunded" || order.status === "disputed") {
    return { released: false, skipped: true };
  }

  await base44.asServiceRole.entities.Order.update(order.id, {
    status: "delivered",
    tracking_status: "delivered",
    delivered_at: new Date().toISOString(),
    last_tracking_check: new Date().toISOString()
  });

  const updated = { ...order, status: "delivered", tracking_status: "delivered" };
  const result = await transferToSeller(base44, updated);

  if (result.ok) {
    await base44.asServiceRole.functions.invoke("orderNotification", {
      orderId: order.id,
      event: "delivered",
      internal_token: secrets.get("ESCROW_RELEASE_TOKEN")
    }).catch(() => {});

    await base44.asServiceRole.functions.invoke("orderNotification", {
      orderId: order.id,
      event: "released",
      internal_token: secrets.get("ESCROW_RELEASE_TOKEN")
    }).catch(() => {});

    return { released: true };
  }

  return { released: false, payoutPending: true, reason: result.reason };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Only the scheduled/internal caller may run bulk polling. A courier webhook may
    // supply a single order/tracking update when authenticated with DELIVERY_WEBHOOK_TOKEN.
    const user = await base44.auth.me().catch(() => null);
    const isAdmin = user?.role === "admin";
    // Only the scheduled/internal caller (admin or ESCROW_RELEASE_TOKEN) may run
    // bulk polling. Courier-webhook single-order updates can be re-enabled by
    // registering DELIVERY_WEBHOOK_TOKEN and restoring the webhook_token check.
    const internalToken = secrets.get("ESCROW_RELEASE_TOKEN");
    const authorised = isAdmin ||
      (typeof body.internal_token === "string" && body.internal_token === internalToken);

    if (!authorised) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const singleOrderId = typeof body.orderId === "string" ? body.orderId : null;
    const orders = singleOrderId
      ? await base44.asServiceRole.entities.Order.filter({ id: singleOrderId })
      : await base44.asServiceRole.entities.Order.filter({ status: "shipped" }, "-created_date", 100);

    let checked = 0;
    let delivered = 0;
    let released = 0;
    let pending = 0;
    const errors = [];

    for (const order of orders) {
      if (order.status !== "shipped" || !order.tracking_number || !["Royal Mail", "Evri"].includes(order.carrier)) continue;
      checked++;

      try {
        let result;
        if (order.carrier === "Royal Mail") {
          result = await getRoyalMailStatus(order.tracking_number);
        } else {
          result = await getEvriStatus(order.tracking_number);
        }

        if (!result.configured) continue;

        const status = result.status || "unknown";
        const patch = {
          tracking_status: status,
          last_tracking_check: new Date().toISOString()
        };

        if (status === "delivered") {
          // Bind the delivered event to this buyer's shipment: when Royal Mail
          // returns a recipient postcode, it must match the order's shipping
          // address. A seller reusing another parcel's tracking number would
          // see a different postcode, so we block the release and flag the
          // order instead of paying out escrow.
          const recipientPostcode = extractRecipientPostcode(result.raw);
          const orderPostcode = extractPostcode(order.shipping_address);
          if (recipientPostcode && orderPostcode && recipientPostcode !== orderPostcode) {
            await base44.asServiceRole.entities.Order.update(order.id, {
              tracking_status: "exception",
              last_tracking_check: new Date().toISOString()
            });
            errors.push({ orderId: order.id, carrier: order.carrier, error: "Delivery postcode mismatch — escrow not released" });
            continue;
          }
          const release = await releaseDelivered(base44, order);
          delivered++;
          if (release.released) released++;
          if (release.payoutPending) pending++;
        } else {
          await base44.asServiceRole.entities.Order.update(order.id, patch);
        }
      } catch (error) {
        console.error("Delivery status check failed", order.id, error);
        errors.push({ orderId: order.id, carrier: order.carrier, error: String(error?.message || error).slice(0, 200) });
      }
    }

    return Response.json({ ok: true, checked, delivered, released, pending, errors: errors.length ? errors : undefined });
  } catch (error) {
    console.error("syncDeliveryStatus error", error);
    return Response.json({ error: error?.message || "Delivery sync failed" }, { status: 500 });
  }
}