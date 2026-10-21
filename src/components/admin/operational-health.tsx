import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { retryNotifications } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { reminderHealth } from "@/lib/reminder-health";
import { LaunchChecklist } from "./launch-checklist";

type Report={total:number;ready:number;blocked:{title:string;code:string;problems:string[]}[]};
export async function OperationalHealth() {
  await requireAdmin();
  const db=createSupabaseAdminClient();
  const [notifications,events,payments,catalog,launch,reminders]=await Promise.all([
    db.from("notification_outbox").select("id,subject,last_error,created_at,attempts",{count:"exact"}).is("sent_at",null).is("cancelled_at",null).order("created_at").limit(5),
    db.from("stripe_event_log").select("id,event_type,last_error",{count:"exact"}).not("last_error","is",null).order("created_at",{ascending:false}).limit(5),
    db.from("payments").select("id",{count:"exact",head:true}).not("review_reason","is",null),
    db.rpc("catalog_launch_report"),db.from("site_settings").select("value").eq("key","launch").single(),
    db.rpc("booking_reminder_report"),
  ]);
  if(notifications.error||events.error||payments.error||catalog.error||launch.error)throw new Error("Impossibile leggere i controlli operativi.");
  const report=catalog.data as Report;
  const reminderStatus = reminderHealth(reminders.error ? null : reminders.data);
  return <><section className="admin-form-card operational-health"><span className="eyebrow">CONTROLLO OPERATIVO</span><h2>Da completare e da verificare</h2><div className="metric-grid"><article><span>Email in attesa</span><strong>{notifications.count??0}</strong></article><article><span>Eventi Stripe da ripetere</span><strong>{events.count??0}</strong></article><article><span>Pagamenti da verificare</span><strong>{payments.count??0}</strong></article><article><span>Offerte complete nel catalogo</span><strong>{report.ready} / {report.total}</strong></article></div>
    <p className={reminderStatus.issue ? "notice error" : "notice"}>{reminderStatus.message} <Link href="/admin/settings">Apri i promemoria</Link></p>
    {(!launch.data?.value?.legal_ready||!launch.data.value.seller_ready)&&<p className="notice">La vendita online dei beat resta da completare con materiali e licenze definitivi. I pagamenti dei servizi mix e master seguono la configurazione separata visibile nelle Impostazioni.</p>}
    {!!notifications.count&&<><p>Le richieste sono salvate anche se un’email non parte. Puoi ritentare l’invio senza creare una nuova prenotazione.</p>{notifications.data?.map(n=><p key={n.id}><strong>{n.subject}</strong><small>{n.last_error??"In coda per l’invio"} · Tentativi: {n.attempts}</small></p>)}<form action={retryNotifications}><button className="button button-primary">Riprova le email in attesa</button></form></>}
    {!!events.count&&<div className="notice error"><p>Stripe ritenta automaticamente gli eventi non completati. Se persistono, controlla l’evento nella dashboard Stripe e ripeti l’invio dopo la correzione.</p>{events.data?.map(e=><p key={e.id}><strong>{e.event_type}</strong><br/>{e.last_error}<br/><small>{e.id}</small></p>)}</div>}
    {!!payments.count&&<p><Link href="/admin/analytics?status=review">Apri i pagamenti reali da verificare</Link> · <Link href="/admin/analytics?mode=test&status=review">Apri le prove da verificare</Link></p>}
    {report.blocked.length>0&&<details><summary>Licenze non ancora acquistabili · primi 30 controlli</summary>{report.blocked.map(o=><p key={`${o.title}-${o.code}`}><strong>{o.title} · {o.code.toUpperCase()}</strong><br/>{o.problems.join(" · ")}</p>)}<Link href="/admin/beats">Carica i file</Link> · <Link href="/admin/licenses">Completa i contratti</Link></details>}
  </section><LaunchChecklist ready={report.ready} total={report.total} sellerReady={launch.data?.value?.seller_ready === true} legalReady={launch.data?.value?.legal_ready === true}/></>;
}

