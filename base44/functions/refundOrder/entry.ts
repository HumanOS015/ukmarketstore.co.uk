import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { STRIPE_VERSION } from "../../shared/stripe.ts";

// Admin-only full refund. Issues a Stripe refund against the stored PaymentIntent,
// then marks the order "refunded" and re-activates the listing so it can be resold.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return Response.json({ error: "Missing orderId" }, { status: 400 });
    }

    // Admin gate
    const authenticated = await base44.auth.isAuthenticated().catch(() => false);
    if (!authenticated) {
      return Response.json({ error: "You must be logged in" }, { status: 401 });
    }
    const me = await base44.auth.me();
    if (me?.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const order = (await base44.asServiceRole.entities.Order.filter({ id: orderId }))[0];
    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "refunded") {
      return Response.json({ ok: true, alreadyRefunded: true });
    }

    if (!order.payment_intent_id) {
      return Response.json({ error: "No payment intent on file to refund" }, { status: 400 });
    }

    // Issue the refund in Stripe
    const params = new URLSearchParams();
    params.append("payment_intent", order.payment_intent_id);
    params.append("metadata[order_id]", order.id);
    params.append("metadata[product_id]", order.product_id || "");
    params.append("metadata[base44_app_id]", secrets.get("BASE44_APP_ID") || "");

    const res = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secrets.get("STRIPE_SECRET_KEY")}`,
        "Stripe-Version": STRIPE_VERSION,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `refund_${order.id}`,
      },
      body: params,
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Refund failed for order", order.id, JSON.stringify(err));
      return Response.json({ error: err.error?.message || "Refund failed" }, { status: 502 });
    }

    const refund = await res.json();

    // Mark the order refunded and re-activate the listing.
    await base44.asServiceRole.entities.Order.update(orderId, { status: "refunded" });
    if (order.product_id) {
      await base44.asServiceRole.entities.Product.update(order.product_id, { status: "active" }).catch(() => {});
    }

    // Notify buyer + seller (non-blocking)
    base44.asServiceRole.functions.invoke("orderNotification", { orderId, event: "refunded" }).catch(() => {});

    return Response.json({ ok: true, refundId: refund.id });
  } catch (error) {
    console.error("refundOrder error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}