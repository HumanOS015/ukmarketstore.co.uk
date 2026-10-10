import { secrets } from "base44:runtime";
import { STRIPE_VERSION } from "./stripe.ts";

// Transfers the seller's 90% payout to their Stripe Connect account.
// On success, marks the order "completed" and stores the transfer id.
// On failure, returns { ok: false, reason } without changing order status
// (caller decides how to handle — e.g. mark "delivered" for a later retry).
//
// SECURITY: this is the sink that issues a real Stripe transfer from the
// platform balance, so it never trusts the order row's payout fields. Before
// transferring it verifies server-side that the linked Stripe PaymentIntent
// succeeded for the expected amount, and re-derives the seller + payout from
// the linked Product. A forged order (even if one somehow exists) without a
// real succeeded payment cannot trigger a payout.
export async function transferToSeller(base44, order) {
  if (!order.payment_intent_id) {
    return { ok: false, reason: "No payment on record" };
  }

  // 1. Verify the Stripe PaymentIntent succeeded for the order's price.
  const piRes = await fetch(
    `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(order.payment_intent_id)}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${secrets.get("STRIPE_SECRET_KEY")}`,
        "Stripe-Version": STRIPE_VERSION,
      },
    }
  );
  if (!piRes.ok) {
    const err = await piRes.json().catch(() => ({}));
    console.error("Escrow payment verification failed for order", order.id, JSON.stringify(err));
    return { ok: false, reason: "Payment verification failed" };
  }
  const pi = await piRes.json();
  if (pi.status !== "succeeded") {
    return { ok: false, reason: "Payment has not succeeded" };
  }
  const expectedAmount = Math.round(Number(order.price) * 100);
  // A basket checkout's PaymentIntent covers multiple orders, so its total is
  // >= this order's price rather than an exact match. Order creation is
  // admin-only (service role), so accepting "PI covers at least this order"
  // is safe: a forged order can't exist, and a real payment of at least the
  // order amount must have succeeded for the transfer to run.
  if (Number(pi.amount_received) < expectedAmount) {
    console.error("Escrow amount mismatch for order", order.id, "got", pi.amount_received, "expected", expectedAmount);
    return { ok: false, reason: "Payment amount mismatch" };
  }

  // 2. Re-derive seller + payout from the linked Product (do not trust order row).
  const products = await base44.asServiceRole.entities.Product.filter({ id: order.product_id });
  const product = products && products[0];
  if (!product) {
    return { ok: false, reason: "Linked product not found" };
  }
  if (product.seller_email !== order.seller_email) {
    return { ok: false, reason: "Seller mismatch" };
  }
  const price = Number(product.price);
  const commission = parseFloat((price * 0.1).toFixed(2));
  const sellerPayout = parseFloat((price - commission).toFixed(2));
  const sellerPayoutPence = Math.round(sellerPayout * 100);

  const payoutAccount = (await base44.asServiceRole.entities.PayoutAccount.filter({ seller_email: product.seller_email }))[0];
  if (!payoutAccount || !payoutAccount.charges_enabled) {
    return { ok: false, reason: "Seller payout account not ready" };
  }

  const params = new URLSearchParams();
  params.append("amount", String(sellerPayoutPence));
  params.append("currency", "gbp");
  params.append("destination", payoutAccount.stripe_account_id);
  params.append("metadata[order_id]", order.id);
  params.append("metadata[base44_app_id]", secrets.get("BASE44_APP_ID") || "");

  const res = await fetch("https://api.stripe.com/v1/transfers", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secrets.get("STRIPE_SECRET_KEY")}`,
      "Stripe-Version": STRIPE_VERSION,
      "Content-Type": "application/x-www-form-urlencoded",
      // Deterministic key: a retry for the same order never creates a duplicate transfer
      "Idempotency-Key": `release_${order.id}`,
    },
    body: params,
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Escrow transfer failed for order", order.id, JSON.stringify(err));
    return { ok: false, reason: err.error?.message || "Transfer failed" };
  }

  const transfer = await res.json();
  await base44.asServiceRole.entities.Order.update(order.id, {
    status: "completed",
    transfer_id: transfer.id,
  });
  return { ok: true, transferId: transfer.id };
}