import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { remoteProjectPaymentsReady } from "@/lib/remote-project-payments";

export const dynamic = "force-dynamic";
const projectId = "8d2b5634-65cc-4b18-bb23-5571254defc5";
const quoteId = "e117fea9-1b10-479e-8905-91b882368fc4";
const reference = "PRJ-TEST-LIVE-211026";
const scope = "TEST TECNICO GENKS autorizzato dal proprietario: pagamento reale di 0,50 euro per verificare Apple Pay, conferma firmata, email e registrazione incasso. Nessun servizio musicale acquistato.";
const closesAt = new Date("2026-10-23T00:00:00+02:00").getTime();

async function preparePayment() {
  "use server";
  const owner = await requireAdmin();
  if (Date.now() >= closesAt) notFound();
  if (!await remoteProjectPaymentsReady()) throw new Error("Il collegamento Stripe non è pronto.");
  const db = createSupabaseAdminClient();
  const project = await db.from("service_projects").upsert({
    id: projectId, reference, name: "GENKS · prova del proprietario", email: owner.email!,
    track_title: "TEST TECNICO · Apple Pay · 0,50 €", service: "master", track_count: 1,
    description: scope, notes: "Prova tecnica riservata, non è un ordine di lavorazione.",
    status: "awaiting_payment", price_cents: 50,
  }, { onConflict: "id", ignoreDuplicates: true });
  if (project.error) throw new Error("Impossibile preparare la prova.");
  const quote = await db.from("service_quotes").upsert({
    id: quoteId, project_id: projectId, amount_cents: 50, currency: "EUR", scope,
    revision_count: 0, status: "creating", expires_at: new Date(Math.min(Date.now() + 23 * 3600_000, closesAt)).toISOString(),
  }, { onConflict: "id", ignoreDuplicates: true });
  if (quote.error) throw new Error("Impossibile preparare il riferimento della prova.");
  const { data: saved, error } = await db.from("service_quotes")
    .select("id,amount_cents,status,stripe_session_id,expires_at").eq("id", quoteId).eq("project_id", projectId).single();
  if (error || !saved || saved.amount_cents !== 50) throw new Error("Riferimento della prova non valido.");
  if (saved.status === "paid") redirect("/admin/payment-check");
  if (!["creating", "open"].includes(saved.status) || new Date(saved.expires_at).getTime() <= Date.now() + 31 * 60_000)
    throw new Error("La prova è scaduta: non effettuare altri pagamenti.");
  const stripe = getStripe();
  if (saved.stripe_session_id) {
    const existing = await stripe.checkout.sessions.retrieve(saved.stripe_session_id);
    if (existing.status === "complete") redirect("/admin/payment-check");
    if (existing.status !== "open" || !existing.url) throw new Error("La sessione di prova non è più aperta.");
    redirect(existing.url);
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL!;
  const session = await stripe.checkout.sessions.create({
    mode: "payment", locale: "it", payment_method_types: ["card"], customer_email: owner.email!,
    expires_at: Math.floor(new Date(saved.expires_at).getTime() / 1000),
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: 50,
      product_data: { name: "GENKS · TEST TECNICO · 0,50 €", description: scope } } }],
    metadata: { project_id: projectId, quote_id: quoteId, payment_type: "project", genks_owner_smoke: "2026-10-21" },
    success_url: `${origin}/admin/payment-check`, cancel_url: `${origin}/admin/payment-check`,
    custom_text: { submit: { message: "Pagamento reale di prova del proprietario. Importo 0,50 €. Nessun servizio musicale acquistato." } },
  }, { idempotencyKey: "genks-owner-live-check-20261021-v1" });
  if (!session.livemode || session.amount_total !== 50 || !session.url) throw new Error("La prova non corrisponde all’importo autorizzato.");
  const linked = await db.from("service_quotes").update({
    stripe_session_id: session.id, checkout_url: session.url, status: "open",
  }).eq("id", quoteId).eq("status", "creating").select("id").maybeSingle();
  if (linked.error || !linked.data) {
    const current = await db.from("service_quotes").select("stripe_session_id").eq("id", quoteId).single();
    if (current.error || current.data?.stripe_session_id !== session.id) {
      await stripe.checkout.sessions.expire(session.id);
      throw new Error("La sessione non è stata collegata: nessun pagamento da completare.");
    }
  }
  const audit = await db.from("admin_audit_log").insert({ admin_id: owner.id,
    action: "owner_live_payment_check", entity_type: "project", entity_id: projectId,
    payload: { reference, amount_cents: 50, quote_id: quoteId } });
  if (audit.error) throw new Error("Verifica del registro amministratore non riuscita.");
  redirect(session.url);
}

export default async function PaymentCheckPage() {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const { data: payment, error } = await db.from("payments")
    .select("status,amount_cents,fee_cents,refunded_cents,disputed,review_reason")
    .eq("quote_id", quoteId).eq("livemode", true).maybeSingle();
  if (error) throw new Error("Verifica del pagamento temporaneamente non disponibile.");
  const completed = payment?.status === "succeeded" && payment.amount_cents === 50
    && !payment.refunded_cents && !payment.disputed && !payment.review_reason;
  return <div className="admin-stack">
    <header><span className="eyebrow">COLLAUDO RISERVATO</span><h1>Prova Apple Pay.</h1>
      <p>Pagamento reale di 0,50 € sul tuo account Stripe GENKS. Il listino pubblico non cambia.</p></header>
    <article className="admin-panel"><h2>{completed ? "Pagamento verificato." : payment ? "Pagamento da verificare." : "Importo della prova: 0,50 €"}</h2>
      <p>Riferimento {reference}. Questa operazione controlla il collegamento di pagamento e non acquista una lavorazione musicale.</p>
      {completed ? <p>Conferma ricevuta da Stripe e incasso registrato. Controlla l’email GENKS e la sezione Vendite.
        {payment.fee_cents !== null ? ` Commissione Stripe: ${(payment.fee_cents / 100).toFixed(2).replace(".", ",")} €.` : " Commissione in aggiornamento."}</p>
        : !payment ? <form action={preparePayment}>
          <p>Apri il checkout con Safari sul tuo iPhone con Wallet configurato per usare Apple Pay. Completerai tu il pagamento; aprire la pagina non addebita nulla.</p>
          <button className="button button-primary" type="submit">Prepara il pagamento reale da 0,50 €</button>
        </form> : <p>Non ripetere il pagamento: verifica prima lo stato in Stripe.</p>}
    </article>
  </div>;
}

