// Seller/buyer-controlled strings (product title, tracking number, search query) are
// interpolated into email subjects and bodies. Strip HTML tags, angle brackets and line
// breaks so a malicious user can't inject deceptive links/HTML, manipulate the email
// structure, or inject CRLF-based email headers. Cap length to keep notifications readable.
export const sanitizeText = (value: any, max = 200): string => {
  if (!value) return '';
  const s = String(value)
    .replace(/<[^>]*>/g, '')      // strip HTML tags
    .replace(/[<>\r\n\t]/g, ' ')  // neutralize angle brackets & line/control chars
    .trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
};