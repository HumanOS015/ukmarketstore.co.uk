import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from "base44:runtime";
import { transferToSeller } from "../../shared/escrow.ts";

// Runs daily via the "Escrow Auto-Release" workflow.
// Releases funds for:
//   1. Orders still "shipped" after 14 days (buyer never confirmed delivery)
//   2. Orders "delivered" where the buyer confirmed but the earlier transfer failed
//      (e.g. platform balance hadn't settled) — retries the payout.
// Security: this function has no user session (it's a scheduled job), so it requires a
// shared secret (ESCROW_RELEASE_TOKEN) that only the workflow presents. Anonymous HTTP
// callers are rejected before any escrow processing runs.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.internal_token || body.internal_token !== secrets.get("ESCROW_RELEASE_TOKEN")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);

    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

    const shippedOrders = await base44.asServiceRole.entities.Order.filter({ status: "shipped" }, "-created_date", 100);
    const deliveredOrders = await base44.asServiceRole.entities.Order.filter({ status: "delivered" }, "-created_date", 100);

    const eligibleShipped = shippedOrders.filter((o) => new Date(o.created_date).getTime() < fourteenDaysAgo);
    const toRelease = [...eligibleShipped, ...deliveredOrders];

    let released = 0;
    for (const order of toRelease) {
      const result = await transferToSeller(base44, order);
      if (result.ok) {
        released++;
        base44.asServiceRole.functions.invoke("orderNotification", { orderId: order.id, event: "released" }).catch(() => {});
      }
    }

    // Return only aggregate counts — never per-order ids or transfer failure reasons,
    // which would expose sensitive information to anonymous callers.
    return Response.json({
      processed: toRelease.length,
      released,
    });
  } catch (error) {
    console.error("autoReleaseEscrow error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}