import { secrets } from "base44:runtime";
import { STRIPE_VERSION } from "./stripe.ts";

// Transfers the seller's 90% payout to their Stripe Connect account.
// On success, marks the order "completed" and stores the transfer id.
// On failure, returns { ok: false, reason } without changing order status
// (caller decides how to handle — e.g. mark "delivered" for a later retry).
export async function transferToSeller(base44, order) {
  const payoutAccount = (await base44.asServiceRole.entities.PayoutAccount.filter({ seller_email: order.seller_email }))[0];
  if (!payoutAccount || !payoutAccount.charges_enabled) {
    return { ok: false, reason: "Seller payout account not ready" };
  }

  const sellerPayoutPence = Math.round(order.seller_payout * 100);
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