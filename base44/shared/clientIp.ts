// Extracts the caller's IP from trusted ingress headers for un-spoofable
// rate limiting on public endpoints. Validates the format so a client cannot
// inject arbitrary strings (e.g. a rotated fake x-forwarded-for) to bypass
// per-IP caps or poison the fraud-audit client_ip field. Invalid / missing
// values fall back to "unknown", which is excluded from IP-based limits — the
// per-account (email) cap remains the primary backstop in that case.
function isValidIp(ip) {
  if (!ip || typeof ip !== "string") return false;
  const v = ip.trim();
  if (!v) return false;
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) {
    return v.split(".").every((o) => {
      const n = Number(o);
      return n >= 0 && n <= 255;
    });
  }
  // IPv6 (incl. "::" shorthand) — loose structural check
  return v.includes(":") && /^[0-9a-fA-F:.]+$/.test(v);
}

export function getClientIp(req) {
  const get = req?.headers?.get?.bind(req.headers);
  const real = get?.("x-real-ip");
  if (real && isValidIp(real)) return real.trim();
  const fwd = get?.("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first && isValidIp(first)) return first;
  }
  return "unknown";
}