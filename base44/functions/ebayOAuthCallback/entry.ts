import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { getEbayConfig, exchangeCodeForToken, getEbayUser } from "../../shared/ebay.ts";

// eBay OAuth callback — eBay redirects here with ?code&state after the seller
// authorises. Validates the state nonce against the pending token-store
// record, exchanges the code for access + refresh tokens, retrieves the
// authorised seller identity, stores tokens server-side (never returned), and
// marks the MarketplaceConnection as CONNECTED. Then redirects the seller
// back to the inventory page.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const appUrl = "https://ukmarketstore.base44.app";
    if (!code || !state) {
      return Response.redirect(`${appUrl}/seller-inventory?ebay=error`, 302);
    }

    const svc = base44.asServiceRole;
    // Verify the state nonce against a pending token-store record.
    const pending = await svc.entities.EbayTokenStore.filter({ state, status: "pending" }, "-created_date", 5);
    if (!pending || pending.length === 0) {
      return Response.redirect(`${appUrl}/seller-inventory?ebay=invalid_state`, 302);
    }
    const record = pending[0];
    const sellerEmail = record.seller_email;

    // State nonce must be used within 10 minutes — a leaked state is useless
    // after it expires. Stale pending records are marked expired so they can't
    // be replayed.
    const stateAgeMs = record.created_date ? Date.now() - new Date(record.created_date).getTime() : Infinity;
    if (stateAgeMs > 10 * 60 * 1000) {
      await svc.entities.EbayTokenStore.update(record.id, { status: "expired" }).catch(() => {});
      return Response.redirect(`${appUrl}/seller-inventory?ebay=state_expired`, 302);
    }

    // The callback must be completed by the same seller who started the flow —
    // their browser session carries the auth cookie eBay redirected back with.
    // This prevents an attacker who obtains a leaked state from binding their
    // own eBay identity to the victim seller's connection.
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email || me.email !== sellerEmail) {
      await svc.entities.EbayTokenStore.update(record.id, { status: "expired" }).catch(() => {});
      return Response.redirect(`${appUrl}/seller-inventory?ebay=auth_mismatch`, 302);
    }

    const cfg = getEbayConfig(secrets);
    if (!cfg) {
      return Response.redirect(`${appUrl}/seller-inventory?ebay=not_configured`, 302);
    }

    const tokens = await exchangeCodeForToken(cfg, code);
    const identity = await getEbayUser(cfg, tokens.access_token);
    const now = new Date();
    const tokenExpiry = new Date(now.getTime() + (tokens.expires_in || 7200) * 1000).toISOString();
    const refreshExpiry = new Date(now.getTime() + (tokens.refresh_token_expires_in || 47304000) * 1000).toISOString();

    await svc.entities.EbayTokenStore.update(record.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokenExpiry,
      refresh_token_expiry: refreshExpiry,
      ebay_user_id: identity.username || identity.userId || null,
      scope: tokens.scope || cfg.scopes,
      status: "active",
      last_refresh: now.toISOString(),
      last_error: null
    });

    // Upsert the MarketplaceConnection as connected. Tokens are NOT stored here.
    const existing = await svc.entities.MarketplaceConnection.filter(
      { seller_email: sellerEmail, marketplace: "eBay" }, "-created_date", 1
    );
    if (existing && existing.length > 0) {
      await svc.entities.MarketplaceConnection.update(existing[0].id, {
        connection_status: "connected",
        authorization_status: "authorized",
        seller_user_ref: identity.username || identity.userId || null,
        enabled: true,
        last_connection_test: now.toISOString(),
        connection_error: null
      });
    } else {
      await svc.entities.MarketplaceConnection.create({
        seller_email: sellerEmail,
        marketplace: "eBay",
        connection_status: "connected",
        authorization_status: "authorized",
        seller_user_ref: identity.username || identity.userId || null,
        enabled: true,
        last_connection_test: now.toISOString()
      });
    }

    await svc.entities.InventoryAuditEvent.create({
      seller_email: sellerEmail,
      marketplace: "eBay",
      event_type: "CONNECTION_TEST",
      previous_status: "not_connected",
      new_status: "connected",
      processing_result: "success",
      source: "manual"
    }).catch(() => {});

    return Response.redirect(`${appUrl}/seller-inventory?ebay=connected`, 302);
  } catch (error) {
    console.error("ebayOAuthCallback error", error);
    return Response.redirect("https://ukmarketstore.base44.app/seller-inventory?ebay=error", 302);
  }
}