import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { APP_URL, STRIPE_VERSION } from "../../shared/stripe.ts";

// Extract the caller's IP from trusted ingress headers. Used for un-spoofable
// rate limiting on the public checkout path — a client-supplied buyer_email can
// be rotated freely, so it is not a safe throttle key.
function getClientIp(req) {
  const get = req?.headers?.get?.bind(req.headers);
  const real = get?.("x-real-ip");
  if (real) return real.trim();
  const fwd = get?.("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

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

    // Anti-abuse for public guest checkout (login is not required, so the endpoint
    // is intentionally reachable). Controls are keyed to UN-SPOOFABLE signals (the
    // caller's IP from the trusted ingress), not client-supplied fields, so an
    // attacker can't mint unlimited orders / Stripe sessions or hold listings
    // hostage by rotating buyer_email values:
    //   1. Double-sale lock — a short 5 min window reserves the item while a buyer
    //      completes Stripe checkout, without leaving it blocked for long.
    //   2. Per-IP rate limit — cap pending orders per source IP in the window.
    //   3. Per-buyer cap — secondary backstop keyed on the validated email.
    const clientIp = getClientIp(req);
    const lockWindowMs = 5 * 60 * 1000;
    const sinceIso = new Date(Date.now() - lockWindowMs).toISOString();

    const conflict = await base44.asServiceRole.entities.Order.filter({
      product_id: product.id,
      status: "pending_payment",
      created_date: { $gte: sinceIso }
    });
    if (conflict.length) {
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
      client_ip: clientIp,
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