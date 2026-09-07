import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { transferToSeller } from "../../shared/escrow.ts";

// Runs daily via the "Escrow Auto-Release" workflow.
// Releases funds for:
//   1. Orders still "shipped" after 14 days (buyer never confirmed delivery)
//   2. Orders "delivered" where the buyer confirmed but the earlier transfer failed
//      (e.g. platform balance hadn't settled) — retries the payout.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

    const shippedOrders = await base44.asServiceRole.entities.Order.filter({ status: "shipped" }, "-created_date", 100);
    const deliveredOrders = await base44.asServiceRole.entities.Order.filter({ status: "delivered" }, "-created_date", 100);

    const eligibleShipped = shippedOrders.filter((o) => new Date(o.created_date).getTime() < fourteenDaysAgo);
    const toRelease = [...eligibleShipped, ...deliveredOrders];

    const results = [];
    let released = 0;
    for (const order of toRelease) {
      const result = await transferToSeller(base44, order);
      results.push({ orderId: order.id, ok: result.ok, reason: result.reason || null });
      if (result.ok) {
        released++;
        base44.asServiceRole.functions.invoke("orderNotification", { orderId: order.id, event: "released" }).catch(() => {});
      }
    }

    return Response.json({
      processed: toRelease.length,
      released,
      results,
    });
  } catch (error) {
    console.error("autoReleaseEscrow error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}