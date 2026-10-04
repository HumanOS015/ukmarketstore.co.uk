import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { getEbayConfig, getValidAccessToken, updateEbayInventoryQuantity } from "../../shared/ebay.ts";

// Applies the UKMS-sale → eBay protection for a single eBay mapping: sets the
// corresponding eBay Inventory API item quantity to 0 (non-destructive). Called
// (non-blocking) from the Stage 1 queue after a UKMS sale, and from ebaySyncNow.
// Authorised by either the owning seller's session or the internal token.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { mappingId } = body;

    const me = await base44.auth.me().catch(() => null);
    const token = secrets.get("ESCROW_RELEASE_TOKEN");
    const viaInternal = body.internal_token && body.internal_token === token;
    if (!me?.email && !viaInternal) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const svc = base44.asServiceRole;
    const mappings = await svc.entities.ExternalListingMapping.filter({ id: mappingId }, "-created_date", 1);
    if (!mappings || mappings.length === 0) return Response.json({ error: "Mapping not found" }, { status: 404 });
    const mapping = mappings[0];
    if (mapping.marketplace !== "eBay") return Response.json({ error: "Not an eBay mapping" }, { status: 400 });
    if (me?.email && mapping.seller_email !== me.email) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const cfg = getEbayConfig(secrets);
    if (!cfg) return Response.json({ error: "eBay not configured" }, { status: 503 });

    let accessToken;
    try {
      accessToken = await getValidAccessToken(svc, cfg, mapping.seller_email);
    } catch (e) {
      await svc.entities.ExternalListingMapping.update(mapping.id, {
        sync_status: "failed_external_sync",
        sync_error_message: `token_unavailable: ${e.message}`,
        last_sync_time: new Date().toISOString()
      }).catch(() => {});
      await svc.entities.InventoryAuditEvent.create({
        seller_email: mapping.seller_email, product_id: mapping.ukms_product_id,
        marketplace: "eBay", external_listing_id: mapping.external_listing_id,
        event_type: "FAILED_EXTERNAL_SYNC", processing_result: "failure",
        source: "auto", error_message: `token_unavailable: ${e.message}`
      }).catch(() => {});
      return Response.json({ status: "token_unavailable" }, { status: 200 });
    }

    const result = await updateEbayInventoryQuantity(cfg, accessToken, mapping.external_sku, 0);
    const now = new Date().toISOString();
    if (result.ok) {
      await svc.entities.ExternalListingMapping.update(mapping.id, {
        sync_status: "synced", last_sync_time: now, last_successful_sync_time: now,
        sync_error_message: null
      }).catch(() => {});
      await svc.entities.InventoryAuditEvent.create({
        seller_email: mapping.seller_email, product_id: mapping.ukms_product_id,
        marketplace: "eBay", external_listing_id: mapping.external_listing_id,
        event_type: "SYNCED", new_status: "synced", processing_result: "success", source: "auto"
      }).catch(() => {});
      return Response.json({ status: "synced" });
    }

    // Failed — could not safely update (e.g. listing not Inventory-API managed).
    await svc.entities.ExternalListingMapping.update(mapping.id, {
      sync_status: "failed_external_sync",
      sync_error_message: result.reason || result.status || "ebay_update_failed",
      last_sync_time: now
    }).catch(() => {});
    await svc.entities.InventoryAuditEvent.create({
      seller_email: mapping.seller_email, product_id: mapping.ukms_product_id,
      marketplace: "eBay", external_listing_id: mapping.external_listing_id,
      event_type: "FAILED_EXTERNAL_SYNC", processing_result: "failure",
      source: "auto", error_message: result.reason || result.status || "ebay_update_failed"
    }).catch(() => {});
    return Response.json({ status: "failed", reason: result.reason || result.status });
  } catch (error) {
    console.error("ebayApplyExternalSync error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}