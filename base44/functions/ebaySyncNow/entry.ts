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

    const results = [];
    const now = new Date().toISOString();
    for (const m of mappings) {
      // Verify the listing still belongs to the seller.
      const verify = await verifyEbayListingOwnership(cfg, token, m.external_listing_id, conns[0].seller_user_ref);
      if (!verify.verified) {
        await svc.entities.ExternalListingMapping.update(m.id, {
          sync_status: "failed_external_sync",
          sync_error_message: verify.reason || "verification_failed",
          last_sync_time: now
        }).catch(() => {});
        results.push({ mapping_id: m.id, item_id: m.external_listing_id, status: "failed", reason: verify.reason });
        continue;
      }

      // Apply the external sync (delegates to ebayApplyExternalSync).
      const r = await base44.functions.invoke("ebayApplyExternalSync", {
        mappingId: m.id,
        internal_token: secrets.get("ESCROW_RELEASE_TOKEN")
      }).catch((e) => ({ data: { status: "failed", reason: e.message } }));
      results.push({ mapping_id: m.id, item_id: m.external_listing_id, status: r?.data?.status || "failed", reason: r?.data?.reason });
    }

    await svc.entities.MarketplaceConnection.update(conns[0].id, {
      last_sync: now, connection_error: null
    }).catch(() => {});

    return Response.json({
      status: "synced",
      linked_listings: mappings.length,
      results
    });
  } catch (error) {
    console.error("ebaySyncNow error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}