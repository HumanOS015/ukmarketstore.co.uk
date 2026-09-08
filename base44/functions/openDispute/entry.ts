import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from "base44:runtime";

// Buyer opens a dispute on an active order. This is the ONLY client path that sets an order
// to "disputed" — Order update RLS is admin-only, so buyers can't change status directly.
// The dispute reason is recorded on the order and the admin is notified. Escrow payout is
// paused because autoReleaseEscrow only releases "shipped"/"delivered" orders, not "disputed".
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { orderId, reason } = body;

    if (!orderId || typeof reason !== "string" || reason.trim().length < 5 || reason.length > 1000) {
      return Response.json({ error: "Please describe the issue (5–1000 characters)" }, { status: 400 });
    }

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
    if (me.email !== order.buyer_email && me.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (order.status === "disputed") {
      return Response.json({ error: "A dispute is already open for this order" }, { status: 400 });
    }
    if (!["paid", "shipped", "delivered"].includes(order.status)) {
      return Response.json({ error: "You can only dispute an active order" }, { status: 400 });
    }

    await base44.asServiceRole.entities.Order.update(orderId, {
      status: "disputed",
      description: `Dispute opened by buyer: ${reason.trim()}`,
    });

    // Notify the platform admin so the dispute is reviewed promptly
    base44.asServiceRole.integrations.Core.SendEmail({
      to: "ukmarketstore@hotmail.com",
      subject: `Dispute opened — ${order.product_title || "order"}`,
      body: `A buyer has opened a dispute.\n\nItem: ${order.product_title}\nBuyer: ${order.buyer_email}\nSeller: ${order.seller_email}\nPrice: £${order.price}\nReason: ${reason.trim()}\n\nReview the order in the Admin panel.`,
    }).catch(() => {});

    return Response.json({ ok: true });
  } catch (error) {
    console.error("openDispute error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}