import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { getEbayConfig, buildAuthorizeUrl } from "../../shared/ebay.ts";

// Starts the official eBay OAuth Authorization Code Grant flow. Returns the
// eBay authorisation URL the seller must be redirected to. Creates a pending
// token-store record bound to the seller (with a state nonce) so the callback
// can be verified. Never asks for an eBay password.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const cfg = getEbayConfig(secrets);
    if (!cfg) return Response.json({ error: "eBay is not configured", configured: false }, { status: 503 });

    const state = crypto.randomUUID();
    await base44.asServiceRole.entities.EbayTokenStore.create({
      seller_email: me.email,
      state,
      status: "pending"
    });

    const url = buildAuthorizeUrl(cfg, state);
    return Response.json({ url, environment: cfg.environment });
  } catch (error) {
    console.error("ebayOAuthStart error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}