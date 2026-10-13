import { createClientFromRequest } from "npm:@base44/sdk";

// Return only the public profile image for the seller of a public listing.
// This avoids exposing private User records through the browser.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
    if (!productId) return Response.json({ profileImage: "" }, { status: 400 });

    const svc = base44.asServiceRole;
    const product = await svc.entities.Product.get(productId).catch(() => null);
    if (!product || !product.seller_email || !["active", "sold"].includes(product.status)) {
      return Response.json({ profileImage: "" }, { status: 404 });
    }

    const users = await svc.entities.User.filter(
      { email: product.seller_email },
      "-created_date",
      1
    );
    const userList = Array.isArray(users) ? users : Array.isArray(users?.items) ? users.items : [];
    return Response.json({ profileImage: userList[0]?.profile_images?.[0] || "" });
  } catch (error) {
    console.error("getPublicSellerProfile failed", error);
    return Response.json({ profileImage: "" }, { status: 500 });
  }
}
