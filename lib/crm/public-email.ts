/** Consumer mailboxes — not a company domain. Do not auto-attach people by these. */
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.de",
  "icloud.com",
  "me.com",
  "mac.com",
  "gmx.de",
  "gmx.net",
  "gmx.com",
  "web.de",
  "t-online.de",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "mail.com",
  "yandex.com",
  "zoho.com",
]);

export function emailDomain(email: string | null | undefined): string | null {
  const raw = (email || "").trim().toLowerCase();
  const at = raw.lastIndexOf("@");
  if (at < 1 || at === raw.length - 1) return null;
  return raw.slice(at + 1);
}

export function isPublicEmailDomain(email: string | null | undefined): boolean {
  const domain = emailDomain(email);
  return Boolean(domain && PUBLIC_EMAIL_DOMAINS.has(domain));
}

/** Company rows should not store a Gmail/Outlook address as the org email. */
export function companyEmailOrNull(email: string | null | undefined): string | null {
  const t = (email || "").trim();
  if (!t || isPublicEmailDomain(t)) return null;
  return t;
}
