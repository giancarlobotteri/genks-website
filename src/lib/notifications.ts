import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email";
import { bookingCalendarFile, bookingCalendarUrl, studioAddress } from "@/lib/booking-calendar";

import {notificationPaymentGuard} from "@/lib/notification-payment-guard";
import {serviceEmailSummary} from "@/lib/service-email-summary";

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
    const agreementState=async(field:'project_id'|'booking_id',target:string)=>{
      const table=field==='project_id'?'service_projects':'bookings';
      const current=await db.from(table).select('status').eq('id',target).maybeSingle();
      const quotes=await db.from('service_quotes').select('status').eq(field,target);
      const cash=await db.from('studio_cash_agreements').select('id').eq(field,target).limit(1);
      if(current.error||quotes.error||cash.error)throw Error('Stato del pagamento da verificare.');
      if(!current.data)return null;
      return {terminal:['cancelled','rejected','no_show','refunded'].includes(current.data.status),cash:Boolean(cash.data?.length),paid:Boolean(quotes.data?.some(q=>q.status==='paid'))};
    };
    const decision=await notificationPaymentGuard(String(message.dedupe_key),{
      order:async target=>{
        const project=await db.from('service_projects').select('commerce_snapshot').eq('id',target).maybeSingle();
        const parts=await db.from('service_order_parts_v8').select('method').eq('project_id',target);
        if(project.error||parts.error)throw Error('Metodo di pagamento da verificare.');
        if(!project.data||!parts.data?.length)throw Error('Voci ordine non disponibili.');
        return {card:parts.data.some(part=>part.method==='card')};
      },
      payment:async target=>{const p=await db.from('payments').select('status').eq('id',target).maybeSingle();if(p.error)throw Error('Pagamento da verificare.');return p.data;},
      contract:target=>agreementState('project_id',target),
      reservation:async reference=>{
        const table=reference.startsWith('BKG-')?'bookings':'service_projects';
        const target=await db.from(table).select('id').eq('reference',reference).maybeSingle();
        if(target.error)throw Error('Richiesta da verificare.');
        return target.data?agreementState(table==='bookings'?'booking_id':'project_id',target.data.id):null;
      },
    });
    if(decision!=='send'){
      const saved=await db.from('notification_outbox').update(decision==='cancel'
        ?{cancelled_at:new Date().toISOString(),locked_until:null,last_error:'Conferma iniziale sostituita dalla ricevuta del pagamento verificato, oppure richiesta annullata.'}
        :{locked_until:new Date(Date.now()+15*60000).toISOString(),last_error:'In attesa del pagamento verificato.'}).eq('id',id);
      if(saved.error)throw Error('Stato notifica da aggiornare.');
      return;
    }
    let body=message.body as string;
    const bookingAlert=message.dedupe_key.match(/^reservation-(BKG-[A-Z0-9-]+)-admin$/);
    const projectAlert=message.dedupe_key.match(/^reservation-(PRJ-[A-Z0-9-]+)-admin$/);
    const money=(cents:number)=>new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(cents/100);
    const date=(value:string)=>new Date(value).toLocaleString("it-IT",{timeZone:"Europe/Rome",dateStyle:"long",timeStyle:"short"});
    if(bookingAlert){
      const result=await db.from("bookings").select("id,reference,name,email,phone,starts_at,ends_at,price_cents,notes").eq("reference",bookingAlert[1]).single();
      if(result.error||!result.data)throw new Error("Dati della prenotazione da verificare.");
      const b=result.data;
      const paid=await db.from("payments").select("id").eq("booking_id",b.id).eq("status","succeeded").limit(1);if(paid.error)throw new Error("Pagamento da verificare");const card=Boolean(paid.data?.length);
      body=["La prenotazione è già confermata. Non serve approvarla.",`Cliente: ${b.name}`,`Email cliente: ${b.email}`,`Telefono: ${b.phone||"Non indicato"}`,"Servizio: Registrazione in studio",`Inizio: ${date(b.starts_at)}`,`Fine: ${date(b.ends_at)}`,`Totale: ${b.price_cents===null?"Da concordare":money(b.price_cents)}`,card?"Pagamento: Carta · pagamento confermato":"Pagamento: Contanti presso lo studio",`Riferimento: ${b.reference}`,...(b.notes?[`Note: ${b.notes}`]:[]),card?"Pagamento online già registrato nelle Vendite. Non registrare un secondo incasso.":"Registra l’incasso soltanto dopo aver ricevuto i contanti."].join("\n");
    }
    if(projectAlert){
      const result=await db.from("service_projects").select("id,songs,reference,name,email,phone,service,track_title,track_count,price_cents,status,notes").eq("reference",projectAlert[1]).single();
      if(result.error||!result.data)throw new Error("Dati del progetto da verificare.");
      const p=result.data;
      const songLines=Array.isArray(p.songs)?p.songs.map((song,index)=>`Brano ${index+1}: ${song.trackTitle} · ${String(song.service??p.service).replaceAll("_"," + ")} · ${song.trackCount} tracce · ${money(song.amountCents)}`):[];
      body=["Hai ricevuto una nuova richiesta GENKS.",`Cliente: ${p.name}`,`Email cliente: ${p.email}`,`Telefono: ${p.phone||"Non indicato"}`,`Servizio: ${p.service.replaceAll("_"," + ")}`,`Modalità: ${p.notes?.includes("Modalità: studio") ? "Fisicamente in studio" : "A distanza"}`,`Brano: ${p.track_title}`,`Tracce audio complessive: ${p.track_count}`,...songLines,`Totale: ${p.price_cents===null?"Da concordare":money(p.price_cents)}`,`Pagamento: ${p.status==="paid"?"Carta · pagamento confermato":"Contanti presso lo studio"}`,`Riferimento: ${p.reference}`,...(p.notes?[`Note: ${p.notes}`]:[])].join("\n");
      const detail=await db.from("service_quotes").select("scope").eq("project_id",p.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(detail.error)throw new Error("Dettagli del preventivo da verificare.");
      if(detail.data)body+="\n\nVOCI DEL RIEPILOGO\n"+detail.data.scope;

    }
    let calendar: { actionUrl?: string; actionLabel?: string; calendarFile?: string; calendarFilename?: string; body?: string } = {};
    if (/^payment-[a-f0-9-]{36}$/.test(message.dedupe_key)) {
      const payment = await db.from("payments").select("booking_id,project_id,quote_id,amount_cents,currency,paid_at,review_reason,status").eq("id", message.dedupe_key.slice(8)).maybeSingle();
      if (payment.error) throw new Error("Verifica calendario del pagamento da ripetere.");
      if(payment.data?.status==="succeeded")body+=`\nTotale: ${new Intl.NumberFormat("it-IT",{style:"currency",currency:payment.data.currency}).format(payment.data.amount_cents/100)}\nData del pagamento: ${date(payment.data.paid_at)}\nMetodo: Pagamento online verificato da Stripe`;
      if(payment.data?.project_id&&payment.data.quote_id&&payment.data.status==="succeeded"){
        const detail=await db.from("service_quotes").select("scope").eq("id",payment.data.quote_id).eq("project_id",payment.data.project_id).eq("status","paid").maybeSingle();
        if(detail.error)throw new Error("Riepilogo del progetto non disponibile.");
        if(detail.data)body+="\n\nRIEPILOGO DEL TUO PROGETTO\n"+detail.data.scope;
      }
      if (payment.data?.booking_id && !payment.data.review_reason && payment.data.status === "succeeded") {
        const result = await db.from("bookings").select("id,reference,name,email,starts_at,ends_at,updated_at,status").eq("id", payment.data.booking_id).eq("status", "confirmed").maybeSingle();
        if (result.error) throw new Error("Verifica della sessione da ripetere.");
        const booking = result.data;
        if (booking && booking.email.toLowerCase() === message.recipient.toLowerCase()) {
          const date = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", dateStyle: "full", timeStyle: "short" }).format(new Date(booking.starts_at));
          calendar = { actionUrl: bookingCalendarUrl(booking,true), actionLabel: "Aggiungi a Google Calendar",
            calendarFile: bookingCalendarFile(booking,true), calendarFilename: `GENKS-${booking.reference}.ics`,
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
          calendar = { actionUrl: bookingCalendarUrl(booking,true), actionLabel: "Aggiungi a Google Calendar", calendarFile: bookingCalendarFile(booking,true), calendarFilename: `GENKS-${booking.reference}.ics`, body: `${body}\nStudio: ${studioAddress}.\nPer Apple Calendar o Outlook apri il file calendario allegato.` };
        }
      }
    }
    // Summaries use authoritative saved order/receipt data, never parsed customer notes.
    let concise:ReturnType<typeof serviceEmailSummary>|undefined;
    let documents:{filename:string;content:string}[]|undefined;
    let summaryProject:string|undefined;
    const orderMail=String(message.dedupe_key).match(/^v8-(order|owner)-([a-f0-9-]{36})$/);
    if(orderMail)summaryProject=orderMail[2];
    const paidOwner=String(message.dedupe_key).match(/^v8-paid-owner-([a-f0-9-]{36})$/);
    const paymentReceipt=String(message.dedupe_key).match(/^payment-([a-f0-9-]{36})$/);
    if(paidOwner||paymentReceipt){const r=await db.from('payments').select('project_id').eq('id',(paidOwner||paymentReceipt)![1]).maybeSingle();if(r.error)throw Error('Ordine da verificare.');summaryProject=r.data?.project_id??undefined;}
    const cashReceipt=String(message.dedupe_key).match(/^cash-v8-([a-f0-9-]{36})-(initial|balance)$/);
    if(cashReceipt){const r=await db.from('service_order_parts_v8').select('project_id').eq('id',cashReceipt[1]).single();if(r.error)throw Error('Incasso da verificare.');summaryProject=r.data.project_id;}
    if(summaryProject){
      const p=await db.from('service_projects').select('id,reference,name,artist_name,email,price_cents,commerce_snapshot').eq('id',summaryProject).single();
      if(p.error)throw Error('Ordine da verificare.');
      const owner=Boolean(orderMail?.[1]==='owner'||paidOwner);
      if(owner||p.data.email.toLowerCase()===message.recipient.toLowerCase()){
        const movements=await db.from('payments').select('amount_cents,refunded_cents').eq('project_id',p.data.id).eq('status','succeeded');if(movements.error)throw Error('Incassi da verificare.');
        const paid=(movements.data??[]).reduce((n,m)=>n+m.amount_cents-m.refunded_cents,0);
        const deadlines=await db.from('service_order_parts_v8').select('hold_until,paid_cents,initial_cents,method').eq('project_id',p.data.id);if(deadlines.error)throw Error('Scadenze da verificare.');
        const savedQuote=p.data.commerce_snapshot as {preventivo?:{righe?:{descrizione:string;prezzo:string}[]}}|null;
        concise=serviceEmailSummary({quoteLines:savedQuote?.preventivo?.righe,initialDue:(deadlines.data??[]).reduce((n,x)=>n+Math.max(0,x.initial_cents-x.paid_cents),0),cashDeadlines:(deadlines.data??[]).filter(x=>x.method==='cash'&&x.hold_until&&x.paid_cents<x.initial_cents).map(x=>x.hold_until!),reference:p.data.reference,total:p.data.price_cents??0,paid,name:p.data.name,artistName:p.data.artist_name,email:p.data.email},owner?'owner':'customer');
        if(!owner){const contract=await db.from('project_contracts').select('terms_body').eq('project_id',p.data.id).limit(1).maybeSingle();if(contract.error)throw Error('Condizioni da verificare.');if(contract.data)documents=[{filename:`Condizioni-${p.data.reference}.txt`,content:contract.data.terms_body}];}
      }
    }
    const normalMessage:Message={
      to: message.recipient, subject: /^reservation-.*-admin$/.test(message.dedupe_key) ? `GENKS · Hai una nuova prenotazione · ${message.subject.match(/(?:BKG|PRJ)-[A-Z0-9-]+/)?.[0]??"Studio"}` : message.subject, heading: /^reservation-.*-admin$/.test(message.dedupe_key) ? "Hai una nuova prenotazione" : message.heading, body,
      actionUrl: message.action_url ?? undefined, actionLabel: message.action_label ?? undefined,
      idempotencyKey: `notification-${message.id}`, serviceRequest: true,
      ...calendar,
    };
    await sendTransactionalEmail(concise?{...normalMessage,...concise,actionUrl:undefined,actionLabel:undefined,documents}:normalMessage);
    const saved = await db.from("notification_outbox").update({ sent_at: new Date().toISOString(), locked_until: null, last_error: null }).eq("id", id);
    if (saved.error) throw new Error("Invio completato, salvataggio della conferma da ripetere.");
  } catch {
    await db.from("notification_outbox").update({ locked_until: null, last_error: "Invio non confermato. Controlla Resend e riprova dal pannello." }).eq("id", id);
    throw new Error("Una notifica è in attesa di invio.");
  }
}

export async function flushNotifications(options: { prefix?: string; limit?: number; throwOnFailure?: boolean } = {}) {
  const db = createSupabaseAdminClient();
  const query = db.from("notification_outbox").select("id").is("sent_at", null).is("cancelled_at",null).or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`).order("created_at").limit(options.limit ?? 20);
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
