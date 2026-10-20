type ReminderReport = {
  enabled: boolean;
  failed: number;
  scheduler?: { last_checked_at?: string | null; last_success_at?: string | null; last_failures?: number; last_http_status?: number | null };
};
export function reminderHealth(report: ReminderReport | null, now = Date.now()) {
  if (!report) return { issue: true, message: "Stato dei promemoria non disponibile: verifica il collegamento nelle Impostazioni." };
  if (!report.enabled) return { issue: false, message: "Promemoria in pausa: le email prima della sessione non vengono inviate." };
  if (report.failed > 0 || (report.scheduler?.last_failures ?? 0) > 0 || (report.scheduler?.last_http_status ?? 0) >= 400)
    return { issue: true, message: "Ci sono promemoria o invii da verificare. Controlla gli errori e la quota email nelle Impostazioni." };
  const recent = (value: string | null | undefined, maxAge: number) => {
    const time = Date.parse(value ?? "");
    return Number.isFinite(time) && time <= now + 60_000 && now - time <= maxAge;
  };
  if (!recent(report.scheduler?.last_checked_at, 5 * 60_000))
    return { issue: true, message: "Il controllo automatico dei promemoria non risulta aggiornato. Verifica il pianificatore nelle Impostazioni." };
  if (!recent(report.scheduler?.last_success_at, 20 * 60_000))
    return { issue: true, message: "Manca un collegamento recente riuscito per i promemoria. Verifica il servizio nelle Impostazioni." };
  return { issue: false, message: "Promemoria attivi: controllo automatico e collegamento al servizio aggiornati." };
}
