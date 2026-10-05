import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { queueExternalSyncForUkmsSale } from "../../shared/inventory.ts";

// UKMS sale → external protection. Called (non-blocking) after a UKMS sale is
// confirmed. Finds any connected external listings for the sold item and
// queues a pending external inventory update. Does NOT make real external API
// calls — only records the intended sync state. Internal-only endpoint gated
// by ESCROW_RELEASE_TOKEN.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const token = secrets.get("ESCROW_RELEASE_TOKEN");
    if (!token || body.internal_token !== token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId, orderId } = body;
    if (!productId) return Response.json({ error: "Missing productId" }, { status: 400 });

    const svc = base44.asServiceRole;
    const result = await queueExternalSyncForUkmsSale(svc, { productId, orderId });

    // For connected eBay mappings, apply the real eBay inventory update (set
    // quantity to 0) via the eBay function. Failures are audited inside
    // ebayApplyExternalSync; this path never blocks the UKMS sale response.
    try {
      const product = await svc.entities.Product.filter({ id: productId });
      if (product && product.length > 0) {
        const ebayMappings = await svc.entities.ExternalListingMapping.filter(
          { ukms_product_id: productId, marketplace: "eBay", active: true }, "-created_date", 50
        );
        await Promise.allSettled(ebayMappings.map(async (m) => {
          const conn = await svc.entities.MarketplaceConnection.filter(
            { seller_email: product[0].seller_email, marketplace: "eBay", enabled: true, connection_status: "connected" },
            "-created_date", 1
          );
          if (conn && conn.length > 0) {
            await base44.functions.invoke("ebayApplyExternalSync", {
              mappingId: m.id, internal_token: token
            }).catch(() => {});
          }
        }));
      }
    } catch (e) {
      console.error("processUkmsSale ebay apply error", e);
    }

    return Response.json(result);
  } catch (error) {
    console.error("processUkmsSale error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}