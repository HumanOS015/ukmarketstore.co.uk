import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { MARKETPLACES } from "../../shared/inventory.ts";

// Manual "Sold Elsewhere" fallback (Vinted-safe). Lets a seller manually mark a
// UKMS listing as sold on another marketplace when no automatic integration is
// available. Makes the listing unavailable, sets stock to 0, disables
// purchasing, and records an audit event. Idempotent.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { productId, marketplace } = body;
    if (!productId || !marketplace || !MARKETPLACES.includes(marketplace)) {
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

    // Idempotent — already marked sold elsewhere.
    if (product.status === "sold" && product.sold_elsewhere === true) {
      return Response.json({
        status: "already_marked",
        marketplace: product.sold_elsewhere_marketplace
      });
    }

    const now = new Date().toISOString();
    const previousStatus = product.status;
    await svc.entities.Product.update(productId, {
      status: "sold",
      sold_elsewhere: true,
      sold_elsewhere_marketplace: marketplace,
      sold_elsewhere_timestamp: now,
      available_quantity: 0,
      inventory_sync_status: "synced",
      last_sync_time: now,
      last_successful_sync_time: now,
      sync_error_state: "none",
      sync_error_message: ""
    });

    await svc.entities.InventoryAuditEvent.create({
      seller_email: me.email,
      product_id: productId,
      marketplace,
      event_type: "SOLD_ELSEWHERE",
      previous_status: previousStatus,
      new_status: "sold",
      processing_result: "success",
      source: "manual"
    });

    return Response.json({ status: "marked", product_id: productId });
  } catch (error) {
    console.error("markSoldElsewhere error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}