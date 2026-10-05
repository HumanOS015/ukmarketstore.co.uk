// Multi-Marketplace Inventory Protection — shared engine logic.
// Imported by processExternalSale, processUkmsSale, markSoldElsewhere,
// createCheckoutSession and runInventorySimulation so the availability,
// locking and idempotency rules are identical across every entry point.
// Pure functions only — the service-role base44 client is passed in by each
// caller (backend functions never share module-level SDK clients).
//
// The eBay integration is ONE-WAY: eBay → UKMS only. eBay sales reduce UKMS
// stock; UKMS never pushes inventory changes back to eBay. The outbound
// queue helper (queueExternalSyncForUkmsSale) skips eBay mappings entirely.

export const MARKETPLACES = ["eBay", "Amazon", "Vinted", "Other"];

export const SYNC_STATUS = {
  NOT_CONNECTED: "not_connected",
  PENDING: "pending_external_sync",
  SYNCED: "synced",
  FAILED: "failed_external_sync"
};

// Final server-side purchasability gate. A listing is purchasable only when it
// is active, not flagged sold-elsewhere, not sync-locked, and has stock.
// Defaults to 1 unit for legacy single-item listings that predate the
// inventory fields, so existing listings are never accidentally blocked.
export function isPurchasable(product) {
  if (!product) return false;
  if (product.status !== "active") return false;
  if (product.sold_elsewhere === true) return false;
  if (product.sync_locked === true) return false;
  const qty = Number(product.available_quantity ?? product.quantity ?? 1);
  if (!Number.isFinite(qty) || qty <= 0) return false;
  return true;
}

export function unavailableReason(product) {
  if (!product) return "not_found";
  if (product.sold_elsewhere === true) return "sold_elsewhere";
  if (product.status === "sold") return "sold";
  if (product.sync_locked === true) return "sync_locked";
  const qty = Number(product.available_quantity ?? product.quantity ?? 1);
  if (!Number.isFinite(qty) || qty <= 0) return "out_of_stock";
  if (product.status !== "active") return product.status || "unavailable";
  return "available";
}

export function eventFingerprint({ marketplace, external_listing_id, external_order_ref }) {
  return [marketplace || "", external_listing_id || "", external_order_ref || ""].join("|");
}

// Idempotency: has this external sale already been processed successfully?
export async function alreadyProtected(svc, { product_id, fingerprint, external_event_id }) {
  const query = { product_id, event_type: "SOLD_ELSEWHERE", processing_result: "success" };
  if (external_event_id) query.external_event_id = external_event_id;
  else query.event_fingerprint = fingerprint;
  const existing = await svc.entities.InventoryAuditEvent.filter(query, "-created_date", 1);
  return !!(existing && existing.length > 0);
}

// Core protection: reduce a UKMS listing's available quantity (or mark it
// fully sold) because it sold on an external marketplace. ONE-WAY: only ever
// mutates the UKMS product, never the external listing. Idempotent — repeat
// notifications for the same sale perform no action and create no duplicates.
// Partial-quantity safe: when quantity_sold < available quantity, the UKMS
// listing's available quantity is reduced by exactly quantity_sold and the
// listing stays active/purchasable; only when stock reaches 0 is the listing
// marked sold and made non-purchasable.
export async function protectFromExternalSale(svc, params) {
  const {
    marketplace, external_listing_id, external_order_ref,
    external_event_id, external_sku, seller_email, source = "auto",
    quantity_sold
  } = params;

  if (!MARKETPLACES.includes(marketplace)) return { status: "invalid_marketplace" };
  if (!external_listing_id) return { status: "invalid_request" };

  // 1. Locate the linked UKMS inventory item via an explicit mapping.
  const mappingQuery = { marketplace, external_listing_id, active: true };
  if (seller_email) mappingQuery.seller_email = seller_email;
  const mappings = await svc.entities.ExternalListingMapping.filter(mappingQuery, "-created_date", 10);
  if (!mappings || mappings.length === 0) {
    // 2. No match — record as unmatched. Never guess.
    await svc.entities.UnmatchedExternalEvent.create({
      marketplace, external_listing_id, external_order_ref, external_event_id, external_sku,
      seller_email: seller_email || null,
      status: "unmatched",
      error_message: "No active UKMS mapping found for this external listing"
    });
    await svc.entities.InventoryAuditEvent.create({
      seller_email: seller_email || "unknown",
      marketplace, external_listing_id, external_order_ref, external_event_id,
      event_type: "UNMATCHED_EXTERNAL_EVENT",
      processing_result: "failure",
      source,
      error_message: "No active UKMS mapping found"
    });
    return { status: "unmatched" };
  }
  const mapping = mappings[0];
  const productId = mapping.ukms_product_id;

  // 3. Verify the mapping points at a real UKMS listing.
  const products = await svc.entities.Product.filter({ id: productId });
  if (!products || products.length === 0) return { status: "product_missing" };
  const product = products[0];
  const fingerprint = eventFingerprint({ marketplace, external_listing_id, external_order_ref });

  // 4. Idempotency — already protected?
  if (await alreadyProtected(svc, { product_id: productId, fingerprint, external_event_id })) {
    return { status: "already_protected", product_id: productId };
  }
  // Already fully sold — nothing to reduce.
  if (product.status === "sold" || product.sold_elsewhere === true) {
    return { status: "already_protected", product_id: productId };
  }

  // 5. Compute the quantity delta (partial-quantity safe).
  const availableQty = Number(product.available_quantity ?? product.quantity ?? 1) || 0;
  const soldQty = Number(quantity_sold) > 0 ? Number(quantity_sold) : 1;
  const newQty = Math.max(0, availableQty - soldQty);
  const fullySold = newQty <= 0;

  // 6. Acquire a soft sync lock while we mutate availability.
  const previousStatus = product.status;
  try {
    await svc.entities.Product.update(productId, { sync_locked: true });
  } catch (e) {
    return { status: "lock_failed", error: e.message };
  }

  try {
    // 7. Reduce UKMS availability. ONE-WAY: only the UKMS product changes.
    const now = new Date().toISOString();
    const update = {
      available_quantity: newQty,
      sync_locked: false,
      inventory_sync_status: SYNC_STATUS.SYNCED,
      last_sync_time: now,
      last_successful_sync_time: now,
      sync_error_state: "none",
      sync_error_message: ""
    };
    let newStatus = previousStatus;
    if (fullySold) {
      update.status = "sold";
      update.sold_elsewhere = true;
      update.sold_elsewhere_marketplace = marketplace;
      update.sold_elsewhere_timestamp = now;
      newStatus = "sold";
    }
    await svc.entities.Product.update(productId, update);

    // 8. Audit record — origin is the external marketplace (eBay).
    await svc.entities.InventoryAuditEvent.create({
      seller_email: product.seller_email,
      product_id: productId,
      marketplace, external_listing_id, external_order_ref, external_event_id,
      event_fingerprint: fingerprint,
      event_type: "SOLD_ELSEWHERE",
      previous_status: previousStatus,
      new_status: newStatus,
      processing_result: "success",
      source
    });

    return {
      status: fullySold ? "protected" : "quantity_reduced",
      product_id: productId,
      mapping_id: mapping.id,
      quantity_sold: soldQty,
      previous_available_quantity: availableQty,
      new_available_quantity: newQty,
      fully_sold: fullySold
    };
  } catch (e) {
    await svc.entities.Product.update(productId, { sync_locked: false }).catch(() => {});
    await svc.entities.InventoryAuditEvent.create({
      seller_email: product.seller_email,
      product_id: productId,
      marketplace, external_listing_id,
      event_type: "SOLD_ELSEWHERE",
      processing_result: "failure",
      source,
      error_message: e.message
    });
    return { status: "error", error: e.message };
  }
}

// Reverse direction: a UKMS sale just completed. Record the intended sync
// state for connected NON-eBay external listings only. This is a ONE-WAY
// integration: UKMS never pushes inventory changes back to eBay (eBay is
// inbound-only — eBay sales reduce UKMS stock, never the reverse). For eBay
// mappings we record NOT_CONNECTED and skip any outbound queueing. Does NOT
// make real external API calls — only records intended sync state.
export async function queueExternalSyncForUkmsSale(svc, { productId, orderId }) {
  const products = await svc.entities.Product.filter({ id: productId });
  if (!products || products.length === 0) return { status: "product_missing" };
  const product = products[0];

  const mappings = await svc.entities.ExternalListingMapping.filter(
    { ukms_product_id: productId, active: true }, "-created_date", 50
  );
  if (!mappings || mappings.length === 0) {
    await svc.entities.Product.update(productId, {
      inventory_sync_status: SYNC_STATUS.NOT_CONNECTED,
      last_sync_time: new Date().toISOString()
    }).catch(() => {});
    return { status: "no_mappings" };
  }

  let anyPending = false;
  let ebaySkipped = 0;
  for (const mapping of mappings) {
    // ONE-WAY: never queue outbound eBay inventory updates.
    if (mapping.marketplace === "eBay") {
      ebaySkipped++;
      await svc.entities.ExternalListingMapping.update(mapping.id, {
        sync_status: SYNC_STATUS.NOT_CONNECTED, last_sync_time: new Date().toISOString()
      }).catch(() => {});
      await svc.entities.InventoryAuditEvent.create({
        seller_email: product.seller_email, product_id: productId,
        marketplace: "eBay", external_listing_id: mapping.external_listing_id,
        order_id: orderId, event_type: "NOT_CONNECTED",
        processing_result: "skipped", source: "webhook",
        error_message: "ebay_sync_is_one_way"
      }).catch(() => {});
      continue;
    }
    const connections = await svc.entities.MarketplaceConnection.filter(
      { seller_email: product.seller_email, marketplace: mapping.marketplace, enabled: true },
      "-created_date", 1
    );
    const connected = connections && connections.length > 0 && connections[0].connection_status === "connected";
    const now = new Date().toISOString();
    if (connected) {
      await svc.entities.ExternalListingMapping.update(mapping.id, {
        sync_status: SYNC_STATUS.PENDING, last_sync_time: now
      }).catch(() => {});
      await svc.entities.InventoryAuditEvent.create({
        seller_email: product.seller_email, product_id: productId,
        marketplace: mapping.marketplace, external_listing_id: mapping.external_listing_id,
        order_id: orderId, event_type: "PENDING_EXTERNAL_SYNC",
        previous_status: "active", new_status: SYNC_STATUS.PENDING,
        processing_result: "success", source: "webhook"
      }).catch(() => {});
      anyPending = true;
    } else {
      await svc.entities.ExternalListingMapping.update(mapping.id, {
        sync_status: SYNC_STATUS.NOT_CONNECTED, last_sync_time: now
      }).catch(() => {});
      await svc.entities.InventoryAuditEvent.create({
        seller_email: product.seller_email, product_id: productId,
        marketplace: mapping.marketplace, external_listing_id: mapping.external_listing_id,
        order_id: orderId, event_type: "NOT_CONNECTED",
        processing_result: "skipped", source: "webhook"
      }).catch(() => {});
    }
  }

  const newStatus = anyPending ? SYNC_STATUS.PENDING : SYNC_STATUS.NOT_CONNECTED;
  await svc.entities.Product.update(productId, {
    inventory_sync_status: newStatus, last_sync_time: new Date().toISOString()
  }).catch(() => {});
  return { status: "queued", mappings: mappings.length, ebay_skipped: ebaySkipped };
}