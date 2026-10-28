"use server";
import { requireAdmin } from "@/lib/auth";
import { sendTransactionalEmail } from "@/lib/email";
import { bookingCalendarFile, bookingReminderMessage } from "@/lib/booking-calendar";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { queueNotification, flushNotifications } from "@/lib/notifications";
export async function sendBookingAlertPreview() {
  const user = await requireAdmin();
  const key = `booking-alert-preview-${user.id}-${Math.floor(Date.now()/300000)}`;
  try {
    await queueNotification(key, { to: "prod.genks@gmail.com", subject: "GENKS · TEST avviso prenotazione Gmail", heading: "Hai una nuova prenotazione", body: "Questa è una prova dell’avviso GENKS per le nuove prenotazioni automatiche. Non è stata creata una prenotazione reale e non è richiesto alcun pagamento.\nServizio: Registrazione in studio\nTariffa: 20 EUR/ora\nRiferimento: BKG-ANTEPRIMA\nCliente: Esempio grafico GENKS\nEmail cliente: prod.genks@gmail.com\nLe nuove prenotazioni saranno già confermate: non dovrai approvarle. Per vedere gli avvisi sull’iPhone, abilita le notifiche Gmail nelle impostazioni di iOS e dell’app.", serviceRequest: true });
    await flushNotifications({ prefix: key, limit: 1, throwOnFailure: true });
  } catch { redirect("/admin/bookings?notice=booking_alert_preview_error"); }
  redirect("/admin/bookings?notice=booking_alert_preview_sent");
}
export async function toggleBookingReminders(form: FormData) {
  await requireAdmin();
  const enabled = form.get("enabled") === "true";
  const result = await createSupabaseAdminClient().from("site_settings").upsert({ key: "booking_reminders", value: { enabled }, updated_at: new Date().toISOString() });
  if (result.error) redirect("/admin/settings?notice=status_error");
  revalidatePath("/admin/settings");
  redirect(`/admin/settings?notice=${enabled ? "reminder_enabled" : "reminder_paused"}`);
}
export async function sendReminderPreview() {
  const user = await requireAdmin();
  if (!user.email) redirect("/admin/settings?notice=reminder_preview_error");
  const start = new Date(Date.now() + 24 * 3600000);
  const sample = { id: "preview", reference: "BKG-ANTEPRIMA", name: "GENKS", hours_before: 24,
    starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 2 * 3600000).toISOString() };
  const message = bookingReminderMessage(sample);
  try {
    await sendTransactionalEmail({ to: user.email, ...message, subject: "ANTEPRIMA · Promemoria studio GENKS",
      body: `Questa è un’anteprima grafica: non corrisponde a una prenotazione reale.\n${message.body}`,
      calendarFile: bookingCalendarFile(sample,true), calendarFilename: "GENKS-ANTEPRIMA.ics",
      serviceRequest: true, idempotencyKey: `reminder-preview-${user.id}-${Math.floor(Date.now()/300000)}` });
  } catch { redirect("/admin/settings?notice=reminder_preview_error"); }
  redirect("/admin/settings?notice=reminder_preview_sent");
}

