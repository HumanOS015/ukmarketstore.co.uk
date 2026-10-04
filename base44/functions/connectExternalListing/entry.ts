import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { MARKETPLACES } from "../../shared/inventory.ts";

// Explicit external listing association. A seller links a UKMS listing to an
// external marketplace listing by providing the marketplace and a stable
// external listing/item ID. The system never guesses the association. The
// mapping is created with confidence "manual".
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { productId, marketplace, external_listing_id, external_sku } = body;
    if (!productId || !marketplace || !MARKETPLACES.includes(marketplace) || !external_listing_id) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const products = await svc.entities.Product.filter({ id: productId });
    if (!products || products.length === 0) {
      return Response.json({ error: "Listing not found" }, { status: 404 });
    }
    const product = products[0];
    if (product.seller_email !== me.email) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Prevent duplicate active mappings for the same external listing.
    const existing = await svc.entities.ExternalListingMapping.filter(
      { ukms_product_id: productId, marketplace, external_listing_id, active: true },
      "-created_date", 1
    );
    if (existing && existing.length > 0) {
      return Response.json({ status: "already_mapped", mapping_id: existing[0].id });
    }

    const mapping = await svc.entities.ExternalListingMapping.create({
      ukms_product_id: productId,
      seller_email: me.email,
      marketplace,
      external_listing_id,
      external_sku: external_sku || null,
      active: true,
      mapping_confidence: "manual",
      sync_status: "not_connected"
    });

    await svc.entities.InventoryAuditEvent.create({
      seller_email: me.email,
      product_id: productId,
      marketplace,
      external_listing_id,
      event_type: "MAPPING_CREATED",
      processing_result: "success",
      source: "manual"
    });

    return Response.json({ status: "mapped", mapping_id: mapping.id });
  } catch (error) {
    console.error("connectExternalListing error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}