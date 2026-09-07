import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from "base44:runtime";
import { transferToSeller } from "../../shared/escrow.ts";

// Runs daily via the "Escrow Auto-Release" workflow.
// Releases funds for:
//   1. Orders still "shipped" after 7 days (buyer never confirmed delivery)
//   2. Orders "delivered" where the buyer confirmed but the earlier transfer failed
//      (e.g. platform balance hadn't settled) — retries the payout.
// Security: this is an admin-only scheduled task. Accepted callers:
//   1. The platform's workflow runner / dashboard admins (authenticated admin session)
//   2. Internal backend functions presenting the ESCROW_RELEASE_TOKEN shared secret
// Anonymous HTTP callers have neither and are rejected before any escrow processing runs —
// this gates real Stripe transfers, so no hardcoded string or client-supplied flag is accepted.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    const isAdmin = !!user && user.role === "admin";

    let hasSecret = false;
    if (!isAdmin) {
      const body = await req.json().catch(() => ({}));
      hasSecret = typeof body.internal_token === "string" && body.internal_token === secrets.get("ESCROW_RELEASE_TOKEN");
    }
    if (!isAdmin && !hasSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const shippedOrders = await base44.asServiceRole.entities.Order.filter({ status: "shipped" }, "-created_date", 100);
    const deliveredOrders = await base44.asServiceRole.entities.Order.filter({ status: "delivered" }, "-created_date", 100);

    const eligibleShipped = shippedOrders.filter((o) => new Date(o.created_date).getTime() < sevenDaysAgo);
    const toRelease = [...eligibleShipped, ...deliveredOrders];

    let released = 0;
    for (const order of toRelease) {
      const result = await transferToSeller(base44, order);
      if (result.ok) {
        released++;
        base44.asServiceRole.functions.invoke("orderNotification", { orderId: order.id, event: "released", internal_token: secrets.get("ESCROW_RELEASE_TOKEN") }).catch(() => {});
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