import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const BRAND = 'UKMarketStore';

// Seller-controlled strings (product title, tracking number) are interpolated into email
// subjects and bodies. Strip HTML tags, angle brackets and line breaks so a malicious seller
// can't inject deceptive links/HTML or manipulate the email structure via a product title or
// tracking number. Cap length to keep notifications readable.
const sanitizeText = (value, max = 200) => {
  if (!value) return '';
  const s = String(value)
    .replace(/<[^>]*>/g, '')      // strip HTML tags
    .replace(/[<>\r\n\t]/g, ' ')  // neutralize angle brackets & line/control chars
    .trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
};

// Internal notification function — called only by trusted backend functions (checkout
// webhook, escrow release, refund, markShipped) which run server-side. Security: every
// event must present the shared ESCROW_RELEASE_TOKEN (read from secrets by the calling
// function, never hardcoded in a file), and each event is cross-checked against the
// order's current status — which only trusted backend flows can change — so a caller
// cannot trigger a fake email for an order that never underwent that transition. The
// "shipped" event is raised only by markShipped, which enforces first-ship dedup, so a
// seller cannot invoke orderNotification directly to spam the buyer with shipping emails.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { orderId, event } = payload;
    if (!orderId || !event) {
      return Response.json({ error: 'Missing orderId or event' }, { status: 400 });
    }

    // Each event maps to an order status that only a trusted backend flow sets.
    const REQUIRED_STATUS = {
      placed: 'paid',
      shipped: 'shipped',
      delivered: 'delivered',
      released: 'completed',
      refunded: 'refunded',
    };
    const requiredStatus = REQUIRED_STATUS[event];
    if (!requiredStatus) {
      return Response.json({ error: 'Unknown event' }, { status: 400 });
    }

    // Every event is raised only by a trusted backend function, which presents the shared
    // internal token. Auth is verified BEFORE any database lookup so unauthorized callers
    // (including a seller trying to re-trigger "shipped") can't probe order ids.
    if (!payload.internal_token || payload.internal_token !== secrets.get('ESCROW_RELEASE_TOKEN')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId }, '-created_date', 1);
    const order = orders[0];
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    if (order.status !== requiredStatus) {
      return Response.json({ error: 'Order status does not match event' }, { status: 409 });
    }

    // "shipped" notification dedup is enforced upstream in markShipped (only sent on the
    // first paid -> shipped transition). Requiring the internal token here means a seller
    // cannot bypass that by invoking orderNotification directly.

    const title = sanitizeText(order.product_title, 200) || 'your item';
    const price = typeof order.price === 'number' ? `£${order.price.toFixed(2)}` : '';
    const payout = typeof order.seller_payout === 'number' ? `£${order.seller_payout.toFixed(2)}` : '';
    const tracking = sanitizeText(order.tracking_number, 200);

    const send = (to, subject, text) =>
      base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: text });

    if (event === 'placed') {
      await send(
        order.seller_email,
        `New order received — ${title}`,
        `Hi,\n\nYou have a new order on ${BRAND}.\n\nItem: ${title}\nSale price: ${price}\n\nPlease log in to your Seller Dashboard to add a tracking number and dispatch the item within 3 business days.\n\nYour payment is held safely in escrow and will be released once the buyer confirms delivery (or automatically after 7 days).\n\n${BRAND}`
      );
      await send(
        order.buyer_email,
        `Order confirmed — ${title}`,
        `Hi,\n\nThank you for your purchase on ${BRAND}.\n\nItem: ${title}\nPrice: ${price}\n\nYour payment is held securely in escrow and will only be released to the seller once you confirm delivery. The seller will dispatch your item shortly.\n\n${BRAND}`
      );
    } else if (event === 'shipped') {
      await send(
        order.buyer_email,
        `Your order has shipped — ${title}`,
        `Hi,\n\nGood news — your item is on its way.\n\nItem: ${title}\nTracking: ${tracking}\n\nOnce you receive it, please confirm delivery in your Orders page so the seller can be paid.\n\n${BRAND}`
      );
    } else if (event === 'delivered') {
      await send(
        order.seller_email,
        `Order delivered — ${title}`,
        `Hi,\n\nThe buyer has confirmed delivery of their order.\n\nItem: ${title}\nSale price: ${price}\n\nFunds (minus the 10% commission) are being released to your account.\n\n${BRAND}`
      );
    } else if (event === 'released') {
      await send(
        order.seller_email,
        `Funds released — ${title}`,
        `Hi,\n\nThe escrow funds for your sale have been released to your Stripe account.\n\nItem: ${title}\nAmount paid to you (90%): ${payout}\n\nThis will arrive in your bank account per your Stripe payout schedule.\n\n${BRAND}`
      );
      await send(
        order.buyer_email,
        `Delivery confirmed — ${title}`,
        `Hi,\n\nThank you for confirming delivery of your order.\n\nItem: ${title}\nThe seller has been paid and your transaction is complete.\n\n${BRAND}`
      );
    } else if (event === 'refunded') {
      await send(
        order.buyer_email,
        `Refund issued — ${title}`,
        `Hi,\n\nA refund of ${price} has been issued for your order.\n\nItem: ${title}\n\nThe funds will appear back on your card within 5–10 business days, depending on your bank.\n\n${BRAND}`
      );
      await send(
        order.seller_email,
        `Order refunded — ${title}`,
        `Hi,\n\nThe order below has been refunded and the listing re-activated.\n\nItem: ${title}\n\nIf you already dispatched the item, please contact the courier to attempt recovery.\n\n${BRAND}`
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("orderNotification error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}