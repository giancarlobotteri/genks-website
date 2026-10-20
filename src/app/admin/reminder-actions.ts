"use server";
import { requireAdmin } from "@/lib/auth";
import { sendTransactionalEmail } from "@/lib/email";
import { bookingCalendarFile, bookingReminderMessage } from "@/lib/booking-calendar";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
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
      calendarFile: bookingCalendarFile(sample), calendarFilename: "GENKS-ANTEPRIMA.ics",
      serviceRequest: true, idempotencyKey: `reminder-preview-${user.id}-${Math.floor(Date.now()/300000)}` });
  } catch { redirect("/admin/settings?notice=reminder_preview_error"); }
  redirect("/admin/settings?notice=reminder_preview_sent");
}
