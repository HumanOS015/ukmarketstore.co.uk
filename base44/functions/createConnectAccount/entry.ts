import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { STRIPE_VERSION } from "../../shared/stripe.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !user.email) {
      return Response.json({ error: "You must be logged in to connect payouts" }, { status: 401 });
    }

    const sellerEmail = user.email;
    const body = await req.json().catch(() => ({}));
    const businessType = body?.businessType === "company" || body?.businessType === "individual"
      ? body.businessType
      : "";
    const appId = secrets.get("BASE44_APP_ID") || "";
    const stripeSecret = secrets.get("STRIPE_SECRET_KEY");

    // Look up existing payout account record
    let payoutAccount = (await base44.asServiceRole.entities.PayoutAccount.filter({ seller_email: sellerEmail }))[0];
    let accountId = payoutAccount?.stripe_account_id;

    if (!accountId) {
      // Create a new Stripe Express account
      const createParams = new URLSearchParams();
      createParams.append("type", "express");
      createParams.append("email", sellerEmail);
      createParams.append("metadata[seller_email]", sellerEmail);
      createParams.append("metadata[base44_app_id]", appId);
      if (businessType) createParams.append("business_type", businessType);

      const createRes = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeSecret}`,
          "Stripe-Version": STRIPE_VERSION,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: createParams,
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        console.error("Stripe account create error", JSON.stringify(err));
        return Response.json({ error: "Failed to create payout account" }, { status: 500 });
      }

      const account = await createRes.json();
      accountId = account.id;

      payoutAccount = await base44.asServiceRole.entities.PayoutAccount.create({
        seller_email: sellerEmail,
        stripe_account_id: accountId,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      });
    }

    // Fetch current account status from Stripe
    const acctRes = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
      headers: {
        "Authorization": `Bearer ${stripeSecret}`,
        "Stripe-Version": STRIPE_VERSION,
      },
    });
    if (!acctRes.ok) {
      const err = await acctRes.json();
      console.error("Stripe account retrieve error", JSON.stringify(err));
      return Response.json({ error: "Failed to verify payout account" }, { status: 500 });
    }
    let account = await acctRes.json();

    // Stripe locks the business type after an onboarding link is created.
    // Replace only an unfinished account when the seller changes their choice.
    if (
      businessType &&
      account.business_type !== businessType &&
      !account.details_submitted &&
      !account.charges_enabled &&
      !account.payouts_enabled
    ) {
      const replacementParams = new URLSearchParams({
        type: "express",
        email: sellerEmail,
        business_type: businessType,
        "metadata[seller_email]": sellerEmail,
        "metadata[base44_app_id]": appId,
      });
      const replacementRes = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeSecret}`,
          "Stripe-Version": STRIPE_VERSION,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: replacementParams,
      });
      if (!replacementRes.ok) {
        const err = await replacementRes.json();
        console.error("Stripe replacement account create error", JSON.stringify(err));
        return Response.json({ error: "Failed to update payout account type" }, { status: 500 });
      }

      account = await replacementRes.json();
      accountId = account.id;
      await base44.asServiceRole.entities.PayoutAccount.update(payoutAccount.id, {
        stripe_account_id: accountId,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      });
    }

    // Sync status to DB
    await base44.asServiceRole.entities.PayoutAccount.update(payoutAccount.id, {
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
      details_submitted: account.details_submitted || false,
    }).catch(() => {});

    const onboarded = account.details_submitted && account.charges_enabled;

    // Listings saved before Stripe setup stay hidden until the seller can receive payments.
    if (onboarded) {
      try {
        const pendingListings = await base44.asServiceRole.entities.Product.filter({
          seller_email: sellerEmail,
          status: "pending_stripe",
        });
        for (const listing of pendingListings) {
          await base44.asServiceRole.entities.Product.update(listing.id, { status: "active" });
        }
      } catch (activationError) {
        console.error("Failed to activate pending listings", activationError);
      }
    }

    let url;

    if (onboarded) {
      // Already onboarded — create a login link to the Express dashboard
      const linkRes = await fetch(`https://api.stripe.com/v1/accounts/${accountId}/login_links`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeSecret}`,
          "Stripe-Version": STRIPE_VERSION,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": crypto.randomUUID(),
        },
      });
      if (!linkRes.ok) {
        const err = await linkRes.json();
        console.error("Stripe login link error", JSON.stringify(err));
        return Response.json({ error: "Failed to create dashboard link" }, { status: 500 });
      }
      url = (await linkRes.json()).url;
    } else if (businessType && account.business_type !== businessType) {
      return Response.json(
        { error: "This Stripe account has already started verification as a different seller type. Please contact support to change it." },
        { status: 409 }
      );
    } else {
      // Not onboarded — create an onboarding link
      const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeSecret}`,
          "Stripe-Version": STRIPE_VERSION,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: new URLSearchParams({
          account: accountId,
          type: "account_onboarding",
          refresh_url: "https://ukmarketstore.co.uk/sell?stripe_connect=return",
          return_url: "https://ukmarketstore.co.uk/sell?stripe_connect=return",
        }),
      });
      if (!linkRes.ok) {
        const err = await linkRes.json();
        console.error("Stripe onboarding link error", JSON.stringify(err));
        return Response.json({ error: "Failed to create onboarding link" }, { status: 500 });
      }
      url = (await linkRes.json()).url;
    }

    return Response.json({ url, onboarded });
  } catch (error) {
    console.error("createConnectAccount error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}