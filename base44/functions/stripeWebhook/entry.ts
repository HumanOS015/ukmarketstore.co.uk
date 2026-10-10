import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

async function verifyStripeSignature(body, signature, secret) {
  const parts = signature.split(",");
  const timestampPart = parts.find(p => p.startsWith("t="));
  const sigPart = parts.find(p => p.startsWith("v1="));

  if (!timestampPart || !sigPart) {
    throw new Error("Invalid signature format");
  }

  const timestamp = timestampPart.split("=")[1];
  const sig = sigPart.split("=")[1];

  // Check timestamp tolerance (5 minutes)
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (age > 300) {
    throw new Error("Timestamp too old");
  }

  const signedPayload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedSig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  if (expectedHex !== sig) {
    throw new Error("Signature mismatch");
  }

  return JSON.parse(body);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    const webhookSecret = secrets.get("STRIPE_WEBHOOK_SECRET");

    if (!signature || !webhookSecret) {
      console.error("Missing signature or webhook secret");
      return Response.json({ error: "Webhook not configured" }, { status: 500 });
    }

    let event;
    try {
      event = await verifyStripeSignature(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed", err.message);
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Basket checkout: one session, multiple orders (one per line item).
        // Each order records its size/colour/quantity; stock is reduced per order
        // and the listing is marked sold only when it reaches zero.
        if (session.metadata?.order_ids) {
          let orderIds = [];
          try { orderIds = JSON.parse(session.metadata.order_ids); } catch { orderIds = []; }
          for (const orderId of orderIds) {
            const order = (await base44.asServiceRole.entities.Order.filter({ id: orderId }))[0];
            if (!order) continue;
            // Idempotency: a duplicate webhook delivery must not reduce stock or
            // re-run side effects twice. Once an order is "paid" it's fully processed.
            if (order.status === "paid") continue;
            const qty = Number(order.quantity) || 1;
            const product = (await base44.asServiceRole.entities.Product.filter({ id: order.product_id }))[0];
            if (product) {
              const current = typeof product.available_quantity === "number"
                ? product.available_quantity
                : (product.quantity || 1);
              const newQty = Math.max(0, current - qty);
              const update = {
                available_quantity: newQty,
                status: newQty <= 0 ? "sold" : product.status,
              };
              // Decrement the matching variation_stock entry so a sold size/colour
              // can't be bought again. Without this, getVariationStock would keep
              // returning the pre-sale per-variation quantity and allow overselling.
              if (Array.isArray(product.variation_stock) && product.variation_stock.length) {
                update.variation_stock = product.variation_stock.map((v) => {
                  if ((v.size || "") === (order.size || "") && (v.colour || "") === (order.colour || "")) {
                    return { ...v, quantity: Math.max(0, Number(v.quantity) - qty) };
                  }
                  return v;
                });
              }
              await base44.asServiceRole.entities.Product.update(product.id, update);
            }
            await base44.asServiceRole.entities.Order.update(orderId, {
              status: "paid",
              payment_intent_id: session.payment_intent || null,
            });
            base44.asServiceRole.functions.invoke("processUkmsSale", {
              productId: order.product_id, orderId,
              internal_token: secrets.get("ESCROW_RELEASE_TOKEN")
            }).catch((e) => console.error("processUkmsSale failed", e));
            base44.asServiceRole.functions.invoke("orderNotification", {
              orderId, event: "placed", internal_token: secrets.get("ESCROW_RELEASE_TOKEN")
            }).catch(() => {});
          }
          break;
        }

        // Existing single-item checkout path (unchanged)
        const orderId = session.metadata?.order_id;
        const productId = session.metadata?.product_id;

        if (orderId) {
          // Mark paid and store the PaymentIntent id (needed for refunds later)
          await base44.asServiceRole.entities.Order.update(orderId, {
            status: "paid",
            payment_intent_id: session.payment_intent || null,
          });

          if (productId) {
            await base44.asServiceRole.entities.Product.update(productId, { status: "sold" });
          }

          // Multi-Marketplace Inventory Protection: a UKMS sale must propagate to
          // any connected external marketplace listings so the same physical item
          // can't be sold twice. Non-blocking — never blocks the webhook response,
          // and never makes real external API calls (only records pending state).
          if (productId) {
            base44.asServiceRole.functions.invoke("processUkmsSale", {
              productId,
              orderId,
              internal_token: secrets.get("ESCROW_RELEASE_TOKEN")
            }).catch((e) => {
              console.error("processUkmsSale failed", e);
            });
          }

          // Notify seller + buyer (non-blocking)
          base44.asServiceRole.functions.invoke("orderNotification", { orderId, event: "placed", internal_token: secrets.get("ESCROW_RELEASE_TOKEN") }).catch(() => {});
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntentId = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
        const refundRows = Array.isArray(charge.refunds?.data) ? charge.refunds.data : [];
        const refundOrderId = refundRows.map((r) => r.metadata?.order_id).find(Boolean);
        const relatedOrders = paymentIntentId
          ? await base44.asServiceRole.entities.Order.filter({ payment_intent_id: paymentIntentId })
          : [];
        const fullChargeRefund = Number(charge.amount) > 0 && Number(charge.amount_refunded) >= Number(charge.amount);
        let targetOrders = [];

        // Admin-issued basket refunds attach order_id to the Refund. A full refund
        // made directly in Stripe applies to every order line paid by this session.
        if (fullChargeRefund && relatedOrders.length) {
          targetOrders = relatedOrders;
        } else {
          const explicitOrderId = refundOrderId || charge.metadata?.order_id;
          if (explicitOrderId) {
            targetOrders = relatedOrders.filter((o) => o.id === explicitOrderId);
            if (!targetOrders.length) {
              const exact = (await base44.asServiceRole.entities.Order.filter({ id: explicitOrderId }))[0];
              if (exact) targetOrders = [exact];
            }
          } else if (relatedOrders.length === 1) {
            targetOrders = relatedOrders;
          } else if (relatedOrders.length > 1) {
            // A partial dashboard refund cannot safely be assigned to one basket
            // line without refund metadata. Do not guess which stock to restore.
            console.error("Partial Stripe refund needs order metadata; stock was not changed", paymentIntentId);
          }
        }

        for (const order of targetOrders) {
          const wasAlreadyRefunded = order.status === "refunded";
          if (order.checkout_source === "basket") {
            // Shared idempotency marker prevents both this webhook and refundOrder
            // from restoring the same basket line twice.
            const claim = await base44.asServiceRole.entities.Order.updateMany(
              { id: order.id, refund_stock_restored: { $ne: true } },
              { $set: { refund_stock_restored: true } }
            ).catch(() => ({ updated: 0 }));
            if (claim?.updated === 1) {
              const product = (await base44.asServiceRole.entities.Product.filter({ id: order.product_id }))[0];
              if (product) {
                const qty = Number(order.quantity) || 1;
                const current = typeof product.available_quantity === "number"
                  ? product.available_quantity
                  : (product.quantity || 0);
                const update = { status: "active", available_quantity: current + qty };
                if (Array.isArray(product.variation_stock) && product.variation_stock.length) {
                  update.variation_stock = product.variation_stock.map((v) => {
                    if ((v.size || "") === (order.size || "") && (v.colour || "") === (order.colour || "")) {
                      return { ...v, quantity: Number(v.quantity) + qty };
                    }
                    return v;
                  });
                }
                try {
                  await base44.asServiceRole.entities.Product.update(product.id, update);
                } catch (stockError) {
                  await base44.asServiceRole.entities.Order.updateMany(
                    { id: order.id, refund_stock_restored: true },
                    { $set: { refund_stock_restored: false } }
                  ).catch(() => {});
                  throw stockError;
                }
              }
            }
          } else if (order.product_id) {
            await base44.asServiceRole.entities.Product.update(order.product_id, { status: "active" });
          }
          if (!wasAlreadyRefunded) {
            await base44.asServiceRole.entities.Order.update(order.id, { status: "refunded" });
            base44.asServiceRole.functions.invoke("orderNotification", { orderId: order.id, event: "refunded", internal_token: secrets.get("ESCROW_RELEASE_TOKEN") }).catch(() => {});
          }
        }
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object;
        const orderId = dispute.metadata?.order_id;
        if (orderId) {
          await base44.asServiceRole.entities.Order.update(orderId, { status: "disputed" });
        }
        break;
      }
      case "account.updated": {
        // Sync the seller's Connect account status from Stripe
        const acct = event.data.object;
        const email = acct.metadata?.seller_email;
        if (email) {
          const accounts = await base44.asServiceRole.entities.PayoutAccount.filter({ seller_email: email });
          if (accounts[0]) {
            await base44.asServiceRole.entities.PayoutAccount.update(accounts[0].id, {
              charges_enabled: acct.charges_enabled || false,
              payouts_enabled: acct.payouts_enabled || false,
              details_submitted: acct.details_submitted || false,
            });
          }

          // The seller just finished onboarding — activate any listings they
          // saved before payouts were connected so they go live immediately.
          if (acct.charges_enabled) {
            try {
              const pendingListings = await base44.asServiceRole.entities.Product.filter({
                seller_email: email,
                status: "pending_stripe",
              });
              for (const listing of pendingListings) {
                await base44.asServiceRole.entities.Product.update(listing.id, { status: "active" });
              }
            } catch (activationError) {
              console.error("Failed to activate pending listings on account.updated", activationError);
            }
          }
        }
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("stripeWebhook error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}