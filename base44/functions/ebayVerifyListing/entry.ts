import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { getEbayConfig, getValidAccessToken, verifyEbayListingOwnership } from "../../shared/ebay.ts";

// Seller-facing: verify an eBay listing belongs to the connected seller
// before the mapping is saved. Returns the verified seller + listing id.
// Does not create a mapping (the existing connectExternalListing does that).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { itemId } = body;
    if (!itemId) return Response.json({ error: "itemId required" }, { status: 400 });

    const svc = base44.asServiceRole;
    const conns = await svc.entities.MarketplaceConnection.filter(
      { seller_email: me.email, marketplace: "eBay", connection_status: "connected", enabled: true },
      "-created_date", 1
    );
    if (!conns || conns.length === 0) {
      return Response.json({ verified: false, reason: "ebay_not_connected" }, { status: 400 });
    }
    const connection = conns[0];

    const cfg = getEbayConfig(secrets);
    if (!cfg) return Response.json({ verified: false, reason: "ebay_not_configured" }, { status: 503 });

    let token;
    try {
      token = await getValidAccessToken(svc, cfg, me.email);
    } catch (e) {
      return Response.json({ verified: false, reason: "token_unavailable", error: e.message }, { status: 200 });
    }

    const result = await verifyEbayListingOwnership(cfg, token, itemId, connection.seller_user_ref);

    // Prevent the same eBay listing being linked to a different UKMS item.
    if (result.verified) {
      const dupe = await svc.entities.ExternalListingMapping.filter(
        { marketplace: "eBay", external_listing_id: itemId, active: true }, "-created_date", 5
      );
      if (dupe && dupe.length > 0 && dupe.some((m) => m.seller_email === me.email)) {
        return Response.json({ verified: false, reason: "already_linked" });
      }
    }

    return Response.json(result);
  } catch (error) {
    console.error("ebayVerifyListing error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}