import { createClientFromRequest } from "npm:@base44/sdk";

// Return public profile details only for a seller with a public listing.
// This avoids exposing private User records through the browser.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
    const sellerEmail = typeof body?.sellerEmail === "string" ? body.sellerEmail.trim() : "";
    if (!productId && !sellerEmail) return Response.json({}, { status: 400 });

    const svc = base44.asServiceRole;
    const listings = productId
      ? [await svc.entities.Product.get(productId).catch(() => null)]
      : await svc.entities.Product.filter(
          { seller_email: sellerEmail, status: "active" },
          "-created_date",
          1
        );
    const listingList = Array.isArray(listings) ? listings : Array.isArray(listings?.items) ? listings.items : [];
    const listing = listingList.find((item) => item?.seller_email && ["active", "sold"].includes(item.status));
    if (!listing) return Response.json({}, { status: 404 });

    const users = await svc.entities.User.filter(
      { email: listing.seller_email },
      "-created_date",
      1
    );
    const userList = Array.isArray(users) ? users : Array.isArray(users?.items) ? users.items : [];
    const user = userList[0];
    return Response.json({
      displayName: user?.display_name || "",
      profileImage: user?.profile_images?.[0] || "",
      memberSince: user?.created_date || ""
    });
  } catch (error) {
    console.error("getPublicSellerProfile failed", error);
    return Response.json({}, { status: 500 });
  }
}
