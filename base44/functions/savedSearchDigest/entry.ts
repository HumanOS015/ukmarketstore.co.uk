import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from "base44:runtime";
import { APP_URL } from "../../shared/stripe.ts";
import { sanitizeText } from "../../shared/sanitize.ts";

// Runs daily via the "Saved Search Digest" workflow.
// For each saved search, finds active products listed since the last digest that match the
// saved query/category, emails the buyer a short digest, and updates last_notified_date.
// Security: admin-only scheduled task — admin session or ESCROW_RELEASE_TOKEN.
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

    const searches = await base44.asServiceRole.entities.SavedSearch.filter({}, "-created_date", 500);
    // One fetch of recent active products; matching is done in code (no server-side text search).
    const products = await base44.asServiceRole.entities.Product.filter({ status: "active" }, "-created_date", 200);

    const now = new Date();
    let digests = 0;
    for (const s of searches) {
      const since = s.last_notified_date ? new Date(s.last_notified_date) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const q = (s.query || "").toLowerCase().trim();
      const cat = s.category && s.category !== "All Categories" ? s.category : null;

      const matches = products.filter((p) => {
        if (new Date(p.created_date) <= since) return false;
        if (cat && p.category !== cat) return false;
        if (q) {
          const hay = ((p.title || "") + " " + (p.description || "")).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      if (matches.length === 0) continue;

      const top = matches.slice(0, 5);
      const lines = top.map((p) => `- ${sanitizeText(p.title, 200)} - £${p.price}\n  ${APP_URL}/product/${p.id}`);
      const scope = cat ? cat.toLowerCase() : "listing";
      const queryLabel = q ? sanitizeText(s.query, 100) : "";
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: s.buyer_email,
        subject: `${matches.length} new ${scope}${matches.length === 1 ? "" : "s"} on UKMarketStore${queryLabel ? ` matching "${queryLabel}"` : ""}`,
        body: `Hi,\n\n${matches.length} new ${scope}${matches.length === 1 ? "" : "s"} ${queryLabel ? `matching "${queryLabel}" ` : ""}just listed on UKMarketStore.\n\n${lines.join("\n\n")}\n\nUKMarketStore`,
      }).catch(() => {});

      await base44.asServiceRole.entities.SavedSearch.update(s.id, { last_notified_date: now.toISOString() }).catch(() => {});
      digests++;
    }

    return Response.json({ digests, searches: searches.length });
  } catch (error) {
    console.error("savedSearchDigest error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}