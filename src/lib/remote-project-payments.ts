import "server-only";
import type {ServiceQuote} from "@/lib/service-quote";
import {deliveryDateLabel} from "@/lib/service-delivery";
import {serviceTerms,serviceTermsVersion} from "@/data/legal";
import { flushNotifications } from "@/lib/notifications";
import { hasStripe } from "@/lib/env";
import { assertLiveCommerceReady } from "@/lib/commerce/live-readiness";
import { stripeReadiness } from "@/lib/stripe-readiness";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { previewRecipientAllowed, privatePreview, stripeTestMode } from "@/lib/preview-mode";
import { remoteProjectCardAllowed } from "@/lib/remote-project-policy";

// Explicit opt-in on a Vercel preview only; production can never use test payments.
const checkoutTestPreview = () => process.env.VERCEL_ENV === "preview" &&
  process.env.GENKS_SERVICE_CHECKOUT_TESTS === "true" && stripeTestMode();

export async function remoteProjectPaymentsReady() {
  if (process.env.VERCEL_ENV === "preview" && process.env.GENKS_SERVICE_CHECKOUT_TESTS === "true") console.info("GENKS checkout QA", {testMode:stripeTestMode(),hasStripe,enabled:process.env.GENKS_REMOTE_PROJECT_CARD_PAYMENTS,privatePreview});
  if (process.env.GENKS_REMOTE_PROJECT_CARD_PAYMENTS !== "true" || !hasStripe || !process.env.GENKS_STRIPE_ACCOUNT_ID) return false;
  if (!checkoutTestPreview() && (privatePreview || stripeTestMode())) return false;
  try {
    await assertLiveCommerceReady("services");
    const readiness = await stripeReadiness();
    if (checkoutTestPreview()) console.info("GENKS checkout QA readiness",readiness);
    if (!readiness.ready || readiness.accountId !== process.env.GENKS_STRIPE_ACCOUNT_ID) return false;
    const account = await getStripe().accounts.retrieve();
    return account.charges_enabled === true && account.capabilities?.card_payments === "active";
  } catch { return false; }
}

export async function openRemoteProjectPayment(data: Record<string, unknown>) {
  if (!remoteProjectCardAllowed({ enabled: await remoteProjectPaymentsReady(), type: "project", mode: String(data.mode), service: String(data.service) })) throw new Error("remote_payment_unavailable");
  if (!previewRecipientAllowed(String(data.email))) throw new Error("remote_payment_unavailable");
  if (checkoutTestPreview() && !/^prod\.genks(?:\+genks-v6-\d+)?@gmail\.com$/.test(String(data.email).trim().toLowerCase())) throw new Error("remote_payment_unavailable");
  const db = createSupabaseAdminClient();
  const serverQuote=data.serverQuote as ServiceQuote;
  if(!serverQuote || serverQuote.totalCents!==data.expectedTotal || !serverQuote.lines.length)throw new Error("invalid_quote");
  const summary=serverQuote.lines.map(l=>`${l.name} · ${l.quantity} × ${(l.unitAmount/100).toFixed(2)} EUR = ${(l.quantity*l.unitAmount/100).toFixed(2)} EUR`).join("\n")+`\nTotale: ${(serverQuote.totalCents/100).toFixed(2)} EUR\nData prevista prima versione: ${deliveryDateLabel(serverQuote.estimatedFirstVersionAt)}\n${serverQuote.estimateBasis}`;
  const prepared=await db.rpc("reserve_project_checkout_v6",{p_data:data,p_quote:serverQuote,p_summary:summary,p_terms:serviceTerms,p_terms_version:serviceTermsVersion,p_owner_email:"prod.genks@gmail.com"});
  if (prepared.error || !prepared.data) throw new Error("remote_payment_save");
  const quote = prepared.data as { id: string; project_id: string; amount_cents: number; scope: string; expires_at: string; songs?: {service?:string;trackTitle:string;trackCount:number;amountCents:number}[] };
  if(quote.amount_cents!==serverQuote.totalCents)throw new Error("quote_mismatch");
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new Error("remote_payment_unavailable");
  const session = await getStripe().checkout.sessions.create({
    mode: "payment", locale: "it", payment_method_types: ["card"], customer_email: String(data.email),
    expires_at: Math.floor(new Date(quote.expires_at).getTime() / 1000),
    line_items: serverQuote.lines.map(line=>({quantity:line.quantity,price_data:{currency:"eur",unit_amount:line.unitAmount,product_data:{name:`GENKS · ${line.name}`.slice(0,250),description:line.code==="package"?`${serverQuote.songs.length} brani · fasce nel riepilogo`:"Dettaglio nel riepilogo GENKS"}}})),
    success_url: `${origin}/checkout/success?remote_session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/services/project?payment=cancelled`,
    metadata: { project_id: quote.project_id, quote_id: quote.id, payment_type: "remote_project", fulfillment_mode: String(data.mode) },
    custom_text: {submit:{message:`Prima versione prevista: ${deliveryDateLabel(serverQuote.estimatedFirstVersionAt)}. ${serverQuote.rush?"48 ore":"7 giorni lavorativi"} da pagamento, file completi e avvio consentito. Dettagli e condizioni nel riepilogo GENKS.`}},
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