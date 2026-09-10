import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from "base44:runtime";
import { APP_URL } from "../../shared/stripe.ts";
import { sanitizeText } from "../../shared/sanitize.ts";

// Runs hourly via the "Abandoned Cart Reminder" workflow.
// 1. Emails buyers who started checkout (pending_payment) between 1h and 2h ago — a single
//    one-shot reminder per abandoned order, so no buyer is spammed on every run.
// 2. Cleans up never-paid orders older than 24h to keep the order book clean.
// Security: admin-only scheduled task — accepted callers are an authenticated admin session
// (dashboard / workflow runner) or an internal caller presenting ESCROW_RELEASE_TOKEN.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    const isAdmin = !!user && user.role === "admin";
    let hasSecret = false;
    if (!isAdmin) {
      const body = await req.json().catch(() => ({}));
      hasSecret = typeof body.internal_token === "string" && body.internal_token === secrets.get("ESCROW_RELEASE_TOKEN");
    }
    if (!isAdmin && !hasSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const pending = await base44.asServiceRole.entities.Order.filter({ status: "pending_payment" }, "-created_date", 100);

    // The buyer_email on a pending order comes from the public, unauthenticated checkout
    // endpoint, which accepts any email without ownership verification. Only send
    // abandoned-cart reminders to addresses that belong to a registered user account, so
    // the public endpoint can't be used as an open spam relay to arbitrary addresses.
    const candidates = pending.filter((o) => {
      const created = new Date(o.created_date).getTime();
      return created <= oneHourAgo && created >= twoHoursAgo && o.buyer_email;
    });
    const uniqueEmails = [...new Set(candidates.map((o) => o.buyer_email))];
    const registeredEmails = new Set<string>();
    for (const email of uniqueEmails) {
      const users = await base44.asServiceRole.entities.User.filter({ email }, "-created_date", 1).catch(() => []);
      if (users.length > 0) registeredEmails.add(email);
    }

    let reminded = 0;
    let cleaned = 0;
    for (const order of pending) {
      const created = new Date(order.created_date).getTime();
      // One-shot reminder window: created 1–2h ago, only to registered (verified) buyers
      if (created <= oneHourAgo && created >= twoHoursAgo) {
        if (!registeredEmails.has(order.buyer_email)) continue;
        const title = sanitizeText(order.product_title, 200) || "this item";
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: order.buyer_email,
          subject: `Still interested in ${title}?`,
          body: `Hi,\n\nYou started checkout for "${title}" on UKMarketStore but didn't complete payment. The item is still available — finish your purchase before someone else does:\n\n${APP_URL}/product/${order.product_id}\n\nUKMarketStore`,
        }).catch(() => {});
        reminded++;
      }
      // Cleanup: never-paid orders older than 24h
      if (created < oneDayAgo) {
        await base44.asServiceRole.entities.Order.delete(order.id).catch(() => {});
        cleaned++;
      }
    }

    return Response.json({ reminded, cleaned });
  } catch (error) {
    console.error("abandonedCartReminder error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}