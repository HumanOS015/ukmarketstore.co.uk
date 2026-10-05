// eBay integration helpers — pure functions that take config + tokens and talk
// to eBay's official REST/Sell APIs over fetch. Imported by the eBay backend
// functions. Secrets are passed in by each caller (read via base44:runtime in
// the function); this module never imports base44:runtime so it stays testable.
// No eBay credentials or tokens are ever returned to callers — only derived
// status/identifiers.

export const EBAY_SCOPES_DEFAULT =
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly " +
  "https://api.ebay.com/oauth/api_scope/sell.inventory " +
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly";

export function getEbayConfig(secrets) {
  const clientId = secrets.get("EBAY_CLIENT_ID");
  const clientSecret = secrets.get("EBAY_CLIENT_SECRET");
  const ruName = secrets.get("EBAY_RU_NAME");
  if (!clientId || !clientSecret || !ruName) return null;
  const environment = secrets.get("EBAY_ENVIRONMENT") === "sandbox" ? "sandbox" : "production";
  const sandbox = environment === "sandbox";
  const base = sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  return {
    clientId, clientSecret, ruName, environment,
    scopes: secrets.get("EBAY_SCOPES") || EBAY_SCOPES_DEFAULT,
    authUrl: sandbox ? "https://auth.sandbox.ebay.com/oauth2/authorize" : "https://auth.ebay.com/oauth2/authorize",
    tokenUrl: `${base}/identity/v1/oauth2/token`,
    apiBase: base,
    publicKeyUrl: `${base}/commerce/notification/v1/public_key`,
    notificationEndpoint: secrets.get("EBAY_NOTIFICATION_ENDPOINT") || "",
    verificationToken: secrets.get("EBAY_NOTIFICATION_VERIFICATION_TOKEN") || ""
  };
}

export function buildAuthorizeUrl(cfg, state) {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.ruName,
    scope: cfg.scopes,
    state
  });
  return `${cfg.authUrl}?${params.toString()}`;
}

function basicAuth(cfg) {
  return "Basic " + btoa(`${cfg.clientId}:${cfg.clientSecret}`);
}

export async function exchangeCodeForToken(cfg, code) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.ruName
  });
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": basicAuth(cfg)
    },
    body: params
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.error || "token_exchange_failed");
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    refresh_token_expires_in: data.refresh_token_expires_in,
    token_type: data.token_type,
    scope: data.scope
  };
}

export async function refreshAccessToken(cfg, refreshToken) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: cfg.scopes
  });
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": basicAuth(cfg)
    },
    body: params
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.error || "refresh_failed");
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    scope: data.scope
  };
}

// Fetch an eBay application token (client_credentials grant). Required to
// call the Notification API getPublicKey endpoint, which is authenticated.
// Server-side only; never exposed to any frontend.
export async function getEbayAppToken(cfg) {
  const scope = cfg.environment === "sandbox"
    ? "https://api.sandbox.ebay.com/oauth/api_scope"
    : "https://api.ebay.com/oauth/api_scope";
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    scope
  });
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": basicAuth(cfg)
    },
    body: params
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.error || "app_token_failed");
  return data.access_token;
}

// Retrieve the authorised seller identity via the official eBay Identity API.
// Best-effort: returns the username/userId when available.
export async function getEbayUser(cfg, accessToken) {
  const res = await fetch(`${cfg.apiBase}/commerce/identity/v1/user`, {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  if (!res.ok) return { userId: null, username: null, verified: false };
  const data = await res.json().catch(() => ({}));
  return {
    userId: data.userId || data.user_id || null,
    username: data.username || data.sellerUserName || null,
    verified: true
  };
}

// Get a valid (refreshed if needed) access token for a seller. Updates the
// token store + connection status. Throws when reauthorisation is required.
export async function getValidAccessToken(svc, cfg, seller_email) {
  const stores = await svc.entities.EbayTokenStore.filter({ seller_email }, "-created_date", 5);
  if (!stores || stores.length === 0) throw new Error("no_ebay_connection");
  const store = stores[0];
  if (store.status !== "active" && store.status !== "expired") {
    throw new Error(store.status === "revoked" ? "revoked" : "reauth_required");
  }
  const now = Date.now();
  const expiryMs = store.token_expiry ? new Date(store.token_expiry).getTime() : 0;
  if (expiryMs - now > 60000) return store.access_token;

  // Token expired — refresh server-side.
  try {
    const refreshed = await refreshAccessToken(cfg, store.refresh_token);
    const newExpiry = new Date(now + (refreshed.expires_in || 7200) * 1000).toISOString();
    await svc.entities.EbayTokenStore.update(store.id, {
      access_token: refreshed.access_token,
      token_expiry: newExpiry,
      last_refresh: new Date().toISOString(),
      status: "active",
      last_error: null
    });
    return refreshed.access_token;
  } catch (e) {
    await svc.entities.EbayTokenStore.update(store.id, {
      status: "error",
      last_error: e.message
    }).catch(() => {});
    const conns = await svc.entities.MarketplaceConnection.filter(
      { seller_email, marketplace: "eBay" }, "-created_date", 1
    );
    if (conns && conns[0]) {
      await svc.entities.MarketplaceConnection.update(conns[0].id, {
        connection_status: "sync_error",
        authorization_status: "expired",
        connection_error: "Token refresh failed — reauthorisation required"
      }).catch(() => {});
    }
    throw new Error("refresh_failed");
  }
}

// Verify an eBay listing belongs to the connected seller before linking.
// Uses the official Browse API to read the listing's seller and compares it
// to the stored eBay account reference.
export async function verifyEbayListingOwnership(cfg, accessToken, itemId, expectedSeller) {
  const res = await fetch(`${cfg.apiBase}/buy/browse/v1/item/${encodeURIComponent(itemId)}`, {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    return { verified: false, reason: `ebay_item_not_found (${res.status})` };
  }
  const data = await res.json().catch(() => ({}));
  const seller = data?.seller?.username || data?.seller?.userId || null;
  if (!seller) return { verified: false, reason: "seller_not_exposed" };
  const ok = !expectedSeller || seller === expectedSeller;
  return { verified: ok, seller, reason: ok ? "ok" : "seller_mismatch" };
}

// Fetch an eBay order's line items (official Fulfillment API).
export async function getEbayOrder(cfg, accessToken, orderId) {
  const res = await fetch(`${cfg.apiBase}/sell/fulfillment/v1/order/${encodeURIComponent(orderId)}`, {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const lineItems = (data.lineItems || []).map((li) => ({
    lineItemId: li.lineItemId,
    itemId: li.itemId,
    quantity: li.quantity,
    sku: li.sku || null
  }));
  return { orderId: data.orderId || orderId, seller: data.seller?.userId || null, lineItems };
}

// --- eBay notification signature verification (official Notification API) ---

// Format a PEM public key by inserting newlines after the BEGIN marker and
// before the END marker. eBay returns the key as a single unbroken string.
function formatPemKey(key) {
  return key
    .replace(/-----BEGIN PUBLIC KEY-----/, "-----BEGIN PUBLIC KEY-----\n")
    .replace(/-----END PUBLIC KEY-----/, "\n-----END PUBLIC KEY-----");
}

// Fetch eBay's public key for a given key ID (kid). The getPublicKey endpoint
// is authenticated — requires an OAuth application token (client_credentials).
// Returns { key, algorithm, digest } from eBay's response.
async function fetchPublicKey(cfg, kid) {
  let token;
  try {
    token = await getEbayAppToken(cfg);
  } catch (e) {
    return null;
  }
  const res = await fetch(`${cfg.publicKeyUrl}/${encodeURIComponent(kid)}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  if (!data.key) return null;
  return data;
}

export async function verifyEbaySignature(cfg, rawBody, signatureHeader) {
  if (!signatureHeader) return { ok: false, reason: "missing_signature" };
  let sig;
  try {
    sig = JSON.parse(atob(signatureHeader));
  } catch (e) {
    return { ok: false, reason: "malformed_signature" };
  }
  const kid = sig.kid;
  if (!kid) return { ok: false, reason: "no_kid" };
  const keyData = await fetchPublicKey(cfg, kid);
  if (!keyData || !keyData.key) return { ok: false, reason: "public_key_unavailable" };

  // eBay signs JSON.stringify(message), not the raw request body — re-stringify
  // the parsed JSON so the byte sequence matches what eBay signed.
  let canonicalBody;
  try {
    canonicalBody = JSON.stringify(JSON.parse(rawBody));
  } catch (e) {
    return { ok: false, reason: "malformed_body" };
  }

  // Determine the hash from eBay's key response (default SHA-1 per eBay SDK).
  const digest = (keyData.digest || "SHA1").toUpperCase();
  const hash = digest === "SHA256" ? "SHA-256" : "SHA-1";

  // Extract DER bytes from the PEM key.
  const pem = formatPemKey(keyData.key);
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  let cryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "spki", der,
      { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
    );
  } catch (e) {
    return { ok: false, reason: "key_import_failed" };
  }

  const sigBytes = Uint8Array.from(atob(sig.signature), (c) => c.charCodeAt(0));
  const bodyBytes = new TextEncoder().encode(canonicalBody);
  try {
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash }, cryptoKey, sigBytes, bodyBytes
    );
    return { ok: valid, reason: valid ? "ok" : "signature_mismatch" };
  } catch (e) {
    return { ok: false, reason: "verify_error" };
  }
}

// eBay endpoint challenge response:
// challengeResponse = SHA-256(challengeCode + verificationToken + endpoint)
export async function challengeResponse(verificationToken, challengeCode, endpoint) {
  const input = `${challengeCode}${verificationToken}${endpoint}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}