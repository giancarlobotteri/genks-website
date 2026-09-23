import "server-only";
import { Resend } from "resend";

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
}) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
    return { skipped: true as const };
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    html: `<div style="background:#050506;color:#f0f1f4;padding:40px;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;border:1px solid #24252b;border-radius:24px;padding:32px;background:#0d0e11"><div style="color:#829fff;letter-spacing:.18em;font-size:12px">GENKS</div><h1>${escapeHtml(input.heading)}</h1><p style="color:#b6b9c4;line-height:1.7">${escapeHtml(input.body)}</p>${input.actionUrl ? `<a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;margin-top:16px;padding:14px 22px;border-radius:14px;background:#2860ff;color:white;text-decoration:none">${escapeHtml(input.actionLabel ?? "Open")}</a>` : ""}</div></div>`,
  });
  return { skipped: false as const };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}
