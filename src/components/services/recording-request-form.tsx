"use client";

import { discountPrice, type PublicDiscount } from "@/lib/public-discounts";
import { useRef, useState } from "react";
import { extraTimePolicy } from "@/lib/extra-time";
import { CalendarDays, Clock3 } from "lucide-react";
import { createBooking } from "@/app/services/actions";
import { ServiceSubmit } from "./service-submit";
import { recordingHourlyCents, serviceAmount, serviceRateVersion } from "@/lib/service-rates";

export function RecordingRequestForm({discounts=[]}:{discounts?:PublicDiscount[]}) {
  const hourly=discountPrice(recordingHourlyCents,["recording","services"],discounts);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("1");
  const [slots, setSlots] = useState<string[]>([]);
  const [durationsBySlot, setDurationsBySlot] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const requestId = useRef(0);
  const durationLabel = (hours: number) => {
    const minutes = Math.round(hours * 60);
    return [Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} ${minutes < 120 ? "ora" : "ore"}` : "", minutes % 60 ? `${minutes % 60} minuti` : ""].filter(Boolean).join(" e ");
  };
  const availableDurations = durationsBySlot[time] ?? [];
  const matchingSlots = slots.filter(slot => durationsBySlot[slot]?.includes(Number(duration)));
  async function loadAvailability(nextDate: string) {
    const request = ++requestId.current;
    setDate(nextDate); setLoading(true); setTime("");
    setAvailabilityError(""); setSlots([]); setDurationsBySlot({});
    if (!nextDate) { setLoading(false); return; }
    try {
      const params = new URLSearchParams({ date: nextDate, duration: "0.25", includeDurations: "1" });
      const response = await fetch(`/api/availability?${params.toString()}`);
      const body = await response.json();
      if (request !== requestId.current) return;
      if (!response.ok) throw new Error(body.error ?? "Non è stato possibile caricare gli orari disponibili.");
      setSlots(body.slots ?? []); setDurationsBySlot(body.durationsBySlot ?? {});
    } catch (error) {
      if (request !== requestId.current) return;
      setAvailabilityError(error instanceof Error ? error.message : "Non è stato possibile caricare gli orari disponibili.");
    } finally { if (request === requestId.current) setLoading(false); }
  }
  function chooseTime(slot: string) { setTime(slot); }
  function chooseDuration(value: string) {
    setDuration(value);
    if (time && !durationsBySlot[time]?.includes(Number(value))) setTime("");
  }

  return <form action={createBooking} className="premium-form form-grid booking-form">
    <input type="hidden" name="rateVersion" value={serviceRateVersion}/><label className="form-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <input type="hidden" name="duration" value={duration}/><input type="hidden" name="expectedTotal" value={Math.max(50,Math.round(hourly*Number(duration)))}/>
    <div className="booking-step full"><span>01</span><div><strong>Scegli la data</strong><small>Prima scegli il giorno, poi uno degli orari disponibili.</small></div></div>
    <label className="date-field full"><CalendarDays size={18}/><span>Data</span><input name="date" type="date" required value={date} min={new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} onChange={(event) => void loadAvailability(event.target.value)}/></label>
    <div className="booking-step full"><span>02</span><div><strong>Quanto tempo ti serve?</strong><small>Gli orari vengono filtrati per l’intera durata scelta.</small></div></div>
    <label className="full">Durata della sessione<select aria-label="Durata della sessione" value={duration} onChange={event=>chooseDuration(event.target.value)}>{Array.from({length:32},(_,i)=>(i+1)/4).map(hours=><option key={hours} value={hours}>{durationLabel(hours)}</option>)}</select><small>Puoi scegliere anche mezz’ore e quarti d’ora, fino a 8 ore.</small></label>
    <div className="booking-step full"><span>03</span><div><strong>Scegli l’orario</strong><small>Solo orari liberi per {durationLabel(Number(duration))}, entro la chiusura.</small></div></div>
    <fieldset className="full slot-fieldset"><legend><Clock3 size={17}/> Orario di inizio disponibile</legend>
      {!date && <p className="muted">Scegli una data per vedere gli orari disponibili.</p>}
      {loading && <p className="muted" role="status">Controllo degli orari disponibili…</p>}
      {availabilityError && <p className="notice error">{availabilityError}</p>}
      {!loading && date && !availabilityError && !matchingSlots.length && <p className="notice" role="status">Non ci sono orari liberi per questa durata. Cambia giorno oppure scegli una durata più breve.</p>}
      <div className="slot-grid">{matchingSlots.map(slot=><label key={slot} className={time===slot?"slot-option selected":"slot-option"}><input type="radio" name="time" value={slot} required checked={time===slot} onChange={()=>chooseTime(slot)}/><span>{slot}</span></label>)}</div>
    </fieldset>
    <div className="booking-step full"><span>04</span><div><strong>Dettagli e contatti</strong><small>Riceverai la conferma e il riepilogo via email.</small></div></div>
    <details className="service-optional full"><summary>Indirizzo, orari e tempo extra</summary><p className="service-form-note">Lo studio è in Via Quintina, Ponte San Giovanni, Perugia (PG). Dal lunedì al venerdì: 19:30–00:00. Sabato e domenica: 10:00–00:00. Le sessioni prenotate terminano entro mezzanotte. Eventuale tempo extra viene concordato in studio e registrato personalmente da GENKS. Tempo extra prima di mezzanotte: 20 €/ora, escluso dagli sconti sulla sessione prenotata. {extraTimePolicy}</p></details>
    <details className="service-optional full"><summary>Riferimenti e note facoltativi</summary><div><label className="full">Collegamento di riferimento <small>facoltativo</small><input name="referenceUrl" type="url" placeholder="https://"/></label>
    <label className="full">Note <small>facoltative</small><textarea name="notes" rows={4} placeholder="Obiettivi della sessione, numero di artisti, informazioni utili…"/></label>
    </div></details><label>Nome<input name="name" required minLength={2} maxLength={120} autoComplete="name"/></label><label>Nome d’arte <small>facoltativo</small><input name="artistName"/></label>
    <label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Telefono / WhatsApp<input name="phone" type="tel" required minLength={6} maxLength={40} autoComplete="tel"/></label>
    <p className="service-form-note full"><a className="text-link" href="/services/regole">Cambi data, cancellazioni e ritardi →</a></p>
    <aside className="notice full" aria-live="polite"><strong>Totale: {serviceAmount(Math.max(50,Math.round(hourly * Number(duration))))}</strong><p>{durationLabel(Number(duration))} × {serviceAmount(hourly)}/ora. Pagamento in contanti presso lo studio.</p></aside><label className="full consent-label"><input type="checkbox" name="accepted" required/>Accetto il totale di {serviceAmount(Math.max(50,Math.round(hourly * Number(duration))))}, il pagamento in contanti e le <a className="text-link" href="/services/regole" target="_blank" rel="noopener noreferrer">regole degli appuntamenti</a>.</label><ServiceSubmit label="Conferma la prenotazione" disabled={!date || !time || loading || !availableDurations.includes(Number(duration))} />
    <p className="service-form-note full">Tutti gli orari sono indicati nel fuso italiano. La prenotazione conferma subito il tuo orario, salvo che sia appena stato occupato da un’altra persona. Pagamento in contanti presso lo studio; pagamento online con carta non disponibile. Nessun addebito automatico.</p>
  </form>;
}
