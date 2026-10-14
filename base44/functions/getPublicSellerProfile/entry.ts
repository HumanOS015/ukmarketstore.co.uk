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
    const sellerEmailForMetrics = listing.seller_email;
    const [orderResult, payoutResult] = await Promise.all([
      svc.entities.Order.filter(
        { seller_email: sellerEmailForMetrics, status: "completed" },
        "-created_date",
        500
      ),
      svc.entities.PayoutAccount.filter(
        { seller_email: sellerEmailForMetrics },
        "-created_date",
        1
      )
    ]);
    const orders = Array.isArray(orderResult)
      ? orderResult
      : Array.isArray(orderResult?.items) ? orderResult.items : [];
    const payouts = Array.isArray(payoutResult)
      ? payoutResult
      : Array.isArray(payoutResult?.items) ? payoutResult.items : [];
    const twelveMonthsAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const recentCompletedOrders = orders.filter((order) =>
      order?.status === "completed" &&
      Number.isFinite(Date.parse(order.created_date)) &&
      Date.parse(order.created_date) >= twelveMonthsAgo
    );
    const recentSalesTotal = recentCompletedOrders.reduce(
      (total, order) => total + (Number(order.price) || 0),
      0
    );
    const accountAgeMs = user?.created_date
      ? Date.now() - Date.parse(user.created_date)
      : 0;
    const verifiedSeller =
      payouts.some((account) => account?.payouts_enabled === true) &&
      accountAgeMs >= 90 * 24 * 60 * 60 * 1000 &&
      recentCompletedOrders.length >= 100 &&
      recentSalesTotal >= 1000;

    const profile = {
      verifiedSeller,
      displayName: user?.display_name || "",
      profileImage: user?.profile_images?.[0] || "",
      memberSince: user?.created_date || "",
      sellerType: user?.seller_type === "business" ? "business" : "individual"
    };

    if (profile.sellerType === "business") {
      profile.businessDetails = {
        name: user?.business_name || "",
        address: user?.business_address || "",
        contactEmail: user?.business_contact_email || "",
        phone: user?.business_phone || "",
        registrationNumber: user?.business_registration_number || "",
        vatNumber: user?.business_vat_number || ""
      };
    } else if (user?.individual_details_public === true && user?.individual_public_details) {
      profile.individualDetails = user.individual_public_details;
    }

    return Response.json(profile);
  } catch (error) {
    console.error("getPublicSellerProfile failed", error);
    return Response.json({}, { status: 500 });
  }
}
