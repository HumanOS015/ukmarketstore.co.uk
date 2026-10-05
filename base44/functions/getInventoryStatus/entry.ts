import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { getEbayConfig } from "../../shared/ebay.ts";

// Role-aware inventory protection status. Returns marketplace connection
// status, mapping/sync state, and (for admins) monitoring stats plus recent
// audit and unmatched events. Never returns marketplace tokens or credentials
// (none are stored in the connection entity).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const svc = base44.asServiceRole;
    const ebayCfg = getEbayConfig(secrets);
    const isAdmin = me.role === "admin";

    if (isAdmin) {
      const [connections, mappings, audit, unmatched, protectedListings, soldElsewhere] = await Promise.all([
        svc.entities.MarketplaceConnection.list("-created_date", 500),
        svc.entities.ExternalListingMapping.list("-created_date", 500),
        svc.entities.InventoryAuditEvent.list("-created_date", 100),
        svc.entities.UnmatchedExternalEvent.list("-created_date", 100),
        svc.entities.Product.filter({ sold_elsewhere: true }),
        svc.entities.InventoryAuditEvent.filter({ event_type: "SOLD_ELSEWHERE" })
      ]);

      const connectedCount = connections.filter(c => c.connection_status === "connected").length;
      const activeSyncs = mappings.filter(m => m.sync_status === "pending_external_sync").length;
      const successfulSyncs = audit.filter(a =>
        a.event_type === "SYNCED" || (a.event_type === "SOLD_ELSEWHERE" && a.processing_result === "success")
      ).length;
      const failedSyncs = audit.filter(a =>
        a.event_type === "FAILED_EXTERNAL_SYNC" || a.processing_result === "failure"
      ).length;

      return Response.json({
        role: "admin",
        stats: {
          connected_marketplaces: connectedCount,
          active_syncs: activeSyncs,
          successful_syncs: successfulSyncs,
          failed_syncs: failedSyncs,
          protected_listings: protectedListings.length,
          sold_elsewhere_events: soldElsewhere.length,
          unmatched_events: unmatched.length
        },
        ebay_configured: !!ebayCfg,
        ebay_environment: ebayCfg?.environment || null,
        audit: audit.slice(0, 50),
        unmatched: unmatched.slice(0, 50)
      });
    }

    // Seller view — own data only.
    const [connections, mappings, products] = await Promise.all([
      svc.entities.MarketplaceConnection.filter({ seller_email: me.email }, "-created_date", 100),
      svc.entities.ExternalListingMapping.filter({ seller_email: me.email }, "-created_date", 200),
      svc.entities.Product.filter({ seller_email: me.email }, "-created_date", 200)
    ]);

    const statusByMarketplace = {};
    for (const m of ["eBay", "Amazon", "Vinted"]) {
      const conn = connections.find(c => c.marketplace === m);
      statusByMarketplace[m] = conn ? conn.connection_status : "not_connected";
    }

    const ebayConn = connections.find(c => c.marketplace === "eBay");
    return Response.json({
      role: "seller",
      connections: statusByMarketplace,
      ebay: {
        configured: !!ebayCfg,
        environment: ebayCfg?.environment || null,
        connection_status: ebayConn?.connection_status || "not_connected",
        last_sync: ebayConn?.last_sync || null,
        connection_error: ebayConn?.connection_error || null,
        linked_listings: mappings.filter(m => m.marketplace === "eBay" && m.active).length
      },
      mappings: mappings.map(m => ({
        id: m.id,
        product_id: m.ukms_product_id,
        marketplace: m.marketplace,
        external_listing_id: m.external_listing_id,
        external_sku: m.external_sku,
        sync_status: m.sync_status,
        active: m.active
      })),
      products: products.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        sold_elsewhere: p.sold_elsewhere,
        sold_elsewhere_marketplace: p.sold_elsewhere_marketplace,
        inventory_sync_status: p.inventory_sync_status,
        available_quantity: p.available_quantity
      }))
    });
  } catch (error) {
    console.error("getInventoryStatus error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}