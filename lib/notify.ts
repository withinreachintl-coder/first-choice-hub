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

export async function slackAlert(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}
