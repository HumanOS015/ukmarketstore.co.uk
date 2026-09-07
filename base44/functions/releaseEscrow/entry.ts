import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { transferToSeller } from "../../shared/escrow.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return Response.json({ error: "Missing orderId" }, { status: 400 });
    }

    // Buyer-confirmed delivery requires an authenticated buyer
    const authenticated = await base44.auth.isAuthenticated().catch(() => false);
    if (!authenticated) {
      return Response.json({ error: "You must be logged in" }, { status: 401 });
    }
    const me = await base44.auth.me();
    if (!me?.email) {
      return Response.json({ error: "You must be logged in" }, { status: 401 });
    }

    const order = (await base44.asServiceRole.entities.Order.filter({ id: orderId }))[0];
    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    // Only the buyer (or an admin) can confirm delivery and release escrow
    if (me.email !== order.buyer_email && me.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (order.status === "completed") {
      return Response.json({ ok: true, alreadyReleased: true });
    }

    if (!["paid", "shipped", "delivered"].includes(order.status)) {
      return Response.json({ error: `Cannot release escrow for order status: ${order.status}` }, { status: 400 });
    }

    const result = await transferToSeller(base44, order);

    if (result.ok) {
      base44.asServiceRole.functions.invoke("orderNotification", { orderId, event: "released" }).catch(() => {});
      return Response.json({ ok: true, transferId: result.transferId });
    }

    // Transfer failed (often because the platform balance hasn't settled yet) —
    // record that the buyer confirmed delivery; the daily workflow will retry the payout.
    await base44.asServiceRole.entities.Order.update(orderId, { status: "delivered" }).catch(() => {});
    return Response.json({ ok: false, delivered: true, reason: result.reason });
  } catch (error) {
    console.error("releaseEscrow error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}