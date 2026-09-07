import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Seller marks an order as shipped and attaches a tracking number.
// This is the ONLY path that transitions an order to "shipped" from the client —
// the Order entity's update RLS is admin-only, so a seller cannot set the status
// directly via the SDK (which would let them bypass escrow by forcing "delivered"
// and triggering the auto-release payout without buyer confirmation).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { orderId, trackingNumber } = body;

    if (!orderId || typeof trackingNumber !== "string" || trackingNumber.trim().length < 2 || trackingNumber.length > 200) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
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

    if (me.email !== order.seller_email && me.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (order.status !== "paid" && order.status !== "shipped") {
      return Response.json({ error: `Cannot ship an order that is ${order.status}` }, { status: 400 });
    }

    // Only notify the buyer on the first ship (paid -> shipped). Re-calling this to
    // update a tracking number must not re-send the shipping email, which prevents a
    // seller from spamming the buyer with duplicate "Your order has shipped" emails.
    const isFirstShip = order.status === "paid";

    await base44.asServiceRole.entities.Order.update(orderId, {
      tracking_number: trackingNumber.trim(),
      status: "shipped",
    });

    if (isFirstShip) {
      base44.asServiceRole.functions.invoke("orderNotification", { orderId, event: "shipped" }).catch(() => {});
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("markShipped error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}