import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { APP_URL, STRIPE_VERSION } from "../../shared/stripe.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Caller verification for public guest checkout: a shared secret
    // (CHECKOUT_CLIENT_TOKEN) that only the app's own checkout page sends.
    // Rejects raw/anonymous calls to this public URL. Checkout returns 401
    // until CHECKOUT_CLIENT_TOKEN is set (Settings → Secrets) to the exact
    // value embedded in the checkout page.
    const expectedToken = secrets.get("CHECKOUT_CLIENT_TOKEN");
    if (typeof body.checkout_token !== "string" || body.checkout_token !== expectedToken) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let { productId, buyerEmail, shippingAddress } = body;

    // Public guest checkout: authentication is optional. If the buyer is logged in and
    // didn't supply an email, use their verified account email. Inputs are strictly
    // validated below regardless of auth state.
    const authenticated = await base44.auth.isAuthenticated().catch(() => false);
    if (authenticated && !buyerEmail) {
      const me = await base44.auth.me().catch(() => null);
      if (me?.email) buyerEmail = me.email;
    }

    if (!productId || !buyerEmail || !shippingAddress) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Public, no-login checkout — the endpoint is reachable by anyone, so strictly
    // validate the inputs to prevent junk orders / abuse (email format, reasonable
    // length caps, sane product id). This guards the database and Stripe account.
    const emailOk = typeof buyerEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail) && buyerEmail.length <= 254;
    const addressOk = typeof shippingAddress === "string" && shippingAddress.trim().length >= 6 && shippingAddress.length <= 500;
    const productIdOk = typeof productId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(productId);
    if (!emailOk || !addressOk || !productIdOk) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    // Fetch the product (service role — public checkout, buyer may not be logged in)
    const products = await base44.asServiceRole.entities.Product.filter({ id: productId, status: "active" });
    if (!products.length) {
      return Response.json({ error: "This item is no longer available" }, { status: 400 });
    }
    const product = products[0];

    // The seller must have a connected Stripe account so we can pay them when escrow releases
    const payoutAccount = (await base44.asServiceRole.entities.PayoutAccount.filter({ seller_email: product.seller_email }))[0];
    if (!payoutAccount || !payoutAccount.charges_enabled) {
      return Response.json({ error: "This seller hasn't set up payments yet" }, { status: 400 });
    }

    // Anti-abuse for public guest checkout (login is not required by this app, so
    // the endpoint is intentionally reachable). These checks neutralise the
    // "create unlimited orders / Stripe sessions" vector without blocking
    // legitimate one-off buyers:
    //   1. Double-sale lock — if another buyer already has a pending_payment order
    //      for this item in the last 15 minutes, refuse (closes the race window).
    //   2. Per-buyer rate limit — cap pending orders per buyer in the same window.
    const lockWindowMs = 15 * 60 * 1000;
    const sinceIso = new Date(Date.now() - lockWindowMs).toISOString();

    const conflict = await base44.asServiceRole.entities.Order.filter({
      product_id: product.id,
      status: "pending_payment",
      created_date: { $gte: sinceIso }
    });
    if (conflict.length) {
      return Response.json({ error: "This item is currently being checked out. Please try again shortly." }, { status: 409 });
    }

    const buyerPending = await base44.asServiceRole.entities.Order.filter({
      buyer_email: buyerEmail,
      status: "pending_payment",
      created_date: { $gte: sinceIso }
    });
    if (buyerPending.length >= 5) {
      return Response.json({ error: "You have too many pending orders. Please complete one before starting another." }, { status: 429 });
    }

    // Create a pending order
    const price = product.price;
    const commission = parseFloat((price * 0.1).toFixed(2));
    const sellerPayout = parseFloat((price - commission).toFixed(2));

    const order = await base44.asServiceRole.entities.Order.create({
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
    });

    // Escrow: the full payment lands in the platform account. The seller's 90% is transferred
    // later (on delivery confirmation or after 14 days) — NOT at checkout.
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "gbp");
    params.append("line_items[0][price_data][product_data][name]", product.title);
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(price * 100)));
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