"use client";
import {CheckoutContactFields} from "./checkout-contact-fields";
import type {ContactContext} from "@/lib/customer-contact";
import {buildRecordingQuote} from "@/lib/recording-quote";
import {recordingStartAllowed,recordingAppointmentLabel} from "@/lib/recording-selection";

import { type PublicDiscount } from "@/lib/public-discounts";
import { useEffect, useRef, useState } from "react";
import { extraTimePolicy } from "@/lib/extra-time";
import { CalendarDays, Clock3 } from "lucide-react";
import { createBooking } from "@/app/services/actions";
import { ServiceSubmit } from "./service-submit";
import { serviceAmount, serviceRateVersion } from "@/lib/service-rates";

export function RecordingRequestForm({contact=null,discounts=[],cardReady=false,initialDuration=1}:{contact?:ContactContext|null;discounts?:PublicDiscount[];cardReady?:boolean;initialDuration?:number}) {
  const [payment,setPayment]=useState("cash");
  const [clock,setClock]=useState(()=>Date.now());
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(String(initialDuration));
  type CalendarDay = { date: string; allSlots: string[]; durationsBySlot: Record<string, number[]> };
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const shift = (day: string, offset: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+offset); return d.toISOString().slice(0,10); };
  const [page, setPage] = useState(today);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [durationsBySlot, setDurationsBySlot] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");
  const requestId = useRef(0);
  const durationLabel = (hours: number) => {
    const minutes = Math.round(hours * 60);
    return [Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} ${minutes < 120 ? "ora" : "ore"}` : "", minutes % 60 ? `${minutes % 60} minuti` : ""].filter(Boolean).join(" e ");
  };
  const quote=buildRecordingQuote(date,time,Number(duration),discounts);
  const {total,hourly,base:baseTotal,night:nightSupplement}=quote;
  const availableDurations = durationsBySlot[time] ?? [];
  const matchingSlots = slots.filter(slot => durationsBySlot[slot]?.includes(Number(duration)) && recordingStartAllowed(date,slot,payment,clock));
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),15000);return ()=>clearInterval(timer);},[]);
  function choosePayment(value:string) {
    setPayment(value);
    if(time&&!recordingStartAllowed(date,time,value,Date.now()))setTime("");
  }
  useEffect(() => {
    const controller = new AbortController();
    const request = ++requestId.current;
    void fetch(`/api/availability?${new URLSearchParams({date:page,calendar:"1"})}`, {signal:controller.signal})
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Impossibile verificare gli orari."); return body; })
      .then(body => { if(request===requestId.current) setDays(body.days ?? []); })
      .catch(error => { if(!controller.signal.aborted && request===requestId.current) setAvailabilityError(error instanceof Error ? error.message : "Riprova tra poco."); })
      .finally(() => { if(request===requestId.current) setLoading(false); });
    return () => controller.abort();
  }, [page]);
  function goPage(value: string) { setLoading(true);setAvailabilityError("");setTime("");setDate("");setDays([]);setSlots([]);setDurationsBySlot({});setPage(value); }
  function chooseDay(day: CalendarDay) {
    setDate(day.date); setTime(""); setSlots(day.allSlots); setDurationsBySlot(day.durationsBySlot);
  }
  function chooseTime(slot: string) { setTime(slot); }
  function chooseDuration(value: string) {
    setDuration(value);
    if (time && !durationsBySlot[time]?.includes(Number(value))) setTime("");
    if (date && !Object.values(durationsBySlot).some(values=>values.includes(Number(value)))) {setDate("");setTime("");setSlots([]);setDurationsBySlot({});}
  }

  return <form action={createBooking} className="premium-form form-grid booking-form">
    <input type="hidden" name="rateVersion" value={serviceRateVersion}/><label className="form-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <input type="hidden" name="payment" value={payment}/><input type="hidden" name="duration" value={duration}/><input type="hidden" name="expectedTotal" value={total}/>
    <aside className="quote-running full" aria-live="polite"><div><span>Totale sessione aggiornato</span><strong>{serviceAmount(total)}</strong></div><small>{durationLabel(Number(duration))} · supplementi selezionati inclusi</small></aside>
    <div className="booking-step full"><span>01</span><div><strong>Scegli la data</strong><small>I giorni pieni restano visibili e non sono selezionabili.</small></div></div>
    <input type="hidden" name="date" value={date}/>
    <div className="booking-calendar full">
      <div className="booking-calendar-nav"><button type="button" disabled={loading || page<=today} onClick={()=>goPage(shift(page,-14)<today?today:shift(page,-14))} aria-label="Due settimane precedenti">←</button><strong><CalendarDays size={17}/> Scegli un giorno libero</strong><button type="button" disabled={loading || shift(page,14)>shift(today,167)} onClick={()=>goPage(shift(page,14))} aria-label="Due settimane successive">→</button></div>
      <p className="calendar-key">Disponibile · Occupato · Durata non disponibile</p>{payment==="card"&&<p className="fine-print">Con carta puoi prenotare gli orari che iniziano tra più di 35 minuti, per avere il tempo di completare il pagamento.</p>}
      {loading && <p role="status">Controllo del calendario…</p>}
      {availabilityError && <p role="alert" className="notice error">{availabilityError}</p>}
      <div className="booking-days">{days.map(day=>{const open=Object.entries(day.durationsBySlot).some(([slot,values])=>values.includes(Number(duration))&&recordingStartAllowed(day.date,slot,payment,clock)); const any=Object.keys(day.durationsBySlot).length>0; return <button key={day.date} type="button" disabled={!open} aria-pressed={date===day.date} className={date===day.date?"selected":""} onClick={()=>chooseDay(day)}><span>{new Intl.DateTimeFormat("it-IT",{weekday:"short",day:"numeric",month:"short",timeZone:"Europe/Rome"}).format(new Date(`${day.date}T12:00:00Z`))}</span><small>{open?"Disponibile":any?"Durata non disponibile":day.allSlots.length?"Occupato":"Chiuso"}</small></button>;})}</div>
    </div>
    <aside className="notice full" style={{border: "1px solid #60a5fa", background: "linear-gradient(120deg, #0b2450, #102f65)", color: "#fff"}} aria-label="Tariffa dopo mezzanotte"><strong style={{color: "#fff", fontSize: "1.15rem"}}>Dopo mezzanotte: +10,00 € ogni ora</strong><p style={{color: "#dbeafe"}}>Solo per le sessioni del venerdì e del sabato. Il supplemento si aggiunge alla tariffa base di 19,99 €/ora, che continua a essere conteggiata anche dopo le 00:00.</p><p style={{color: "#fff"}}>Dopo mezzanotte: 29,99 €/ora totali, con 10,00 € di supplemento ogni ora.</p><small style={{color: "#dbeafe"}}>Calcolo proporzionale ai minuti. Il totale qui sotto include già il supplemento per l’orario scelto. Negli altri giorni si termina entro mezzanotte.</small></aside>
    <div className="booking-step full"><span>02</span><div><strong>Quanto tempo ti serve?</strong><small>Gli orari vengono filtrati per l’intera durata scelta.</small></div></div>
    <label className="full">Durata della sessione<select aria-label="Durata della sessione" value={duration} onChange={event=>chooseDuration(event.target.value)}>{Array.from({length:32},(_,i)=>(i+1)/4).map(hours=><option key={hours} value={hours}>{durationLabel(hours)}</option>)}</select><small>Puoi scegliere anche mezz’ore e quarti d’ora, fino a 8 ore.</small></label>
    <div className="booking-step full"><span>03</span><div><strong>Scegli l’orario</strong><small>Solo intervalli interamente liberi per {durationLabel(Number(duration))}.</small></div></div>
    <fieldset className="full slot-fieldset"><legend><Clock3 size={17}/> Orario di inizio disponibile</legend>
      {!date && <p className="muted">Scegli una data per vedere gli orari disponibili.</p>}
      {loading && <p className="muted" role="status">Controllo degli orari disponibili…</p>}
      {availabilityError && <p className="notice error">{availabilityError}</p>}
      {!loading && date && !availabilityError && !matchingSlots.length && <p className="notice" role="status">Non ci sono orari liberi per questa durata. Cambia giorno oppure scegli una durata più breve.</p>}
      <div className="slot-grid">{slots.map(slot=>{const available=matchingSlots.includes(slot); const occupied=!durationsBySlot[slot]?.length; const tooClose=!recordingStartAllowed(date,slot,payment,clock); return <label key={slot} className={`slot-option ${time===slot?"selected":""} ${!available?"slot-unavailable":""}`}><input type="radio" name="time" value={slot} required disabled={!available} checked={time===slot} onChange={()=>chooseTime(slot)}/><span>{slot}<small>{available?"Disponibile":occupied?"Occupato":tooClose?"Anticipo insufficiente":"Durata non disponibile"}</small></span></label>;})}</div>
    </fieldset>
    <div className="booking-step full"><span>04</span><div><strong>Dettagli e contatti</strong><small>Riceverai la conferma e il riepilogo via email.</small></div></div>
    <details className="service-optional full"><summary>Studio, orari e tempo extra</summary><p className="service-form-note">Lo studio è in Ponte San Giovanni (PG). Dal lunedì al venerdì: 19:30–00:00. Sabato e domenica: 10:00–00:00. Venerdì e sabato la durata scelta può proseguire oltre mezzanotte. Negli altri giorni si termina entro le 00:00. Eventuale tempo extra viene concordato in studio e registrato personalmente da GENKS. Tempo extra prima di mezzanotte: 19,99 €/ora, escluso dagli sconti sulla sessione prenotata. {extraTimePolicy}</p></details>
    <details className="service-optional full"><summary>Riferimenti e note facoltativi</summary><div><label className="full">Collegamento di riferimento <small>facoltativo</small><input name="referenceUrl" type="url" placeholder="https://"/></label>
    <label className="full">Note <small>facoltative</small><textarea name="notes" rows={4} placeholder="Obiettivi della sessione, numero di artisti, informazioni utili…"/></label>
    </div></details><CheckoutContactFields key={contact?.userId??"guest"} context={contact} phoneRequired next="/services/recording"/>
    <p className="service-form-note full"><a className="text-link" href="/services/regole">Cambi data, cancellazioni e ritardi →</a></p>
    <fieldset className="payment-choice full"><legend>Come vuoi pagare?</legend><label><input type="radio" name="paymentChoice" checked={payment==="card"} disabled={!cardReady} onChange={()=>choosePayment("card")}/><span>Carta o Apple Pay online</span></label><label><input type="radio" name="paymentChoice" checked={payment==="cash"} onChange={()=>choosePayment("cash")}/><span>Contanti in studio</span></label></fieldset><aside className="quote-current full" aria-live="polite"><strong>Totale: {serviceAmount(total)}</strong>{date&&time&&<p className="booking-appointment"><strong>Il tuo appuntamento</strong><br/>{recordingAppointmentLabel(date,time,Number(duration))}</p>}<p>Sessione: {durationLabel(Number(duration))} × {serviceAmount(hourly)}/ora = <strong>{serviceAmount(baseTotal)}</strong></p>{nightSupplement > 0 && <p style={{color:"#bfdbfe", borderLeft:"3px solid #60a5fa", paddingLeft:"12px"}}><strong>Supplemento dopo mezzanotte: +{serviceAmount(nightSupplement)}</strong><br/>Già incluso nel totale. Si aggiunge alla tariffa base: 10,00 € ogni ora dopo le 00:00.</p>}{quote.minimum>0&&<p>Minimo di pagamento: +{serviceAmount(quote.minimum)}</p>}<p>{payment==="card"?"Carta o Apple Pay · pagamento sicuro su Stripe.":"Pagamento in contanti presso lo studio."}</p></aside><label className="full consent-label"><input type="checkbox" name="accepted" required/>Accetto il totale di {serviceAmount(total)}, il pagamento {payment==="card"?"con carta tramite Stripe":"in contanti"} e le <a className="text-link" href="/services/regole" target="_blank" rel="noopener noreferrer">regole degli appuntamenti</a>.</label><ServiceSubmit label={payment==="card"?"Continua al pagamento":"Conferma la prenotazione"} disabled={!date || !time || loading || !availableDurations.includes(Number(duration))||!matchingSlots.includes(time)} />

    <p className="service-form-note full">Tutti gli orari sono indicati nel fuso italiano. La disponibilità viene ricontrollata alla conferma per evitare sovrapposizioni. {payment==="card"?"L’orario resta riservato temporaneamente mentre completi il pagamento. La prenotazione è confermata solo dopo verifica Stripe. Per la carta scegli un inizio almeno 35 minuti nel futuro.":"Paghi in contanti presso lo studio, senza addebiti online."}</p>
  </form>;
}
