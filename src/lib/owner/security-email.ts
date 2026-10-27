/**
 * Emails the owner about security events in the owner area, so a change they
 * didn't make is noticed quickly (e.g. someone with the passphrase turning on
 * two-step sign-in to lock the owner out — the break-glass reset in
 * docs/OWNER-SECURITY.md undoes that). Event names and times only: never
 * codes, keys, IP addresses or customer data.
 */
export type SecurityEvent = "wrong-code" | "mfa-on" | "mfa-off" | "recovery-used" | "signed-out-everywhere";

const TEXT: Record<SecurityEvent, { subject: string; body: string }> = {
  "wrong-code": {
    subject: "Security: wrong two-step code after a correct passphrase",
    body: "Someone entered the correct owner passphrase but then a wrong two-step code. If this wasn't you, change the passphrase now.",
  },
  "mfa-on": {
    subject: "Security: two-step sign-in was turned on",
    body: "Two-step sign-in was set up for the FunkSquish owner area, and every other device was signed out. If this wasn't you, change the passphrase and use the lock-out reset.",
  },
  "mfa-off": {
    subject: "Security: two-step sign-in was turned off",
    body: "Two-step sign-in was turned off for the FunkSquish owner area, and every device was signed out. If this wasn't you, change the passphrase now and set it up again.",
  },
  "recovery-used": {
    subject: "Security: a recovery code was used to sign in",
    body: "A one-time recovery code was used to sign in to the FunkSquish owner area. If this wasn't you, change the passphrase now and make new recovery codes.",
  },
  "signed-out-everywhere": {
    subject: "Security: all owner-area devices were signed out",
    body: "Someone used \"Sign out all devices\" in the FunkSquish owner area. If this wasn't you, change the passphrase.",
  },
};

export function securityEmail(event: SecurityEvent, at: Date) {
  const t = TEXT[event];
  const when = at.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
  return {
    subject: t.subject,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0e2a5c"><h2>Owner area security</h2><p>${t.body}</p><p>When: ${when} (Eastern Time). Steps: docs/OWNER-SECURITY.md.</p></body></html>`,
  };
}

/** Best effort: sends only when the owner's notification email is configured. Returns what happened. */
export async function sendSecurityEmail(event: SecurityEvent, env: Record<string, string | undefined> = process.env, at = new Date()): Promise<"sent" | "not-configured" | "failed"> {
  const to = env.PARTNER_NOTIFY_EMAIL;
  const from = env.PARTNER_NOTIFY_FROM;
  const key = env.BREVO_API_KEY;
  if (!to || !from || !key) return "not-configured";
  const msg = securityEmail(event, at);
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender: { name: "FunkSquish website", email: from }, to: [{ email: to }], subject: msg.subject, htmlContent: msg.html, tags: ["owner-security"] }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
