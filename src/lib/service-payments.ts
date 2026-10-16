import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { previewRecipientAllowed } from "@/lib/preview-mode";
import { assertLiveCommerceReady } from "@/lib/commerce/live-readiness";
import { flushNotifications, queueNotification } from "@/lib/notifications";

export async function expireServiceQuotes(type: "booking" | "project", id: string) {
  const db = createSupabaseAdminClient();
  const { data: quotes, error } = await db.from("service_quotes").select("id,stripe_session_id,status,created_at").eq(`${type}_id`, id).in("status", ["creating", "open"]);
  if (error) throw new Error("Impossibile verificare i preventivi precedenti.");
  for (const quote of quotes ?? []) {
    if (!quote.stripe_session_id) throw new Error("Un pagamento è in preparazione: ripeti la stessa richiesta prima di modificarla.");
    const session = await getStripe().checkout.sessions.retrieve(quote.stripe_session_id);
    if (session.status === "complete") throw new Error("Pagamento già completato: attendi la conferma prima di modificare il lavoro.");
    if (session.status === "open") await getStripe().checkout.sessions.expire(session.id);
    const saved = await db.from("service_quotes").update({ status: "expired" }).eq("id", quote.id).in("status", ["creating", "open"]);
    if (saved.error) throw new Error("Impossibile archiviare il preventivo precedente.");
    const cancelled=await db.from("notification_outbox").update({cancelled_at:new Date().toISOString(),last_error:"Preventivo sostituito o annullato."}).eq("dedupe_key",`quote-${quote.id}`).is("sent_at",null);
    if(cancelled.error)throw new Error("Impossibile archiviare la notifica del preventivo.");
  }
}

export async function issueServicePayment(input: {
  type: "booking" | "project"; id: string; priceCents: number; scope: string; revisions: number; deadline: string | null;
}) {
  await assertLiveCommerceReady();
  const db = createSupabaseAdminClient();
  const table = input.type === "booking" ? "bookings" : "service_projects";
  const { data: request, error } = await db.from(table).select("id,reference,email,name").eq("id", input.id).single();
  if (error || !request) throw new Error("Richiesta non trovata.");
  if (!previewRecipientAllowed(request.email)) throw new Error("Nell’anteprima privata usa l’email del proprietario.");
  const { data: previous, error: previousError } = await db.from("service_quotes").select("id,amount_cents,scope,revision_count,agreed_deadline,expires_at,status")
    .eq(`${input.type}_id`, input.id).in("status", ["creating", "open"]).maybeSingle();
  if (previousError) throw new Error("Impossibile controllare il preventivo.");
  const same = previous && previous.amount_cents === input.priceCents && previous.scope === input.scope && previous.revision_count === input.revisions && previous.agreed_deadline === input.deadline && new Date(previous.expires_at).getTime() > Date.now() + 31 * 60_000;
  if (previous && !same) await expireServiceQuotes(input.type, input.id);
  const prepared = await db.rpc("prepare_service_quote", {
    p_type: input.type, p_id: input.id, p_amount: input.priceCents, p_scope: input.scope,
    p_revisions: input.revisions, p_deadline: input.deadline,
  });
  if (prepared.error || !prepared.data) throw new Error("Richiesta non pagabile: verifica stato, scadenza e pagamenti già ricevuti.");
  const quote = Array.isArray(prepared.data) ? prepared.data[0] : prepared.data;
  if (!quote?.id) throw new Error("Preventivo non registrato.");
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new Error("Indirizzo del sito non configurato.");
  let url = quote.checkout_url as string | null;
  if (!quote.stripe_session_id) {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment", locale: "it", customer_email: request.email,
      payment_method_types: ["card"],
      expires_at: Math.floor(new Date(quote.expires_at).getTime() / 1000),
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: input.priceCents,
        product_data: { name: `GENKS · ${request.reference}`, description: input.scope.slice(0, 300) } } }],
      success_url: `${origin}/checkout/success?${input.type}=${request.id}`,
      cancel_url: `${origin}/services?payment=cancelled`,
      metadata: { [`${input.type}_id`]: request.id, quote_id: quote.id, payment_type: input.type },
      custom_text: { submit: { message: "Verifica il preventivo ricevuto via email: attività, revisioni e tempi concordati." } },
    }, { idempotencyKey: `service-quote-${quote.id}` });
    const saved = await db.from("service_quotes").update({ stripe_session_id: session.id, checkout_url: session.url, status: "open" }).eq("id", quote.id).in("status", ["creating", "open"]).select("id").maybeSingle();
    if (saved.error || !saved.data) {
      if (session.status === "open") await getStripe().checkout.sessions.expire(session.id);
      throw new Error("Il link non è stato registrato. Nessun preventivo è stato inviato: riprova.");
    }
    url = session.url;
  }
  if (!url) throw new Error("Link di pagamento non disponibile.");
  const deadline = input.deadline ? ` Scadenza concordata: ${input.deadline}.` : "";
  const expires = new Date(quote.expires_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" });
  await queueNotification(`quote-${quote.id}`, {
    to: request.email, subject: `Preventivo GENKS ${request.reference}`, heading: "Il tuo preventivo è pronto.",
    body: `Totale €${(input.priceCents / 100).toFixed(2)}. Attività incluse: ${input.scope}. Revisioni incluse: ${input.revisions}.${deadline} Link valido fino al ${expires} (ora italiana). Il pagamento conferma il preventivo concordato. Per modifiche o chiarimenti contatta GENKS prima di pagare.`,
    actionUrl: url, actionLabel: "Conferma e paga in sicurezza",
  });
  return flushNotifications({ prefix: `quote-${quote.id}` });
}
