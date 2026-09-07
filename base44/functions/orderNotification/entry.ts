import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const BRAND = 'UKMarketStore';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { orderId, event } = payload;
    if (!orderId || !event) {
      return Response.json({ error: 'Missing orderId or event' }, { status: 400 });
    }

    const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId }, '-created_date', 1);
    const order = orders[0];
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    // Only a party to the order may trigger its notifications
    if (user.email !== order.buyer_email && user.email !== order.seller_email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const title = order.product_title || 'your item';
    const price = typeof order.price === 'number' ? `£${order.price.toFixed(2)}` : '';
    const tracking = order.tracking_number || '';

    const send = (to, subject, text) =>
      base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: text });

    if (event === 'placed') {
      await send(
        order.seller_email,
        `New order received — ${title}`,
        `Hi,\n\nYou have a new order on ${BRAND}.\n\nItem: ${title}\nSale price: ${price}\n\nPlease log in to your Seller Dashboard to add a tracking number and dispatch the item within 3 business days.\n\n${BRAND}`
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
    } else {
      return Response.json({ error: 'Unknown event' }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}