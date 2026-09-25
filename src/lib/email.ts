import "server-only";
import { Resend } from "resend";

const getResend = () => process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
}) {
  const resend = getResend();
  if (!resend || !process.env.RESEND_FROM_EMAIL)
    return { skipped: true as const };
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    html: `<div style="background:#050506;color:#f0f1f4;padding:40px;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;border:1px solid #24252b;border-radius:24px;padding:32px;background:#0d0e11"><div style="color:#829fff;letter-spacing:.18em;font-size:12px">GENKS</div><h1>${escapeHtml(input.heading)}</h1><p style="color:#b6b9c4;line-height:1.7">${escapeHtml(input.body)}</p>${input.actionUrl ? `<a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;margin-top:16px;padding:14px 22px;border-radius:14px;background:#2860ff;color:white;text-decoration:none">${escapeHtml(input.actionLabel ?? "Open")}</a>` : ""}</div></div>`,
  });
  return { skipped: false as const };
}

export async function sendOrderConfirmationEmail(input: {
  to: string;
  customerName: string;
  orderId: string;
  orderNumber: string;
  paidAt: Date;
  totalCents: number;
  currency: string;
  items: Array<{ beatTitle: string; licenseName: string; unitPriceCents: number }>;
}) {
  const resend = getResend();
  if (!resend || !process.env.RESEND_FROM_EMAIL) return { skipped: true as const };
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://genks-website.vercel.app").replace(/\/$/, "");
  const money = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: input.currency }).format(cents / 100);
  const itemRows = input.items.map((item) => `<tr>
    <td style="padding:16px 0;border-bottom:1px solid #252a38"><strong style="display:block;color:#fff;font-size:15px">${escapeHtml(item.beatTitle)}</strong><span style="display:block;margin-top:4px;color:#8ea7e8;font-size:13px">${escapeHtml(item.licenseName)}</span></td>
    <td style="padding:16px 0;border-bottom:1px solid #252a38;text-align:right;color:#fff;font-weight:700;white-space:nowrap">${escapeHtml(money(item.unitPriceCents))}</td>
  </tr>`).join("");
  const date = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", dateStyle: "long", timeStyle: "short" }).format(input.paidAt);
  const html = `<!doctype html><html><body style="margin:0;background:#03050a;color:#f4f6ff;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">Pagamento confermato — ordine ${escapeHtml(input.orderNumber)}</div>
    <div style="padding:32px 14px;background:radial-gradient(circle at top,#12275c 0,#050711 42%,#03050a 100%)">
      <div style="max-width:620px;margin:0 auto;overflow:hidden;border:1px solid #273b72;border-radius:28px;background:#090c15;box-shadow:0 24px 80px #000">
        <div style="padding:30px 32px 22px;text-align:center;border-bottom:1px solid #202b49;background:linear-gradient(135deg,#0d1834,#090c15)">
          <img src="${escapeHtml(`${origin}/brand/genks-logo.jpeg`)}" width="92" height="92" alt="GENKS" style="display:block;width:92px;height:92px;margin:0 auto 16px;border:1px solid #315ebe;border-radius:50%;object-fit:cover;box-shadow:0 0 34px #2860ff66" />
          <div style="color:#87a7ff;font-size:11px;font-weight:700;letter-spacing:3px">PAYMENT CONFIRMED</div>
          <h1 style="margin:12px 0 8px;color:#fff;font-size:30px;line-height:1.15">Acquisto completato.</h1>
          <p style="margin:0;color:#aeb7ca;line-height:1.6">Ciao ${escapeHtml(input.customerName)}, il pagamento è andato a buon fine.</p>
        </div>
        <div style="padding:28px 32px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:22px;border-collapse:collapse">
            <tr><td style="color:#7f8799;font-size:12px;letter-spacing:1px">ORDINE</td><td style="text-align:right;color:#fff;font-weight:700">${escapeHtml(input.orderNumber)}</td></tr>
            <tr><td style="padding-top:8px;color:#7f8799;font-size:12px;letter-spacing:1px">DATA</td><td style="padding-top:8px;text-align:right;color:#c4c9d6">${escapeHtml(date)}</td></tr>
          </table>
          <div style="color:#87a7ff;font-size:11px;font-weight:700;letter-spacing:2px">RIEPILOGO ORDINE</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${itemRows}</table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;padding:18px;border:1px solid #3155a7;border-radius:16px;background:#0d1730">
            <tr><td style="padding:18px;color:#bdc9ea;font-size:15px;font-weight:700">TOTALE PAGATO</td><td style="padding:18px;text-align:right;color:#fff;font-size:24px;font-weight:800">${escapeHtml(money(input.totalCents))}</td></tr>
          </table>
          <p style="margin:24px 0 18px;color:#aeb7ca;line-height:1.7">Le licenze e i file disponibili sono stati aggiunti alla tua Library. Accedi usando la stessa email utilizzata per l’acquisto.</p>
          <div style="text-align:center"><a href="${escapeHtml(`${origin}/account/library`)}" style="display:inline-block;padding:15px 24px;border-radius:14px;background:#2860ff;color:#fff;text-decoration:none;font-size:14px;font-weight:800;box-shadow:0 10px 34px #2860ff55">APRI LA LIBRARY</a></div>
        </div>
        <div style="padding:25px 32px;text-align:center;border-top:1px solid #202b49;background:#070910">
          <img src="${escapeHtml(`${origin}/brand/genks-logo.jpeg`)}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;margin:0 auto 10px;border-radius:50%;object-fit:cover" />
          <strong style="display:block;color:#fff;font-size:18px;letter-spacing:2px">GENKS</strong>
          <span style="display:block;margin-top:5px;color:#66708a;font-size:11px;letter-spacing:1px">BEATS &amp; PRODUCTION</span>
        </div>
      </div>
    </div>
  </body></html>`;
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: input.to,
    replyTo: process.env.GENKS_CONTACT_EMAIL || "prod.genks@gmail.com",
    subject: `Pagamento confermato — ordine ${input.orderNumber} | GENKS`,
    html,
  }, { idempotencyKey: `order-confirmation-${input.orderId}` });
  if (error) throw new Error(`Order email failed: ${error.message}`);
  return { skipped: false as const };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}
