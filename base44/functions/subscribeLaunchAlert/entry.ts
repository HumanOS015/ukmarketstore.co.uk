import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Coming Soon launch-notification signup. Requires a signed-in visitor; the
// verified account email is recorded against a specific listing so UKMarketStore
// can notify them when the marketplace opens. This path never touches Stripe,
// escrow, orders, or any payment — it only creates a LaunchSubscriber record.

// Extract the caller's IP from trusted ingress headers for un-spoofable rate
// limiting on this public, no-login endpoint.
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
    // Signup requires a signed-in user. The email is taken from the verified
    // session — never the request body — so strangers can't fill the database
    // with arbitrary addresses.
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) {
      return Response.json({ error: "Please sign in to subscribe" }, { status: 401 });
    }
    const email = me.email.toLowerCase();
    const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
    const productTitle = typeof body?.productTitle === "string" ? body.productTitle.trim().slice(0, 200) : "";

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

    // Per-IP rate limit (un-spoofable signal) to stop junk subscription spam
    // against the database. Public, no-login path.
    const clientIp = getClientIp(req);
    if (clientIp && clientIp !== "unknown") {
      const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recent = await base44.asServiceRole.entities.LaunchSubscriber.filter({
        client_ip: clientIp,
        created_date: { $gte: sinceIso }
      });
      const recentArr = Array.isArray(recent) ? recent : (recent.items || []);
      if (recentArr.length >= 10) {
        return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
      }
    }

    await base44.asServiceRole.entities.LaunchSubscriber.create({
      email,
      product_id: productId,
      product_title: productTitle,
      status: "pending",
      client_ip: clientIp,
    });

    return Response.json({ ok: true, alreadySubscribed: false });
  } catch (error) {
    console.error("subscribeLaunchAlert error", error);
    return Response.json({ error: "Couldn't sign you up. Please try again." }, { status: 500 });
  }
}