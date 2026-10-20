import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email";
import { bookingCalendarFile, bookingCalendarUrl, studioAddress } from "@/lib/booking-calendar";

type Message = Parameters<typeof sendTransactionalEmail>[0];

export async function queueNotification(key: string, input: Message) {
  const db = createSupabaseAdminClient();
  const { error } = await db.from("notification_outbox").upsert({
    dedupe_key: key, recipient: input.to, subject: input.subject, heading: input.heading,
    body: input.body, action_url: input.actionUrl ?? null, action_label: input.actionLabel ?? null,
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw new Error("Impossibile registrare la notifica da inviare.");
}

export async function deliverNotification(id: string) {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc("claim_notification", { p_id: id });
  if (error) throw new Error("Impossibile riservare la notifica.");
  const message = data?.[0];
  if (!message) return;
  try {
    let calendar: { actionUrl?: string; actionLabel?: string; calendarFile?: string; calendarFilename?: string; body?: string } = {};
    if (/^payment-[a-f0-9-]{36}$/.test(message.dedupe_key)) {
      const payment = await db.from("payments").select("booking_id,review_reason,status").eq("id", message.dedupe_key.slice(8)).maybeSingle();
      if (payment.error) throw new Error("Verifica calendario del pagamento da ripetere.");
      if (payment.data?.booking_id && !payment.data.review_reason && payment.data.status === "succeeded") {
        const result = await db.from("bookings").select("id,reference,name,email,starts_at,ends_at,updated_at,status").eq("id", payment.data.booking_id).eq("status", "confirmed").maybeSingle();
        if (result.error) throw new Error("Verifica della sessione da ripetere.");
        const booking = result.data;
        if (booking && booking.email.toLowerCase() === message.recipient.toLowerCase()) {
          const date = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", dateStyle: "full", timeStyle: "short" }).format(new Date(booking.starts_at));
          calendar = { actionUrl: bookingCalendarUrl(booking), actionLabel: "Aggiungi a Google Calendar",
            calendarFile: bookingCalendarFile(booking), calendarFilename: `GENKS-${booking.reference}.ics`,
            body: `${message.body}\nSessione in studio: ${date} · ora italiana.\nIndirizzo: ${studioAddress}.\nSalva l’appuntamento su Google Calendar oppure apri il file .ics allegato con Apple Calendar o Outlook.` };
        }
      }
    }
    if (/^cash-agree-[a-f0-9-]{36}$/.test(message.dedupe_key)) {
      const agreement = await db.from("studio_cash_agreements").select("booking_id,agreed_at").eq("id", message.dedupe_key.slice(11)).maybeSingle();
      if (agreement.error) throw new Error("Verifica dell’accordo in studio da ripetere.");
      if (agreement.data?.booking_id) {
        const result = await db.from("bookings").select("id,reference,email,starts_at,ends_at,status").eq("id", agreement.data.booking_id).eq("status", "confirmed").maybeSingle();
        if (result.error) throw new Error("Verifica calendario della sessione da ripetere.");
        if (result.data && result.data.email.toLowerCase() === message.recipient.toLowerCase()) {
          const booking = { ...result.data, updated_at: agreement.data.agreed_at };
          calendar = { actionUrl: bookingCalendarUrl(booking), actionLabel: "Aggiungi a Google Calendar", calendarFile: bookingCalendarFile(booking), calendarFilename: `GENKS-${booking.reference}.ics`, body: `${message.body}\nStudio: ${studioAddress}.\nPer Apple Calendar o Outlook apri il file calendario allegato.` };
        }
      }
    }
    await sendTransactionalEmail({
      to: message.recipient, subject: message.subject, heading: message.heading, body: message.body,
      actionUrl: message.action_url ?? undefined, actionLabel: message.action_label ?? undefined,
      idempotencyKey: `notification-${message.id}`, serviceRequest: true,
      ...calendar,
    });
    const saved = await db.from("notification_outbox").update({ sent_at: new Date().toISOString(), locked_until: null, last_error: null }).eq("id", id);
    if (saved.error) throw new Error("Invio completato, salvataggio della conferma da ripetere.");
  } catch {
    await db.from("notification_outbox").update({ locked_until: null, last_error: "Invio non confermato. Controlla Resend e riprova dal pannello." }).eq("id", id);
    throw new Error("Una notifica è in attesa di invio.");
  }
}

export async function flushNotifications(options: { prefix?: string; limit?: number; throwOnFailure?: boolean } = {}) {
  const db = createSupabaseAdminClient();
  const query = db.from("notification_outbox").select("id").is("sent_at", null).is("cancelled_at",null).order("created_at").limit(options.limit ?? 20);
  if (options.prefix) query.like("dedupe_key", `${options.prefix}%`);
  const { data, error } = await query;
  if (error) throw new Error("Impossibile leggere la coda delle notifiche.");
  let failures = 0;
  for (const item of data ?? []) {
    try { await deliverNotification(item.id); } catch { failures++; }
    if((data?.length??0)>1)await new Promise(resolve=>setTimeout(resolve,550));
  }
  if (failures && options.throwOnFailure) throw new Error("Notifiche da ritentare.");
  return { attempted: data?.length ?? 0, failures };
}
