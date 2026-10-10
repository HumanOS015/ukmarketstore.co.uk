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

    // If escrow was already released to the seller (order "completed"), reverse the
    // transfer first so the platform reclaims the seller's 90% before refunding the
    // buyer. Without this, the platform would fund the full refund out of its own
    // balance while the seller keeps the payout. If the reversal fails (e.g. the
    // seller's Connect account has insufficient balance), proceed with the refund
    // anyway — the buyer must be made whole — and log it for admin follow-up.
    if (order.transfer_id) {
      const reverseParams = new URLSearchParams();
      reverseParams.append("amount", String(Math.round(order.seller_payout * 100)));
      const reverseRes = await fetch(`https://api.stripe.com/v1/transfers/${order.transfer_id}/reversals`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secrets.get("STRIPE_SECRET_KEY")}`,
          "Stripe-Version": STRIPE_VERSION,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": `reverse_${order.id}`,
        },
        body: reverseParams,
      });
      if (!reverseRes.ok) {
        const err = await reverseRes.json().catch(() => ({}));
        console.error("Transfer reversal failed for order", order.id, JSON.stringify(err));
      }
    }

    // Issue the refund in Stripe
    const params = new URLSearchParams();
    params.append("payment_intent", order.payment_intent_id);
    // Basket orders share one PaymentIntent, so refund only this order line total.
    // Legacy/single-item checkout keeps its existing full-refund behaviour.
    if (order.checkout_source === "basket") {
      params.append("amount", String(Math.round(Number(order.price) * 100)));
    }
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

    // Mark the order refunded. This status is the idempotency gate: the early
    // return above means a repeated refund request never reaches this point, so
    // the stock restoration below runs at most once.
    await base44.asServiceRole.entities.Order.update(orderId, { status: "refunded" });
    if (order.product_id) {
      // Basket orders had available_quantity (and the matching variation_stock
      // entry) deducted by the webhook when payment succeeded. Restore exactly
      // that quantity so the refunded units are sellable again. Single-item and
      // legacy orders (no checkout_source) keep the original "reactivate listing"
      // behaviour unchanged.
      if (order.checkout_source === "basket") {
        // Claim restoration atomically so refundOrder and Stripe webhook retries
        // cannot both increment stock for the same order.
        const claim = await base44.asServiceRole.entities.Order.updateMany(
          { id: orderId, refund_stock_restored: { $ne: true } },
          { $set: { refund_stock_restored: true } }
        ).catch(() => ({ updated: 0 }));
        if (claim?.updated === 1) {
          const qty = Number(order.quantity) || 1;
          const product = (await base44.asServiceRole.entities.Product.filter({ id: order.product_id }))[0];
          if (product) {
            const current = typeof product.available_quantity === "number"
              ? product.available_quantity
              : (product.quantity || 0);
            const update = {
              status: "active",
              available_quantity: current + qty,
            };
            if (Array.isArray(product.variation_stock) && product.variation_stock.length) {
              update.variation_stock = product.variation_stock.map((v) => {
                if ((v.size || "") === (order.size || "") && (v.colour || "") === (order.colour || "")) {
                  return { ...v, quantity: Number(v.quantity) + qty };
                }
                return v;
              });
            }
            try {
              await base44.asServiceRole.entities.Product.update(order.product_id, update);
            } catch (stockError) {
              await base44.asServiceRole.entities.Order.updateMany(
                { id: orderId, refund_stock_restored: true },
                { $set: { refund_stock_restored: false } }
              ).catch(() => {});
              throw stockError;
            }
          }
        }
      } else {
        await base44.asServiceRole.entities.Product.update(order.product_id, { status: "active" }).catch(() => {});
      }
    }

    // Notify buyer + seller (non-blocking)
    base44.asServiceRole.functions.invoke("orderNotification", { orderId, event: "refunded", internal_token: secrets.get("ESCROW_RELEASE_TOKEN") }).catch(() => {});

    return Response.json({ ok: true, refundId: refund.id });
  } catch (error) {
    console.error("refundOrder error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}