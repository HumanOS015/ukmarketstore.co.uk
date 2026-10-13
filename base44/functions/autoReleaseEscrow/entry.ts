import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from "base44:runtime";
import { transferToSeller } from "../../shared/escrow.ts";

// Runs daily via the "Escrow Auto-Release" workflow.
// Releases funds only for orders already marked "delivered" by delivery tracking.
// Retries delivered orders where an earlier transfer failed (e.g. platform balance
// had not settled). There is deliberately no time-based release for shipped orders.
// Security: this is an admin-only scheduled task. Accepted callers:
//   1. The platform's workflow runner / dashboard admins (authenticated admin session)
//   2. Internal backend functions presenting the ESCROW_RELEASE_TOKEN shared secret
// Anonymous HTTP callers have neither and are rejected before any escrow processing runs —
// this gates real Stripe transfers, so no hardcoded string or client-supplied flag is accepted.
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

    // Never release a shipped order based on elapsed time alone.
    const toRelease = await base44.asServiceRole.entities.Order.filter({ status: "delivered" }, "-created_date", 100);

    let released = 0;
    for (const order of toRelease) {
      const result = await transferToSeller(base44, order);
      if (result.ok) {
        released++;
        base44.asServiceRole.functions.invoke("orderNotification", { orderId: order.id, event: "released", internal_token: secrets.get("ESCROW_RELEASE_TOKEN") }).catch(() => {});
      }
    }

    // Return only aggregate counts — never per-order ids or transfer failure reasons,
    // which would expose sensitive information to anonymous callers.
    return Response.json({
      processed: toRelease.length,
      released,
    });
  } catch (error) {
    console.error("autoReleaseEscrow error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}