import { requireAdmin } from "@/lib/auth";
import { CalendarConnect } from "@/components/admin/calendar-connect";
import { OperationNotice } from "@/components/admin/operation-notice";
import { calendarFeedToken } from "@/lib/calendar-feed";
import { hasGoogleCalendar } from "@/lib/google-calendar";
import { italianLabel } from "@/lib/italian";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateSiteSetting, repairStripeConfiguration } from "../actions";
import { privatePreview, stripeTestMode } from "@/lib/preview-mode";
import { stripeReadiness } from "@/lib/stripe-readiness";
export default async function Settings({searchParams}:{searchParams:Promise<{notice?:string}>}) {
  await requireAdmin();
  const q=await searchParams;const db=createSupabaseAdminClient();
  const [{data,error},stripe]=await Promise.all([db.from("site_settings").select("key,value,updated_at").order("key"),stripeReadiness()]);
  if(error)throw new Error("Impossibile leggere le impostazioni.");
  const calendarAdded=Boolean(data?.find(x=>x.key==="calendar_subscription")?.value?.google_calendar_id);
  return <><header className="admin-heading"><h1>Impostazioni</h1><p>Stato dei collegamenti necessari per gestire il negozio e lo studio.</p></header><OperationNotice code={q.notice}/>
    <div className="metric-grid"><article><span>Google Calendar</span><strong>{hasGoogleCalendar?"Collegamento diretto":calendarAdded?"Agenda GENKS aggiunta":"Agenda da aggiungere"}</strong><small>{hasGoogleCalendar?"Disponibilità letta dal calendario condiviso.":"Sessioni e scadenze inviate all’agenda. Aggiornamento periodico: gli impegni personali su Google non bloccano il sito."}</small></article><article><span>Accesso al sito</span><strong>{privatePreview?"Privato":"Pubblico"}</strong></article><article><span>Pagamenti Stripe</span><strong>{!process.env.STRIPE_SECRET_KEY?"Non configurati":stripeTestMode()?"Modalità di prova":"Credenziale reale configurata"}</strong><small>L’uso di credenziali reali non sostituisce la verifica del venditore e dei documenti.</small></article><article><span>Email transazionali</span><strong>{process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL?"Configurate":"Da configurare"}</strong><small>Gli errori e gli invii da ritentare sono visibili nella Panoramica.</small></article></div>
    <section className="admin-form-card"><h2>Conferme di pagamento</h2><p className={stripe.ready?"notice success":"notice error"}>{stripe.message}</p>{stripe.accountId&&<p className="fine-print">Account Stripe usato dal sito: <code>{stripe.accountId}</code>. Verifica lo stesso account e lo stesso ambiente nella dashboard Stripe.</p>}<form action={repairStripeConfiguration}><button className="button button-secondary">Verifica e aggiorna eventi Stripe</button></form><p className="fine-print">Aggiorna gli eventi ricevuti dal sito nell’ambiente già configurato. Non attiva i pagamenti reali e non effettua addebiti.</p></section>
    {calendarFeedToken()&&<CalendarConnect url={`${process.env.NEXT_PUBLIC_SITE_URL||"https://www.prodbygenks.com"}/api/calendar/feed?token=${calendarFeedToken()}`}/>}
    <details className="admin-form-card"><summary>Impostazioni avanzate</summary><div className="admin-cards">{data?.filter(x=>["commerce","booking","customer_segments"].includes(x.key)).map(x=><article key={x.key}><div><strong>{italianLabel(x.key)}</strong><small>Aggiornato {new Date(x.updated_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}</small></div><form action={updateSiteSetting} className="settings-editor"><input type="hidden" name="key" value={x.key}/><textarea name="value" rows={8} defaultValue={JSON.stringify(x.value,null,2)}/><button className="button button-primary">Salva impostazione</button></form></article>)}</div></details>
  </>;
}
