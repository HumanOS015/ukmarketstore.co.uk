import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { APP_URL, STRIPE_VERSION } from "../../shared/stripe.ts";
import { isPurchasable } from "../../shared/inventory.ts";

import { getClientIp } from "../../shared/clientIp.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    let { productId, shippingAddress } = body;

    // Checkout requires a signed-in buyer. The buyer's email is taken from the
    // verified session — never from the request body — so a stranger can't mint
    // orders or Stripe sessions under an arbitrary address.
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) {
      return Response.json({ error: "Please sign in to continue to checkout" }, { status: 401 });
    }
    const buyerEmail = me.email;

    if (!productId || !shippingAddress) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate the remaining inputs to prevent junk orders / abuse (sane product
    // id, reasonable address length). The buyer email is already verified above.
    const addressOk = typeof shippingAddress === "string" && shippingAddress.trim().length >= 6 && shippingAddress.length <= 500;
    const productIdOk = typeof productId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(productId);
    if (!addressOk || !productIdOk) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    // Fetch the product (service role — public checkout, buyer may not be logged in)
    const products = await base44.asServiceRole.entities.Product.filter({ id: productId, status: "active" });
    if (!products.length) {
      return Response.json({ error: "This item is no longer available" }, { status: 400 });
    }
    const product = products[0];

    // Multi-Marketplace Inventory Protection: final server-side availability
    // gate. A listing that is sold, sold-elsewhere, sync-locked, or out of stock
    // must never be purchasable, regardless of the frontend button state. This
    // runs on every checkout attempt so two buyers cannot buy the same item.
    if (!isPurchasable(product)) {
      return Response.json({ error: "This item is no longer available" }, { status: 400 });
    }

    // The seller must have a connected Stripe account so we can pay them when escrow releases
    const payoutAccount = (await base44.asServiceRole.entities.PayoutAccount.filter({ seller_email: product.seller_email }))[0];
    if (!payoutAccount || !payoutAccount.charges_enabled) {
      return Response.json({ error: "This seller hasn't set up payments yet" }, { status: 400 });
    }

    // Anti-abuse: although checkout now requires a signed-in buyer, the endpoint is
    // still public, so keep un-spoofable controls keyed to the caller's IP (not
    // client-supplied fields) to stop a single account/IP minting unlimited orders
    // or holding listings hostage:
    //   1. Double-sale lock — a short 5 min window reserves the item while a buyer
    //      completes Stripe checkout, without leaving it blocked for long.
    //   2. Per-IP rate limit — cap pending orders per source IP in the window.
    //   3. Per-buyer cap — secondary backstop keyed on the validated email.
    const clientIp = getClientIp(req);
    const lockWindowMs = 5 * 60 * 1000;
    const sinceIso = new Date(Date.now() - lockWindowMs).toISOString();

    // Atomic double-sale lock: claim sync_locked so only one checkout at a
    // time can run the conflict check + pending-order create for this
    // listing. The lock is held only for the critical section — once the
    // pending order exists it provides the 5-minute reservation (with
    // auto-expiry), so the lock is released immediately after. This closes
    // the check-then-create race that let two concurrent buyers both pass the
    // conflict filter and both create pending orders for one item.
    const claim = await base44.asServiceRole.entities.Product.updateMany(
      { id: product.id, sync_locked: { $ne: true } },
      { $set: { sync_locked: true } }
    ).catch(() => ({ updated: 0 }));
    if (!claim || claim.updated !== 1) {
      return Response.json({ error: "This item is currently being checked out. Please try again shortly." }, { status: 409 });
    }
    const releaseLock = () => base44.asServiceRole.entities.Product.updateMany(
      { id: product.id, sync_locked: true },
      { $set: { sync_locked: false } }
    ).catch(() => {});

    let order;
    try {
      const conflict = await base44.asServiceRole.entities.Order.filter({
        product_id: product.id,
        status: "pending_payment",
        created_date: { $gte: sinceIso }
      });
      if (conflict.length) {
        await releaseLock();
        return Response.json({ error: "This item is currently being checked out. Please try again shortly." }, { status: 409 });
      }

      let ipPending = [];
      if (clientIp && clientIp !== "unknown") {
        ipPending = await base44.asServiceRole.entities.Order.filter({
          client_ip: clientIp,
          status: "pending_payment",
          created_date: { $gte: sinceIso }
        });
        if (ipPending.length >= 5) {
          await releaseLock();
          console.warn("checkout IP rate limit hit", clientIp);
          return Response.json({ error: "Too many checkout attempts. Please try again shortly." }, { status: 429 });
        }
      }

      const buyerPending = await base44.asServiceRole.entities.Order.filter({
        buyer_email: buyerEmail,
        status: "pending_payment",
        created_date: { $gte: sinceIso }
      });
      if (buyerPending.length >= 5) {
        await releaseLock();
        return Response.json({ error: "You have too many pending orders. Please complete one before starting another." }, { status: 429 });
      }

      // Create a pending order
      const price = product.price;
      const commission = parseFloat((price * 0.1).toFixed(2));
      const sellerPayout = parseFloat((price - commission).toFixed(2));

      order = await base44.asServiceRole.entities.Order.create({
        product_id: product.id,
        product_title: product.title,
        product_image: product.image_url,
        price,
        commission,
        seller_payout: sellerPayout,
        buyer_email: buyerEmail,
        seller_email: product.seller_email,
        status: "pending_payment",
        shipping_address: shippingAddress,
        client_ip: clientIp,
      });
    } catch (e) {
      await releaseLock();
      throw e;
    }

    // The pending order now guards the reservation (5-min auto-expiry via the
    // conflict check above), so release the brief checkout lock.
    await releaseLock();

    // Escrow: the full payment lands in the platform account. The seller's 90% is transferred
    // later (on delivery confirmation or after 14 days) — NOT at checkout.
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "gbp");
    params.append("line_items[0][price_data][product_data][name]", product.title);
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(product.price * 100)));
    params.append("customer_email", buyerEmail);
    params.append("metadata[order_id]", order.id);
    params.append("metadata[product_id]", product.id);
    params.append("metadata[base44_app_id]", secrets.get("BASE44_APP_ID") || "");
    params.append("success_url", `${APP_URL}/product/${product.id}?payment=success`);
    params.append("cancel_url", `${APP_URL}/product/${product.id}?payment=cancelled`);

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secrets.get("STRIPE_SECRET_KEY")}`,
        "Stripe-Version": STRIPE_VERSION,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: params,
    });

    if (!stripeResponse.ok) {
      const errorData = await stripeResponse.json();
      console.error("Stripe error", JSON.stringify(errorData));
      await base44.asServiceRole.entities.Order.delete(order.id).catch(() => {});
      return Response.json({ error: "Failed to create checkout session" }, { status: 500 });
    }

    const session = await stripeResponse.json();

    return Response.json({ checkoutUrl: session.url, orderId: order.id });
  } catch (error) {
    console.error("createCheckoutSession error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}