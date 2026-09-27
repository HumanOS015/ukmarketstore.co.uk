import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from "base44:runtime";
import { transferToSeller } from "../../shared/escrow.ts";

const ROYAL_MAIL_URL = "https://api.royalmail.net/mailpieces/v2";

function normaliseStatus(value) {
  const s = String(value || "").toLowerCase();
  if (s.includes("deliver") || s.includes("collect")) return "delivered";
  if (s.includes("exception") || s.includes("failed") || s.includes("problem") || s.includes("return")) return "exception";
  if (s.includes("transit") || s.includes("dispatch") || s.includes("scan") || s.includes("attempt") || s.includes("received") || s.includes("progress")) return "in_transit";
  return "unknown";
}

function findStatus(value) {
  if (!value || typeof value !== "object") return null;
  const preferred = ["status", "statusDescription", "eventType", "eventDescription", "description", "name"];
  for (const key of preferred) {
    if (typeof value[key] === "string") {
      const status = normaliseStatus(value[key]);
      if (status !== "unknown") return status;
    }
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const status = findStatus(item);
        if (status && status !== "unknown") return status;
      }
    } else if (child && typeof child === "object") {
      const status = findStatus(child);
      if (status && status !== "unknown") return status;
    }
  }
  return null;
}

async function getRoyalMailStatus(trackingNumber) {
  const clientId = secrets.get("ROYAL_MAIL_CLIENT_ID");
  const clientSecret = secrets.get("ROYAL_MAIL_CLIENT_SECRET");
  if (!clientId || !clientSecret) return { configured: false };

  const response = await fetch(
    `${ROYAL_MAIL_URL}/${encodeURIComponent(trackingNumber)}/events`,
    {
      headers: {
        "Accept": "application/json",
        "X-IBM-Client-Id": clientId,
        "X-IBM-Client-Secret": clientSecret
      }
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Royal Mail API returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  return { configured: true, status: findStatus(data) || "unknown", raw: data };
}

async function getEvriStatus(trackingNumber) {
  // Evri's public site confirms tracking and delivered events, but this app does not
  // assume an undocumented public API. If UKMarketStore has an Evri business/API
  // endpoint, store it in these Base44 secrets and the adapter will use it.
  const urlTemplate = secrets.get("EVRI_TRACKING_API_URL");
  const apiKey = secrets.get("EVRI_TRACKING_API_KEY");
  if (!urlTemplate || !apiKey) return { configured: false };

  const url = urlTemplate.replace("{trackingNumber}", encodeURIComponent(trackingNumber));
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "X-API-Key": apiKey
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Evri tracking API returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  return { configured: true, status: findStatus(data) || "unknown", raw: data };
}

async function releaseDelivered(base44, order) {
  if (order.status === "completed" || order.status === "refunded" || order.status === "disputed") {
    return { released: false, skipped: true };
  }

  await base44.asServiceRole.entities.Order.update(order.id, {
    status: "delivered",
    tracking_status: "delivered",
    delivered_at: new Date().toISOString(),
    last_tracking_check: new Date().toISOString()
  });

  const updated = { ...order, status: "delivered", tracking_status: "delivered" };
  const result = await transferToSeller(base44, updated);

  if (result.ok) {
    await base44.asServiceRole.functions.invoke("orderNotification", {
      orderId: order.id,
      event: "delivered",
      internal_token: secrets.get("ESCROW_RELEASE_TOKEN")
    }).catch(() => {});

    await base44.asServiceRole.functions.invoke("orderNotification", {
      orderId: order.id,
      event: "released",
      internal_token: secrets.get("ESCROW_RELEASE_TOKEN")
    }).catch(() => {});

    return { released: true };
  }

  return { released: false, payoutPending: true, reason: result.reason };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Only the scheduled/internal caller may run bulk polling. A courier webhook may
    // supply a single order/tracking update when authenticated with DELIVERY_WEBHOOK_TOKEN.
    const user = await base44.auth.me().catch(() => null);
    const isAdmin = user?.role === "admin";
    const internalToken = secrets.get("ESCROW_RELEASE_TOKEN");
    const webhookToken = secrets.get("DELIVERY_WEBHOOK_TOKEN");
    const authorised = isAdmin ||
      (typeof body.internal_token === "string" && body.internal_token === internalToken) ||
      (typeof body.webhook_token === "string" && body.webhook_token === webhookToken);

    if (!authorised) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const singleOrderId = typeof body.orderId === "string" ? body.orderId : null;
    const orders = singleOrderId
      ? await base44.asServiceRole.entities.Order.filter({ id: singleOrderId })
      : await base44.asServiceRole.entities.Order.filter({ status: "shipped" }, "-created_date", 100);

    let checked = 0;
    let delivered = 0;
    let released = 0;
    let pending = 0;
    const errors = [];

    for (const order of orders) {
      if (order.status !== "shipped" || !order.tracking_number || !["Royal Mail", "Evri"].includes(order.carrier)) continue;
      checked++;

      try {
        let result;
        if (order.carrier === "Royal Mail") {
          result = await getRoyalMailStatus(order.tracking_number);
        } else {
          result = await getEvriStatus(order.tracking_number);
        }

        if (!result.configured) continue;

        const status = result.status || "unknown";
        const patch = {
          tracking_status: status,
          last_tracking_check: new Date().toISOString()
        };

        if (status === "delivered") {
          const release = await releaseDelivered(base44, order);
          delivered++;
          if (release.released) released++;
          if (release.payoutPending) pending++;
        } else {
          await base44.asServiceRole.entities.Order.update(order.id, patch);
        }
      } catch (error) {
        console.error("Delivery status check failed", order.id, error);
        errors.push({ orderId: order.id, carrier: order.carrier, error: String(error?.message || error).slice(0, 200) });
      }
    }

    return Response.json({ ok: true, checked, delivered, released, pending, errors: errors.length ? errors : undefined });
  } catch (error) {
    console.error("syncDeliveryStatus error", error);
    return Response.json({ error: error?.message || "Delivery sync failed" }, { status: 500 });
  }
}
