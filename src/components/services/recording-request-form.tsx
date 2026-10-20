"use client";

import { useRef, useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { createBooking } from "@/app/services/actions";
import { ServiceSubmit } from "./service-submit";
import { recordingHourlyCents, serviceAmount, serviceRateVersion } from "@/lib/service-rates";

export function RecordingRequestForm() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("1");
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const requestId = useRef(0);
  async function loadAvailability(nextDate: string, nextDuration = duration) {
    const request = ++requestId.current;
    setDate(nextDate);
    setLoading(true); setTime(""); setAvailabilityError("");
    setSlots([]);
    if (!nextDate) { setLoading(false); return; }
    try {
      const params = new URLSearchParams({ date: nextDate, duration: nextDuration });
      const response = await fetch(`/api/availability?${params.toString()}`);
      const body = await response.json();
      if (request !== requestId.current) return;
      if (!response.ok) throw new Error(body.error ?? "Non è stato possibile caricare gli orari disponibili.");
      setSlots(body.slots ?? []);
    } catch (error) {
      if (request !== requestId.current) return;
      setSlots([]); setAvailabilityError(error instanceof Error ? error.message : "Non è stato possibile caricare gli orari disponibili.");
    } finally { if (request === requestId.current) setLoading(false); }
  }

  return <form action={createBooking} className="premium-form form-grid booking-form">
    <input type="hidden" name="rateVersion" value={serviceRateVersion}/><label className="form-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <div className="booking-step full"><span>01</span><div><strong>Scegli durata e giorno</strong><small>Vengono mostrati solo gli orari che permettono di completare l’intera sessione.</small></div></div>
    <label>Durata<select name="duration" value={duration} onChange={(event) => { const next = event.target.value; setDuration(next); if (date) void loadAvailability(date, next); }}><option value="1">1 ora</option><option value="2">2 ore</option><option value="3">3 ore</option><option value="4">4 ore</option><option value="6">6 ore</option><option value="8">8 ore</option></select></label>
    <label className="date-field"><CalendarDays size={18}/><span>Data</span><input name="date" type="date" required value={date} min={new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} onChange={(event) => void loadAvailability(event.target.value)}/></label>
    <fieldset className="full slot-fieldset"><legend><Clock3 size={17}/> Orario di inizio disponibile</legend>
      {!date && <p className="muted">Scegli una data per vedere gli orari disponibili.</p>}
      {loading && <p className="muted" role="status">Controllo degli orari disponibili…</p>}
      {availabilityError && <p className="notice error">{availabilityError}</p>}
      {!loading && date && !availabilityError && !slots.length && <p className="notice">Non ci sono orari disponibili per questo giorno.</p>}
      <div className="slot-grid">{slots.map((slot) => <label key={slot} className={time === slot ? "slot-option selected" : "slot-option"}><input type="radio" name="time" value={slot} required checked={time === slot} onChange={() => setTime(slot)}/><span>{slot}</span></label>)}</div>
    </fieldset>
    <div className="booking-step full"><span>02</span><div><strong>Dettagli della sessione</strong><small>Aggiungi un riferimento facoltativo per la sessione.</small></div></div>
    <p className="service-form-note full">Lo studio è in Via Quintina, Ponte San Giovanni, Perugia (PG). Dal lunedì al venerdì: 19:30–01:00. Nel weekend si prenota dalle 10:00. Scegli tra gli orari disponibili; per sessioni distribuite su più giorni contattaci.</p>
    <label className="full">Collegamento di riferimento <small>facoltativo</small><input name="referenceUrl" type="url" placeholder="https://"/></label>
    <div className="booking-step full"><span>03</span><div><strong>I tuoi dati</strong><small>Ricevi subito la conferma via email. Non serve attendere un’approvazione.</small></div></div>
    <label>Nome<input name="name" required minLength={2} maxLength={120} autoComplete="name"/></label><label>Nome d’arte <small>facoltativo</small><input name="artistName"/></label>
    <label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Telefono / WhatsApp<input name="phone" type="tel" required minLength={6} maxLength={40} autoComplete="tel"/></label>
    <label className="full">Note <small>facoltative</small><textarea name="notes" rows={4} placeholder="Obiettivi della sessione, numero di artisti, informazioni utili…"/></label>
    <p className="service-form-note full"><a className="text-link" href="/services/regole">Cambi data, cancellazioni e ritardi →</a></p>
    <aside className="notice full" aria-live="polite"><strong>Totale: {serviceAmount(recordingHourlyCents * Number(duration))}</strong><p>{duration} ore × {serviceAmount(recordingHourlyCents)}/ora. Pagamento in contanti presso lo studio.</p></aside><label className="full"><input type="checkbox" name="accepted" required/>Accetto il totale di {serviceAmount(recordingHourlyCents * Number(duration))}, il pagamento in contanti e le <a className="text-link" href="/services/regole" target="_blank" rel="noopener noreferrer">regole degli appuntamenti</a>.</label><ServiceSubmit label="Conferma la prenotazione" disabled={!date || !time || loading} />
    <p className="service-form-note full">Tutti gli orari sono indicati nel fuso italiano. La prenotazione conferma subito il tuo orario, salvo che sia appena stato occupato da un’altra persona. Pagamento in contanti presso lo studio; pagamento online con carta non disponibile. Nessun addebito automatico.</p>
  </form>;
}
