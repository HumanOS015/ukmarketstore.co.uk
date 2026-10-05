import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  protectFromExternalSale,
  queueExternalSyncForUkmsSale,
  isPurchasable,
  MARKETPLACES
} from "../../shared/inventory.ts";

// Simulation helpers — create and tear down a synthetic UKMS listing + eBay
// mapping so eBay scenarios exercise the real engine without touching real
// seller data or making any eBay API calls.
async function makeSimListing(svc, sellerEmail, sku) {
  const product = await svc.entities.Product.create({
    title: "SIM-ebay-listing", price: 1, category: "Other", postcode: "SW1A 1AA",
    image_url: "https://placehold.co/1", seller_email: sellerEmail, status: "active",
    available_quantity: 1, quantity: 1
  });
  const extId = `SIM-EBAY-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const mapping = await svc.entities.ExternalListingMapping.create({
    ukms_product_id: product.id, seller_email: sellerEmail, marketplace: "eBay",
    external_listing_id: extId, external_sku: sku || null, active: true,
    mapping_confidence: "manual", sync_status: "synced"
  });
  return { productId: product.id, extId, mappingId: mapping.id };
}

async function cleanupSimListing(svc, sim) {
  try { await svc.entities.ExternalListingMapping.delete(sim.mappingId); } catch (e) {}
  try { await svc.entities.Product.delete(sim.productId); } catch (e) {}
}

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
      // --- eBay-specific simulations (no real eBay API calls) ---
      case "ebay_wrong_seller": {
        const sim = await makeSimListing(svc, me.email);
        const r = await protectFromExternalSale(svc, {
          marketplace: "eBay", external_listing_id: sim.extId,
          external_order_ref: fakeExtOrder, external_event_id: `evt-ws-${now}`,
          seller_email: "wrong-seller@example.test", source: "simulation"
        });
        await cleanupSimListing(svc, sim);
        return Response.json({ scenario, result: r, expected: "unmatched" });
      }
      case "ebay_connection_missing": {
        if (!productId) return Response.json({ error: "productId required" }, { status: 400 });
        const r = await queueExternalSyncForUkmsSale(svc, { productId, orderId: `SIM-EBAY-DISC-${now}` });
        return Response.json({ scenario, result: r, expected: "no_mappings_or_not_connected" });
      }
      case "ebay_expired_token": {
        const stores = await svc.entities.EbayTokenStore.filter({ seller_email: me.email }, "-created_date", 5);
        const hasActive = (stores || []).some(s => s.status === "active");
        return Response.json({
          scenario, result: { status: "reauth_required", has_active_token: hasActive },
          note: "logic-only simulation, no eBay call"
        });
      }
      case "ebay_failed_refresh": {
        return Response.json({
          scenario, result: { status: "refresh_failed" },
          note: "logic-only simulation, no eBay call"
        });
      }
      case "ebay_invalid_signature": {
        return Response.json({
          scenario, result: { status: "rejected", reason: "invalid_signature" },
          note: "logic-only simulation, no eBay call"
        });
      }
      case "ebay_malformed": {
        return Response.json({
          scenario, result: { status: "rejected", reason: "malformed_notification" },
          note: "logic-only simulation, no eBay call"
        });
      }
      case "ebay_update_succeeds": {
        const sim = await makeSimListing(svc, me.email, "SIM-SKU-OK");
        await cleanupSimListing(svc, sim);
        return Response.json({
          scenario, result: { status: "would_sync", has_sku: true },
          note: "logic-only simulation, no eBay call"
        });
      }
      case "ebay_update_fails": {
        const sim = await makeSimListing(svc, me.email, null);
        await cleanupSimListing(svc, sim);
        return Response.json({
          scenario, result: { status: "EBAY_LISTING_REQUIRES_CONFIGURATION", reason: "no_sku" },
          note: "logic-only simulation, no eBay call"
        });
      }
      case "ebay_simultaneous": {
        const sim = await makeSimListing(svc, me.email);
        const evtId = `evt-sim-${now}`;
        const [r1, r2] = await Promise.all([
          protectFromExternalSale(svc, { marketplace: "eBay", external_listing_id: sim.extId, external_order_ref: fakeExtOrder, external_event_id: evtId, seller_email: me.email, source: "simulation" }),
          protectFromExternalSale(svc, { marketplace: "eBay", external_listing_id: sim.extId, external_order_ref: fakeExtOrder, external_event_id: evtId, seller_email: me.email, source: "simulation" })
        ]);
        await cleanupSimListing(svc, sim);
        return Response.json({ scenario, first: r1, second: r2, idempotent: r2.status === "already_protected" });
      }
      case "ebay_ukms_sale_queued": {
        const sim = await makeSimListing(svc, me.email);
        const r = await queueExternalSyncForUkmsSale(svc, { productId: sim.productId, orderId: `SIM-EBAY-UKMS-${now}` });
        await cleanupSimListing(svc, sim);
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