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

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orderId = session.metadata?.order_id;
        const productId = session.metadata?.product_id;

        if (orderId) {
          // Update order to paid
          await base44.asServiceRole.entities.Order.update(orderId, { status: "paid" });

          // Mark product as sold
          if (productId) {
            await base44.asServiceRole.entities.Product.update(productId, { status: "sold" });
          }

          // Send notification email (non-blocking)
          base44.asServiceRole.functions.invoke("orderNotification", { orderId, event: "placed" }).catch(() => {});
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        const orderId = charge.metadata?.order_id;
        const productId = charge.metadata?.product_id;
        if (orderId) {
          await base44.asServiceRole.entities.Order.update(orderId, { status: "refunded" });
          if (productId) {
            await base44.asServiceRole.entities.Product.update(productId, { status: "active" });
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
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("stripeWebhook error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}