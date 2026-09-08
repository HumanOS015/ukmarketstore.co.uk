// Detects the UK courier from a tracking number format and returns a one-click
// tracking URL. No external API required — the buyer is sent straight to the
// courier's own tracking page. Automated delivery-status polling (for escrow
// auto-release) would need a paid tracking API; this is the no-API version.
export function detectCourier(trackingNumber) {
  if (!trackingNumber) return null;
  const t = String(trackingNumber).trim();
  if (!t) return null;
  const u = t.toUpperCase();

  // Royal Mail: e.g. AB123456789GB
  if (/^[A-Z]{2}\d{9}GB$/.test(u)) {
    return { name: "Royal Mail", trackingUrl: `https://www.royalmail.com/track-your-item?trackNumber=${encodeURIComponent(t)}` };
  }
  // Evri (formerly Hermes): H + 15 digits, or 1550... 16-digit consignments
  if (/^H\d{15}$/.test(u) || /^1550\d{12}$/.test(t)) {
    return { name: "Evri", trackingUrl: `https://www.evri.com/track-a-parcel/parcelnumber/${encodeURIComponent(t)}` };
  }
  // UPS: 1Z + 16 alphanumerics
  if (/^1Z[0-9A-Z]{16}$/.test(u)) {
    return { name: "UPS", trackingUrl: `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}` };
  }
  // FedEx: 12 digits
  if (/^\d{12}$/.test(t)) {
    return { name: "FedEx", trackingUrl: `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}` };
  }
  // DPD: 14 digits
  if (/^\d{14}$/.test(t)) {
    return { name: "DPD", trackingUrl: `https://track.dpd.co.uk/track?tn=${encodeURIComponent(t)}` };
  }
  // DHL: 10 digits
  if (/^\d{10}$/.test(t)) {
    return { name: "DHL", trackingUrl: `https://www.dhl.com/global-en/home/our-divisions/express/track-and-track.html?trackingnumber=${encodeURIComponent(t)}` };
  }
  // Yodel: JD + 14 digits, or 16 digits
  if (/^JD\d{14}$/.test(u) || /^\d{16}$/.test(t)) {
    return { name: "Yodel", trackingUrl: `https://www.yodel.co.uk/track?tracker=${encodeURIComponent(t)}` };
  }
  // Amazon Logistics: TBA...
  if (/^TBA\d+$/.test(u)) {
    return { name: "Amazon", trackingUrl: `https://track.amazon.co.uk/tracking/${encodeURIComponent(t)}` };
  }
  // Fallback: any GB-suffixed number is likely Royal Mail
  if (/GB$/.test(u)) {
    return { name: "Royal Mail", trackingUrl: `https://www.royalmail.com/track-your-item?trackNumber=${encodeURIComponent(t)}` };
  }
  return null;
}