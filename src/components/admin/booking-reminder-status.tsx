import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendReminderPreview, toggleBookingReminders } from "@/app/admin/reminder-actions";
export async function BookingReminderStatus() {
  await requireAdmin();
  const result = await createSupabaseAdminClient().rpc("booking_reminder_report");
  if (result.error || !result.data) return <section className="admin-form-card"><h2>Promemoria studio</h2><p className="notice error">Verifica dei promemoria non disponibile.</p></section>;
  const report = result.data;
  const time = (value?: string) => value ? new Date(value).toLocaleString("it-IT", { timeZone: "Europe/Rome" }) : "In attesa del primo controllo";
  return <section className="admin-form-card"><span className="eyebrow">APPUNTAMENTI GENKS</span><h2>Promemoria studio</h2>
    <p className={report.enabled ? "notice success" : "notice"}>{report.enabled ? "Email automatiche attive: 24 ore e 2 ore prima delle sessioni confermate." : "Promemoria in pausa: nessun invio automatico attivo."}</p>
    <div className="metric-grid"><article><span>Da inviare</span><strong>{report.waiting}</strong></article><article><span>Inviati</span><strong>{report.sent}</strong></article><article><span>Da verificare</span><strong>{report.failed}</strong></article></div>
    <p>Ultimo controllo: {time(report.scheduler?.last_checked_at)}.<br/>Ultimo collegamento riuscito: {time(report.scheduler?.last_success_at)}.</p>
    {(report.scheduler?.last_failures > 0 || report.scheduler?.last_http_status >= 400) && <p className="notice error">Alcuni invii richiedono attenzione. Controlla la quota e gli errori su Resend.</p>}
    <p className="fine-print">Il controllo avviene ogni minuto. I cambi di data o l’annullamento della sessione aggiornano la coda. Nessun promemoria viene inviato dopo l’inizio della sessione. Gli invii usano la stessa quota delle altre email GENKS.</p>
    <form action={sendReminderPreview}><button className="button button-secondary">Inviami un’email di prova</button></form>
    <form action={toggleBookingReminders}><input type="hidden" name="enabled" value={report.enabled ? "false" : "true"}/><button className="button button-secondary">{report.enabled ? "Metti in pausa i promemoria" : "Attiva i promemoria"}</button></form>
  </section>;
}
