import { Resend } from "resend";

// Notifications are best-effort: a failure here must never block saving a work
// order. Callers wrap these in try/catch.

export async function sendEmail(subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = (process.env.FC_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!key || to.length === 0) return;

  const resend = new Resend(key);
  await resend.emails.send({
    from: process.env.FC_FROM_EMAIL ?? "First Choice Hub <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
}

/**
 * Send to an explicit recipient list. Used by the scheduled executive reports,
 * which go to FC_REPORT_EMAILS when set and otherwise fall back to the normal
 * work-order notification list.
 */
export async function sendEmailTo(
  to: string[],
  subject: string,
  html: string
): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const list = to.map((s) => s.trim()).filter(Boolean);
  if (!key) return { sent: false, reason: "RESEND_API_KEY not set" };
  if (list.length === 0) return { sent: false, reason: "no recipients configured" };

  const resend = new Resend(key);
  await resend.emails.send({
    from: process.env.FC_FROM_EMAIL ?? "First Choice Hub <onboarding@resend.dev>",
    to: list,
    subject,
    html,
  });
  return { sent: true };
}

/** Recipients for scheduled reports. */
export function reportRecipients(): string[] {
  const raw = process.env.FC_REPORT_EMAILS || process.env.FC_NOTIFY_EMAILS || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function slackAlert(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}
