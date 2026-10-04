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

    const result = await queueExternalSyncForUkmsSale(base44.asServiceRole, { productId, orderId });
    return Response.json(result);
  } catch (error) {
    console.error("processUkmsSale error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}