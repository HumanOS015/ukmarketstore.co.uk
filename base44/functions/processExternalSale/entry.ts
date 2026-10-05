import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { protectFromExternalSale } from "../../shared/inventory.ts";

// Inventory Protection Engine — receives a confirmed external sale event and
// safely marks the linked UKMS listing unavailable. Idempotent. Intended to be
// called by authorised marketplace webhooks or the simulation function only,
// so it is gated by an internal shared secret (ESCROW_RELEASE_TOKEN) — never
// callable by anonymous users before real credentials are configured.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const token = secrets.get("ESCROW_RELEASE_TOKEN");
    if (!token || body.internal_token !== token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      marketplace, external_listing_id, external_order_ref,
      external_event_id, external_sku, seller_email, source, quantity_sold
    } = body;

    const result = await protectFromExternalSale(base44.asServiceRole, {
      marketplace, external_listing_id, external_order_ref,
      external_event_id, external_sku, seller_email,
      quantity_sold, source: source || "auto"
    });

    return Response.json(result);
  } catch (error) {
    console.error("processExternalSale error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}