import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { APP_URL, STRIPE_VERSION } from "../../shared/stripe.ts";
import { isPurchasable } from "../../shared/inventory.ts";
import { getClientIp } from "../../shared/clientIp.ts";

// Basket checkout: creates ONE Stripe Checkout session for multiple basket
// items (possibly from different sellers), with ONE Order per item so the
// existing per-order escrow/release flow is reused unchanged. Each order
// records the selected size, colour, and quantity. The Stripe session
// metadata carries the list of order ids so the webhook can mark them all paid.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { items, shippingAddress } = body;

    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) {
      return Response.json({ error: "Please sign in to continue to checkout" }, { status: 401 });
    }
    const buyerEmail = me.email;

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: "Your basket is empty" }, { status: 400 });
    }
    if (items.length > 20) {
      return Response.json({ error: "Basket is too large. Please remove some items." }, { status: 400 });
    }
    if (typeof shippingAddress !== "string" || shippingAddress.trim().length < 6) {
      return Response.json({ error: "Missing shipping address" }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const clientIp = getClientIp(req);
    const lockWindowMs = 5 * 60 * 1000;
    const sinceIso = new Date(Date.now() - lockWindowMs).toISOString();

    // Per-buyer pending-order cap
    const buyerPending = await svc.entities.Order.filter({
      buyer_email: buyerEmail, status: "pending_payment", created_date: { $gte: sinceIso }
    });
    if (buyerPending.length + items.length > 20) {
      return Response.json({ error: "You have too many pending orders. Please complete one before starting another." }, { status: 429 });
    }

    // Resolve + validate every item.
    const productCache = new Map();
    const lineItems = [];

    for (const item of items) {
      if (typeof item.productId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(item.productId)) {
        return Response.json({ error: "Invalid item in basket" }, { status: 400 });
      }
      const qty = Math.max(1, Math.min(parseInt(item.quantity) || 1, 99));
      const size = typeof item.size === "string" && item.size ? item.size.slice(0, 32) : null;
      const colour = typeof item.colour === "string" && item.colour ? item.colour.slice(0, 32) : null;

      let product = productCache.get(item.productId);
      if (!product) {
        const products = await svc.entities.Product.filter({ id: item.productId, status: "active" });
        if (!products.length) {
          return Response.json({ error: "An item in your basket is no longer available" }, { status: 400 });
        }
        product = products[0];
        productCache.set(item.productId, product);
      }

      if (!isPurchasable(product)) {
        return Response.json({ error: `"${product.title}" is no longer available` }, { status: 400 });
      }

      // Validate variation selection against configured options
      if (product.size_enabled && Array.isArray(product.sizes) && product.sizes.length > 0) {
        if (!size || !product.sizes.includes(size)) {
          return Response.json({ error: `Please select a size for "${product.title}"` }, { status: 400 });
        }
      }
      if (product.colour_enabled && Array.isArray(product.colours) && product.colours.length > 0) {
        if (!colour || !product.colours.includes(colour)) {
          return Response.json({ error: `Please select a colour for "${product.title}"` }, { status: 400 });
        }
      }

      // Stock check (variation-level if available, else product-level)
      let stock;
      if (product.variation_stock && product.variation_stock.length) {
        const match = product.variation_stock.find(
          (v) => (v.size || "") === (size || "") && (v.colour || "") === (colour || "")
        );
        stock = match ? Number(match.quantity) : (typeof product.available_quantity === "number" ? product.available_quantity : product.quantity);
      } else {
        stock = typeof product.available_quantity === "number" ? product.available_quantity : product.quantity;
      }
      if (stock <= 0 || qty > stock) {
        return Response.json({ error: `Only ${stock} of "${product.title}" available` }, { status: 400 });
      }

      // Seller must have payouts connected
      const payoutAccount = (await svc.entities.PayoutAccount.filter({ seller_email: product.seller_email }))[0];
      if (!payoutAccount || !payoutAccount.charges_enabled) {
        return Response.json({ error: `The seller of "${product.title}" hasn't set up payments yet` }, { status: 400 });
      }

      const price = Number(product.price);
      const commission = parseFloat((price * 0.1).toFixed(2));
      const sellerPayout = parseFloat((price - commission).toFixed(2));

      lineItems.push({ product, qty, size, colour, price, commission, sellerPayout });
    }

    // Atomic lock: claim sync_locked on every distinct product so concurrent
    // checkouts can't double-sell. Release on any failure.
    const lockedProductIds = new Set();
    for (const li of lineItems) {
      if (lockedProductIds.has(li.product.id)) continue;
      const claim = await svc.entities.Product.updateMany(
        { id: li.product.id, sync_locked: { $ne: true } },
        { $set: { sync_locked: true } }
      ).catch(() => ({ updated: 0 }));
      if (!claim || claim.updated !== 1) {
        for (const pid of lockedProductIds) {
          await svc.entities.Product.updateMany({ id: pid, sync_locked: true }, { $set: { sync_locked: false } }).catch(() => {});
        }
        return Response.json({ error: "An item is being checked out by another buyer. Please try again shortly." }, { status: 409 });
      }
      lockedProductIds.add(li.product.id);
    }
    const releaseAllLocks = () => Promise.all(
      [...lockedProductIds].map((pid) =>
        svc.entities.Product.updateMany({ id: pid, sync_locked: true }, { $set: { sync_locked: false } }).catch(() => {})
      )
    );

    let orderIds = [];
    try {
      // Conflict check: no other pending order for the same product in the window
      for (const li of lineItems) {
        const conflict = await svc.entities.Order.filter({
          product_id: li.product.id, status: "pending_payment", created_date: { $gte: sinceIso }
        });
        if (conflict.length) {
          await releaseAllLocks();
          return Response.json({ error: `"${li.product.title}" is being checked out. Please try again shortly."` }, { status: 409 });
        }
      }

      // Create one pending order per line item, recording the selected variation
      for (const li of lineItems) {
        const order = await svc.entities.Order.create({
          product_id: li.product.id,
          product_title: li.product.title,
          product_image: li.product.image_url,
          price: li.price * li.qty,
          commission: li.commission * li.qty,
          seller_payout: li.sellerPayout * li.qty,
          buyer_email: buyerEmail,
          seller_email: li.product.seller_email,
          status: "pending_payment",
          shipping_address: shippingAddress,
          client_ip: clientIp,
          size: li.size,
          colour: li.colour,
          quantity: li.qty,
          checkout_source: "basket",
        });
        orderIds.push(order.id);
      }
    } catch (e) {
      await releaseAllLocks();
      throw e;
    }

    // Build the Stripe session with one line item per order
    const params = new URLSearchParams();
    params.append("mode", "payment");
    lineItems.forEach((li, i) => {
      params.append(`line_items[${i}][quantity]`, String(li.qty));
      params.append(`line_items[${i}][price_data][currency]`, "gbp");
      params.append(`line_items[${i}][price_data][product_data][name]`, li.product.title.slice(0, 200));
      params.append(`line_items[${i}][price_data][unit_amount]`, String(Math.round(li.price * 100)));
    });
    params.append("customer_email", buyerEmail);
    params.append("metadata[order_ids]", JSON.stringify(orderIds));
    params.append("metadata[base44_app_id]", secrets.get("BASE44_APP_ID") || "");
    params.append("metadata[checkout_source]", "basket");
    params.append("success_url", `${APP_URL}/orders?payment=success`);
    params.append("cancel_url", `${APP_URL}/basket?payment=cancelled`);

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
      console.error("Stripe basket checkout error", JSON.stringify(errorData));
      for (const oid of orderIds) {
        await svc.entities.Order.delete(oid).catch(() => {});
      }
      await releaseAllLocks();
      return Response.json({ error: "Failed to create checkout session" }, { status: 500 });
    }

    const session = await stripeResponse.json();
    await releaseAllLocks();

    return Response.json({ checkoutUrl: session.url, orderIds });
  } catch (error) {
    console.error("createBasketCheckout error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}