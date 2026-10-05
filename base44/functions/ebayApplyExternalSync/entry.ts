import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
// eBay helpers no longer imported — outbound eBay inventory sync is disabled
// (the eBay integration is ONE-WAY: eBay → UKMS only).

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

    // ONE-WAY: UKMS never pushes inventory changes to eBay. This function is
    // retained as a defensive guard only — it never makes an eBay inventory
    // API call. The eBay integration is inbound-only: eBay sales reduce UKMS
    // stock; UKMS sales never modify eBay listings, payouts, or payments.
    await svc.entities.ExternalListingMapping.update(mapping.id, {
      sync_status: "not_connected",
      sync_error_message: "ebay_sync_is_one_way",
      last_sync_time: new Date().toISOString()
    }).catch(() => {});
    await svc.entities.InventoryAuditEvent.create({
      seller_email: mapping.seller_email, product_id: mapping.ukms_product_id,
      marketplace: "eBay", external_listing_id: mapping.external_listing_id,
      event_type: "NOT_CONNECTED", processing_result: "skipped", source: "auto",
      error_message: "ebay_sync_is_one_way"
    }).catch(() => {});
    return Response.json({ status: "disabled_one_way", reason: "ebay_sync_is_one_way" });
  } catch (error) {
    console.error("ebayApplyExternalSync error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}