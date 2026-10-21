import "server-only";
import { flushNotifications } from "@/lib/notifications";
import { hasStripe } from "@/lib/env";
import { assertLiveCommerceReady } from "@/lib/commerce/live-readiness";
import { stripeReadiness } from "@/lib/stripe-readiness";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { previewRecipientAllowed, privatePreview, stripeTestMode } from "@/lib/preview-mode";
import { remoteProjectCardAllowed } from "@/lib/remote-project-policy";

export async function remoteProjectPaymentsReady() {
  if (process.env.GENKS_REMOTE_PROJECT_CARD_PAYMENTS !== "true" || !hasStripe || !process.env.GENKS_STRIPE_ACCOUNT_ID) return false;
  if (privatePreview || stripeTestMode()) return false;
  try {
    await assertLiveCommerceReady("services");
    const readiness = await stripeReadiness();
    if (!readiness.ready || readiness.accountId !== process.env.GENKS_STRIPE_ACCOUNT_ID) return false;
    const account = await getStripe().accounts.retrieve();
    return account.charges_enabled === true && account.capabilities?.card_payments === "active";
  } catch { return false; }
}

export async function openRemoteProjectPayment(data: Record<string, unknown>) {
  if (!remoteProjectCardAllowed({ enabled: await remoteProjectPaymentsReady(), type: "project", mode: String(data.mode), service: String(data.service) })) throw new Error("remote_payment_unavailable");
  if (!previewRecipientAllowed(String(data.email))) throw new Error("remote_payment_unavailable");
  const db = createSupabaseAdminClient();
  const prepared = await db.rpc("reserve_remote_project", { p_data: data, p_owner_email: "prod.genks@gmail.com" });
  if (prepared.error || !prepared.data) throw new Error("remote_payment_save");
  const quote = prepared.data as { id: string; project_id: string; amount_cents: number; scope: string; expires_at: string };
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new Error("remote_payment_unavailable");
  const session = await getStripe().checkout.sessions.create({
    mode: "payment", locale: "it", payment_method_types: ["card"], customer_email: String(data.email),
    expires_at: Math.floor(new Date(quote.expires_at).getTime() / 1000),
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: quote.amount_cents,
      product_data: { name: `GENKS · ${String(data.service).replaceAll("_", " + ")} · 1 brano`, description: quote.scope.slice(0, 300) } } }],
    success_url: `${origin}/checkout/success?remote_session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/services/project?payment=cancelled`,
    metadata: { project_id: quote.project_id, quote_id: quote.id, payment_type: "remote_project", fulfillment_mode: String(data.mode) },
    custom_text: { submit: { message: "Servizio per un brano. Prima versione entro 7 giorni lavorativi dall’avvio consentito, dopo pagamento e file completi. Due revisioni incluse. Nessuno slot di registrazione viene prenotato." } },
  }, { idempotencyKey: `remote-project-${quote.id}` });
  const saved = await db.from("service_quotes").update({ stripe_session_id: session.id, checkout_url: session.url, status: "open" })
    .eq("id", quote.id).eq("status", "creating").select("id").maybeSingle();
  if (saved.error || !saved.data || !session.url) {
    if (session.status === "open") await getStripe().checkout.sessions.expire(session.id);
    throw new Error("remote_payment_save");
  }
  try { await flushNotifications({prefix: `contract-${quote.project_id}`}); } catch { console.error("Contract receipt queued for retry."); }
  return session.url;
}
