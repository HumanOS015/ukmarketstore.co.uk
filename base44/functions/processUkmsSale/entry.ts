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

    // ONE-WAY: UKMS never pushes inventory changes back to eBay. The eBay
    // integration is inbound-only (eBay sales reduce UKMS stock, never the
    // reverse), so no outbound eBay inventory update is applied here.

    return Response.json(result);
  } catch (error) {
    console.error("processUkmsSale error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}