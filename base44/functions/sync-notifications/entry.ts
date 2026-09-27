import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });

    const email = user.email;
    const existing = await base44.asServiceRole.entities.Notification.filter({ user_email: email }, "-created_date", 500);
    const keys = new Set((existing || []).map((n) => n.source_key));
    const notifications: any[] = [];

    const add = (source_key: string, type: string, title: string, message: string, link: string) => {
      if (!keys.has(source_key)) notifications.push({ user_email: email, type, title, message, link, source_key, read: false });
    };

    const orders = await base44.asServiceRole.entities.Order.filter(
      { $or: [{ buyer_email: email }, { seller_email: email }] },
      "-updated_date",
      100
    ).catch(() => []);

    for (const order of orders || []) {
      const isBuyer = order.buyer_email === email;
      const role = isBuyer ? "buyer" : "seller";
      const status = order.status || "";
      const item = order.product_title || "your item";
      const updated = order.updated_date || order.created_date || order.id;
      const source = `order:${order.id}:status:${status}:${updated}:${role}`;

      if (status === "paid") add(source, "order", isBuyer ? "Payment confirmed" : "New sale", isBuyer ? `Your payment for ${item} has been received.` : `${item} has sold. Prepare the order for dispatch.`, "/orders");
      if (status === "shipped" && isBuyer) add(source, "shipping", "Your order has shipped", `${item} has been marked as shipped.`, "/orders");
      if (status === "delivered" && isBuyer) add(source, "delivery", "Order delivered", `${item} has been marked as delivered.`, "/orders");
      if (status === "completed") add(source, "order", isBuyer ? "Order completed" : "Sale completed", isBuyer ? `${item} is now complete.` : `Your sale of ${item} is complete and the payout can be released.`, "/orders");
      if (status === "refunded") add(source, "refund", "Refund issued", `The order for ${item} has been refunded.`, "/orders");
      if (status === "disputed") add(source, "dispute", "Order needs attention", `There is a dispute relating to ${item}.`, "/orders");
    }

    const messages = await base44.asServiceRole.entities.SellerMessage.filter(
      { recipient_email: email },
      "-created_date",
      100
    ).catch(() => []);
    for (const msg of messages || []) {
      const source = `message:${msg.id}`;
      add(source, "message", "New message", "You have a new message from a buyer or seller.", `/messages?conversation=${msg.conversation_id}`);
    }

    const listings = await base44.asServiceRole.entities.Product.filter({ seller_email: email }, "-updated_date", 100).catch(() => []);
    for (const listing of listings || []) {
      if (listing.status === "active") {
        const source = `listing:${listing.id}:active:${listing.updated_date || listing.created_date || listing.id}`;
        add(source, "listing", "Listing is live", `${listing.title || "Your listing"} is now live and available to buyers.`, `/product/${listing.id}`);
      }
      if (listing.status === "pending_stripe") {
        const source = `listing:${listing.id}:pending_stripe:${listing.updated_date || listing.created_date || listing.id}`;
        add(source, "payout", "Stripe setup required", `${listing.title || "Your listing"} is saved but needs Stripe payout setup before it can go live.`, "/seller-dashboard");
      }
    }

    for (const notification of notifications) {
      await base44.asServiceRole.entities.Notification.create(notification);
    }

    return Response.json({ success: true, created: notifications.length });
  } catch (error) {
    console.error("sync-notifications failed", error);
    return Response.json({ error: error?.message || "Unable to sync notifications" }, { status: 500 });
  }
});