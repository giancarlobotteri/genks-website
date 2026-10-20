import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email";
import { bookingCalendarFile, bookingReminderMessage } from "@/lib/booking-calendar";

export async function sendDueBookingReminders() {
  const db = createSupabaseAdminClient();
  const claimed = await db.rpc("claim_booking_reminders", { p_limit: 10 });
  if (claimed.error) throw new Error("Impossibile leggere i promemoria da inviare.");
  let sent = 0, failures = 0, cancelled = 0;
  for (const reminder of claimed.data ?? []) {
    // Recheck the live booking immediately before sending; never trust a stale queued email.
    const current = await db.from("bookings").select("id,reference,name,email,starts_at,ends_at,updated_at,status")
      .eq("id", reminder.booking_id).maybeSingle();
    if (current.error) { failures++; await db.rpc("finish_booking_reminder", { p_id: reminder.id, p_result: "failed", p_email_id: null }); continue; }
    const booking = current.data;
    if (!booking || booking.status !== "confirmed" || booking.email.toLowerCase() !== reminder.recipient.toLowerCase()
      || new Date(booking.starts_at).getTime() !== new Date(reminder.starts_at).getTime()
      || new Date(booking.ends_at).getTime() !== new Date(reminder.ends_at).getTime()
      || new Date(booking.starts_at).getTime() <= Date.now()) {
      await db.rpc("finish_booking_reminder", { p_id: reminder.id, p_result: "cancelled", p_email_id: null }); cancelled++; continue;
    }
    try {
      const result = await sendTransactionalEmail({ to: reminder.recipient,
        ...bookingReminderMessage({ ...booking, hours_before: reminder.hours_before }),
        serviceRequest: true, idempotencyKey: `booking-reminder-${reminder.id}`,
        calendarFile: bookingCalendarFile(booking), calendarFilename: `GENKS-${booking.reference}.ics`,
      });
      const saved = await db.rpc("finish_booking_reminder", { p_id: reminder.id, p_result: "sent", p_email_id: result.emailId });
      if (saved.error) throw new Error("Conferma dell’invio da registrare.");
      sent++;
    } catch {
      failures++;
      await db.rpc("finish_booking_reminder", { p_id: reminder.id, p_result: "failed", p_email_id: null });
    }
    if ((claimed.data?.length ?? 0) > 1) await new Promise(resolve => setTimeout(resolve, 600));
  }
  const result = { sent, failures, cancelled };
  await db.rpc("record_reminder_dispatch", { p_failures: failures });
  return result;
}
