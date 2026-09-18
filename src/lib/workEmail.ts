/**
 * Work-email validation — client-side mirror of the server blocklist.
 * Keeps the same domain set so validation is consistent before a round-trip.
 */

const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "outlook.in", "hotmail.com", "hotmail.in", "hotmail.co.uk",
  "live.com", "live.in", "msn.com",
  "yahoo.com", "yahoo.co.in", "yahoo.co.uk", "ymail.com",
  "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me", "pm.me",
  "rediffmail.com", "aol.com", "zohomail.com",
  "mail.com", "inbox.com", "gmx.com", "gmx.net",
  "tutanota.com", "tuta.io",
]);

export function isWorkEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at === -1) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return !PERSONAL_DOMAINS.has(domain);
}

export const WORK_EMAIL_MESSAGE =
  "Please use your work email address. Personal email providers are not supported.";
