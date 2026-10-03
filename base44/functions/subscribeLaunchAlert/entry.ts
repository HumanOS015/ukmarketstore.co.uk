import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Coming Soon launch-notification signup. Anonymous visitors (the public app
// requires no login) leave their email against a specific listing so UKMarketStore
// can notify them when the marketplace opens. This path never touches Stripe,
// escrow, orders, or any payment — it only creates a LaunchSubscriber record.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const rawEmail = typeof body?.email === "string" ? body.email : "";
    const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
    const productTitle = typeof body?.productTitle === "string" ? body.productTitle.trim().slice(0, 200) : "";

    // Validate + normalise the email (trim, lowercase) so duplicate detection works.
    const email = rawEmail.trim().toLowerCase();
    if (!email) {
      return Response.json({ error: "Please enter your email address" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email) || email.length > 320) {
      return Response.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    if (!productId) {
      return Response.json({ error: "Listing not found" }, { status: 400 });
    }

    // Duplicate protection: one subscription per email per listing.
    // LaunchSubscriber is admin-only, so this runs as the service role.
    const existing = await base44.asServiceRole.entities.LaunchSubscriber.filter(
      { email, product_id: productId },
      { limit: 1 }
    );
    const existingArr = Array.isArray(existing) ? existing : (existing.items || []);
    if (existingArr.length > 0) {
      return Response.json({ ok: true, alreadySubscribed: true });
    }

    await base44.asServiceRole.entities.LaunchSubscriber.create({
      email,
      product_id: productId,
      product_title: productTitle,
      status: "pending",
    });

    return Response.json({ ok: true, alreadySubscribed: false });
  } catch (error) {
    console.error("subscribeLaunchAlert error", error);
    return Response.json({ error: "Couldn't sign you up. Please try again." }, { status: 500 });
  }
}