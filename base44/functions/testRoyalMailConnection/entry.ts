import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from "base44:runtime";

// Read-only Royal Mail diagnostic. This function never reads or updates UKMarketStore
// orders and never calls any Stripe/escrow functions.
const ROYAL_MAIL_URL = "https://api.royalmail.net/mailpieces/v2";

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user || user.role !== "admin") {
      return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 });
    }

    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Use POST with a trackingNumber field." }, { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const trackingNumber = typeof body.trackingNumber === "string"
      ? body.trackingNumber.trim()
      : "";

    if (!trackingNumber || trackingNumber.length > 80) {
      return Response.json({
        ok: false,
        error: "Provide one valid Royal Mail tracking number in trackingNumber."
      }, { status: 400 });
    }

    const clientId = secrets.get("ROYAL_MAIL_CLIENT_ID");
    const clientSecret = secrets.get("ROYAL_MAIL_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return Response.json({
        ok: false,
        configured: false,
        error: "One or both Royal Mail secrets are missing."
      }, { status: 200 });
    }

    const response = await fetch(
      `${ROYAL_MAIL_URL}/${encodeURIComponent(trackingNumber)}/events`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "X-Accept-RMG-Terms": "yes",
          "X-IBM-Client-Id": clientId,
          "X-IBM-Client-Secret": clientSecret
        }
      }
    );

    // Never return raw tracking data, signature details, credentials, or the tracking
    // number. HTTP status is enough to diagnose authentication/access without exposing PII.
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      const hint =
        response.status === 401 || response.status === 403
          ? "Royal Mail rejected authentication or API access. Check credential pairing and subscription/activation."
          : response.status === 404
            ? "Royal Mail returned not found. Authentication may have succeeded, but this tracking number or endpoint was not found."
            : response.status === 429
              ? "Royal Mail rate limit reached."
              : "Royal Mail returned an error. Check the API product and endpoint configuration.";
      return Response.json({
        ok: false,
        configured: true,
        royalMailHttpStatus: response.status,
        hint
      }, { status: 200 });
    }

    const data = await response.json().catch(() => null);
    const mailPieces = Array.isArray(data?.mailPieces) ? data.mailPieces[0] : data?.mailPieces;
    const summary = mailPieces?.summary;
    const events = Array.isArray(mailPieces?.events) ? mailPieces.events : [];

    return Response.json({
      ok: true,
      configured: true,
      royalMailHttpStatus: response.status,
      responseReceived: !!data,
      summaryStatusCategoryPresent: typeof summary?.statusCategory === "string",
      eventCount: events.length,
      message: "Royal Mail accepted the request. No UKMarketStore order or payment was changed."
    }, { status: 200 });
  } catch {
    // Do not echo raw exceptions, request headers, credentials, or response bodies.
    return Response.json({
      ok: false,
      error: "Diagnostic request failed before a usable Royal Mail response was received."
    }, { status: 500 });
  }
}
