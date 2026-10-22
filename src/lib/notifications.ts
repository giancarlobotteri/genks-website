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
    let body=message.body as string;
    const bookingAlert=message.dedupe_key.match(/^reservation-(BKG-[A-Z0-9-]+)-admin$/);
    const projectAlert=message.dedupe_key.match(/^reservation-(PRJ-[A-Z0-9-]+)-admin$/);
    const money=(cents:number)=>new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(cents/100);
    const date=(value:string)=>new Date(value).toLocaleString("it-IT",{timeZone:"Europe/Rome",dateStyle:"long",timeStyle:"short"});
    if(bookingAlert){
      const result=await db.from("bookings").select("reference,name,email,phone,starts_at,ends_at,price_cents,notes").eq("reference",bookingAlert[1]).single();
      if(result.error||!result.data)throw new Error("Dati della prenotazione da verificare.");
      const b=result.data;
      body=["La prenotazione è già confermata. Non serve approvarla.",`Cliente: ${b.name}`,`Email cliente: ${b.email}`,`Telefono: ${b.phone||"Non indicato"}`,"Servizio: Registrazione in studio",`Inizio: ${date(b.starts_at)}`,`Fine: ${date(b.ends_at)}`,`Totale: ${b.price_cents===null?"Da concordare":money(b.price_cents)}`,"Pagamento: Contanti presso lo studio",`Riferimento: ${b.reference}`,...(b.notes?[`Note: ${b.notes}`]:[]),"Registra l’incasso soltanto dopo aver ricevuto i contanti."].join("\n");
    }
    if(projectAlert){
      const result=await db.from("service_projects").select("songs,reference,name,email,phone,service,track_title,track_count,price_cents,status,notes").eq("reference",projectAlert[1]).single();
      if(result.error||!result.data)throw new Error("Dati del progetto da verificare.");
      const p=result.data;
      const songLines=Array.isArray(p.songs)?p.songs.map((song,index)=>`Brano ${index+1}: ${song.trackTitle} · ${song.trackCount} tracce · ${money(song.amountCents)}`):[];
      body=["Hai ricevuto una nuova richiesta GENKS.",`Cliente: ${p.name}`,`Email cliente: ${p.email}`,`Telefono: ${p.phone||"Non indicato"}`,`Servizio: ${p.service.replaceAll("_"," + ")}`,`Modalità: ${p.notes?.includes("Modalità: studio") ? "Fisicamente in studio" : "A distanza"}`,`Brano: ${p.track_title}`,`Tracce audio complessive: ${p.track_count}`,...songLines,`Totale: ${p.price_cents===null?"Da concordare":money(p.price_cents)}`,`Pagamento: ${p.status==="paid"?"Carta · pagamento confermato":"Contanti presso lo studio"}`,`Riferimento: ${p.reference}`,...(p.notes?[`Note: ${p.notes}`]:[])].join("\n");
    }
    let calendar: { actionUrl?: string; actionLabel?: string; calendarFile?: string; calendarFilename?: string; body?: string } = {};
    if (/^payment-[a-f0-9-]{36}$/.test(message.dedupe_key)) {
      const payment = await db.from("payments").select("booking_id,project_id,amount_cents,currency,paid_at,review_reason,status").eq("id", message.dedupe_key.slice(8)).maybeSingle();
      if (payment.error) throw new Error("Verifica calendario del pagamento da ripetere.");
      if(payment.data?.status==="succeeded")body+=`\nTotale: ${new Intl.NumberFormat("it-IT",{style:"currency",currency:payment.data.currency}).format(payment.data.amount_cents/100)}\nData del pagamento: ${date(payment.data.paid_at)}\nMetodo: Pagamento online verificato da Stripe`;
      if (payment.data?.booking_id && !payment.data.review_reason && payment.data.status === "succeeded") {
        const result = await db.from("bookings").select("id,reference,name,email,starts_at,ends_at,updated_at,status").eq("id", payment.data.booking_id).eq("status", "confirmed").maybeSingle();
        if (result.error) throw new Error("Verifica della sessione da ripetere.");
        const booking = result.data;
        if (booking && booking.email.toLowerCase() === message.recipient.toLowerCase()) {
          const date = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", dateStyle: "full", timeStyle: "short" }).format(new Date(booking.starts_at));
          calendar = { actionUrl: bookingCalendarUrl(booking), actionLabel: "Aggiungi a Google Calendar",
            calendarFile: bookingCalendarFile(booking), calendarFilename: `GENKS-${booking.reference}.ics`,
            body: `${body}\nSessione in studio: ${date} · ora italiana.\nIndirizzo: ${studioAddress}.\nSalva l’appuntamento su Google Calendar oppure apri il file .ics allegato con Apple Calendar o Outlook.` };
        }
      }
    }
    if (/^cash-agree-[a-f0-9-]{36}$/.test(message.dedupe_key)) {
      const agreement = await db.from("studio_cash_agreements").select("booking_id,project_id,agreed_at").eq("id", message.dedupe_key.slice(11)).maybeSingle();
      if (agreement.error) throw new Error("Verifica dell’accordo in studio da ripetere.");
      if (agreement.data) {
        const type = agreement.data.booking_id ? "bookings" : "service_projects";
        const current = await db.from(type).select("status,email").eq("id", agreement.data.booking_id || agreement.data.project_id).maybeSingle();
        if (current.error) throw new Error("Verifica della prenotazione da ripetere.");
        if (!current.data || ["cancelled", "rejected", "no_show"].includes(current.data.status) || current.data.email.toLowerCase() !== message.recipient.toLowerCase()) {
          const cancelled = await db.from("notification_outbox").update({ cancelled_at: new Date().toISOString(), locked_until: null }).eq("id", id);
          if (cancelled.error) throw new Error("Annullamento della notifica da ripetere.");
          return;
        }
      }
      if (agreement.data?.booking_id) {
        const result = await db.from("bookings").select("id,reference,email,starts_at,ends_at,status").eq("id", agreement.data.booking_id).eq("status", "confirmed").maybeSingle();
        if (result.error) throw new Error("Verifica calendario della sessione da ripetere.");
        if (result.data && result.data.email.toLowerCase() === message.recipient.toLowerCase()) {
          const booking = { ...result.data, updated_at: agreement.data.agreed_at };
          calendar = { actionUrl: bookingCalendarUrl(booking), actionLabel: "Aggiungi a Google Calendar", calendarFile: bookingCalendarFile(booking), calendarFilename: `GENKS-${booking.reference}.ics`, body: `${body}\nStudio: ${studioAddress}.\nPer Apple Calendar o Outlook apri il file calendario allegato.` };
        }
      }
    }
    await sendTransactionalEmail({
      to: message.recipient, subject: /^reservation-.*-admin$/.test(message.dedupe_key) ? `GENKS · Hai una nuova prenotazione · ${message.subject.match(/(?:BKG|PRJ)-[A-Z0-9-]+/)?.[0]??"Studio"}` : message.subject, heading: /^reservation-.*-admin$/.test(message.dedupe_key) ? "Hai una nuova prenotazione" : message.heading, body,
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
