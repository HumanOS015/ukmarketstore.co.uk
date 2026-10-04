import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  protectFromExternalSale,
  queueExternalSyncForUkmsSale,
  isPurchasable,
  MARKETPLACES
} from "../../shared/inventory.ts";

// Test mode — runs simulated marketplace inventory-protection events only.
// Admin-only. Never sends real marketplace requests. Scenarios exercise the
// shared engine directly with synthetic event payloads.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { scenario, productId, marketplace, external_listing_id } = body;
    const now = Date.now();
    const fakeExtId = external_listing_id || `SIM-${scenario}-${now}`;
    const fakeExtOrder = `SIM-ORDER-${now}`;
    const mp = (marketplace && MARKETPLACES.includes(marketplace)) ? marketplace : "eBay";

    switch (scenario) {
      case "ebay_sale": {
        const r = await protectFromExternalSale(svc, {
          marketplace: "eBay", external_listing_id: fakeExtId,
          external_order_ref: fakeExtOrder, external_event_id: `evt-${now}`,
          seller_email: me.email, source: "simulation"
        });
        return Response.json({ scenario, result: r });
      }
      case "amazon_sale": {
        const r = await protectFromExternalSale(svc, {
          marketplace: "Amazon", external_listing_id: fakeExtId,
          external_order_ref: fakeExtOrder, external_event_id: `evt-${now}`,
          seller_email: me.email, source: "simulation"
        });
        return Response.json({ scenario, result: r });
      }
      case "vinted_manual": {
        if (!productId) return Response.json({ error: "productId required" }, { status: 400 });
        const products = await svc.entities.Product.filter({ id: productId });
        if (!products.length) return Response.json({ error: "Listing not found" }, { status: 404 });
        const product = products[0];
        const t = new Date().toISOString();
        const prev = product.status;
        await svc.entities.Product.update(productId, {
          status: "sold", sold_elsewhere: true, sold_elsewhere_marketplace: "Vinted",
          sold_elsewhere_timestamp: t, available_quantity: 0,
          inventory_sync_status: "synced", last_sync_time: t, sync_error_state: "none"
        });
        await svc.entities.InventoryAuditEvent.create({
          seller_email: product.seller_email, product_id: productId, marketplace: "Vinted",
          event_type: "SOLD_ELSEWHERE", previous_status: prev, new_status: "sold",
          processing_result: "success", source: "simulation"
        });
        return Response.json({ scenario, result: { status: "marked", product_id: productId } });
      }
      case "ukms_sale": {
        if (!productId) return Response.json({ error: "productId required" }, { status: 400 });
        const r = await queueExternalSyncForUkmsSale(svc, { productId, orderId: `SIM-UKMS-${now}` });
        return Response.json({ scenario, result: r });
      }
      case "duplicate_event": {
        const evtId = `evt-dup-${now}`;
        const r1 = await protectFromExternalSale(svc, {
          marketplace: mp, external_listing_id: fakeExtId,
          external_order_ref: fakeExtOrder, external_event_id: evtId,
          seller_email: me.email, source: "simulation"
        });
        const r2 = await protectFromExternalSale(svc, {
          marketplace: mp, external_listing_id: fakeExtId,
          external_order_ref: fakeExtOrder, external_event_id: evtId,
          seller_email: me.email, source: "simulation"
        });
        return Response.json({
          scenario, first: r1, second: r2,
          idempotent: r2.status === "already_protected"
        });
      }
      case "unmatched_event": {
        const r = await protectFromExternalSale(svc, {
          marketplace: "eBay", external_listing_id: `NO-SUCH-${now}`,
          external_order_ref: fakeExtOrder, external_event_id: `evt-unmatched-${now}`,
          seller_email: me.email, source: "simulation"
        });
        return Response.json({ scenario, result: r });
      }
      case "concurrent_ukms": {
        if (!productId) return Response.json({ error: "productId required" }, { status: 400 });
        const products = await svc.entities.Product.filter({ id: productId });
        if (!products.length) return Response.json({ error: "Listing not found" }, { status: 404 });
        const firstOk = isPurchasable(products[0]);
        // Acquire lock — second "buyer" must be blocked.
        await svc.entities.Product.update(productId, { sync_locked: true });
        const products2 = await svc.entities.Product.filter({ id: productId });
        const secondOk = isPurchasable(products2[0]);
        // Release the lock.
        await svc.entities.Product.update(productId, { sync_locked: false });
        return Response.json({
          scenario, first_attempt: firstOk, second_attempt: secondOk,
          second_blocked: secondOk === false
        });
      }
      case "external_sync_failure": {
        if (!productId) return Response.json({ error: "productId required" }, { status: 400 });
        const products = await svc.entities.Product.filter({ id: productId });
        if (!products.length) return Response.json({ error: "Listing not found" }, { status: 404 });
        const product = products[0];
        await svc.entities.InventoryAuditEvent.create({
          seller_email: product.seller_email, product_id: productId,
          marketplace: mp, event_type: "FAILED_EXTERNAL_SYNC",
          processing_result: "failure", source: "simulation",
          error_message: "Simulated external API failure"
        });
        await svc.entities.Product.update(productId, {
          inventory_sync_status: "failed_external_sync",
          sync_error_state: "error",
          sync_error_message: "Simulated external API failure",
          last_sync_time: new Date().toISOString()
        }).catch(() => {});
        return Response.json({ scenario, result: { status: "recorded_failure" } });
      }
      case "already_sold": {
        if (!productId) return Response.json({ error: "productId required" }, { status: 400 });
        const products = await svc.entities.Product.filter({ id: productId });
        if (!products.length) return Response.json({ error: "Listing not found" }, { status: 404 });
        const product = products[0];
        const r = await protectFromExternalSale(svc, {
          marketplace: "eBay", external_listing_id: fakeExtId,
          external_order_ref: fakeExtOrder, external_event_id: `evt-sold-${now}`,
          seller_email: product.seller_email, source: "simulation"
        });
        return Response.json({
          scenario, result: r,
          note: product.status === "sold" ? "listing already sold" : "processed"
        });
      }
      case "disconnected": {
        if (!productId) return Response.json({ error: "productId required" }, { status: 400 });
        const r = await queueExternalSyncForUkmsSale(svc, { productId, orderId: `SIM-UKMS-DISC-${now}` });
        return Response.json({ scenario, result: r });
      }
      case "invalid_mapping": {
        const r = await protectFromExternalSale(svc, {
          marketplace: "NotARealMarketplace", external_listing_id: fakeExtId,
          external_order_ref: fakeExtOrder, source: "simulation"
        });
        return Response.json({ scenario, result: r });
      }
      default:
        return Response.json({ error: "Unknown scenario" }, { status: 400 });
    }
  } catch (error) {
    console.error("runInventorySimulation error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}