import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { getEbayConfig, getValidAccessToken, verifyEbayListingOwnership } from "../../shared/ebay.ts";

// Seller-facing "Sync eBay now": refreshes the token if required, verifies
// each eBay mapping, applies safe inventory updates, and reports per-mapping
// success/failure. Also used to surface connection health. Never makes
// destructive listing actions.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const svc = base44.asServiceRole;
    const cfg = getEbayConfig(secrets);
    if (!cfg) return Response.json({ error: "eBay not configured" }, { status: 503 });

    const conns = await svc.entities.MarketplaceConnection.filter(
      { seller_email: me.email, marketplace: "eBay" }, "-created_date", 1
    );
    if (!conns || conns.length === 0 || conns[0].connection_status !== "connected") {
      return Response.json({ status: "not_connected" });
    }

    let token;
    try {
      token = await getValidAccessToken(svc, cfg, me.email);
    } catch (e) {
      // Mark connection requiring reauthorisation; stop automatic updates.
      await svc.entities.MarketplaceConnection.update(conns[0].id, {
        connection_status: "sync_error",
        authorization_status: "expired",
        connection_error: "Token refresh failed — reauthorisation required"
      }).catch(() => {});
      return Response.json({ status: "reauth_required", error: e.message });
    }

    const mappings = await svc.entities.ExternalListingMapping.filter(
      { seller_email: me.email, marketplace: "eBay", active: true }, "-created_date", 100
    );

    // ONE-WAY: this is a read-only connection health check. It verifies each
    // linked eBay listing still belongs to the connected seller and reports
    // status. It NEVER pushes inventory changes to eBay (the eBay integration
    // is inbound-only — eBay sales reduce UKMS stock, never the reverse).
    const results = [];
    const now = new Date().toISOString();
    for (const m of mappings) {
      const verify = await verifyEbayListingOwnership(cfg, token, m.external_listing_id, conns[0].seller_user_ref);
      results.push({
        mapping_id: m.id, item_id: m.external_listing_id,
        verified: verify.verified, seller: verify.seller || null, reason: verify.reason || null
      });
    }

    await svc.entities.MarketplaceConnection.update(conns[0].id, {
      last_sync: now, connection_error: null
    }).catch(() => {});

    return Response.json({
      status: "checked",
      linked_listings: mappings.length,
      results
    });
  } catch (error) {
    console.error("ebaySyncNow error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}