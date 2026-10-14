"use client";

import { useRef, useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { createBooking } from "@/app/services/actions";
import { ServiceSubmit } from "./service-submit";

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
    <div className="booking-step full"><span>01</span><div><strong>Scegli durata e giorno</strong><small>Vengono mostrati solo gli orari che permettono di completare l’intera sessione.</small></div></div>
    <label>Durata<select name="duration" value={duration} onChange={(event) => { const next = event.target.value; setDuration(next); if (date) void loadAvailability(date, next); }}><option value="1">1 ora</option><option value="2">2 ore</option><option value="3">3 ore</option><option value="4">4 ore</option></select></label>
    <label className="date-field"><CalendarDays size={18}/><span>Data</span><input name="date" type="date" required value={date} min={new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} onChange={(event) => void loadAvailability(event.target.value)}/></label>
    <fieldset className="full slot-fieldset"><legend><Clock3 size={17}/> Orario di inizio disponibile</legend>
      {!date && <p className="muted">Scegli una data per vedere gli orari disponibili.</p>}
      {loading && <p className="muted" role="status">Controllo degli orari disponibili…</p>}
      {availabilityError && <p className="notice error">{availabilityError}</p>}
      {!loading && date && !availabilityError && !slots.length && <p className="notice">Non ci sono orari disponibili per questo giorno.</p>}
      <div className="slot-grid">{slots.map((slot) => <label key={slot} className={time === slot ? "slot-option selected" : "slot-option"}><input type="radio" name="time" value={slot} required checked={time === slot} onChange={() => setTime(slot)}/><span>{slot}</span></label>)}</div>
    </fieldset>
    <div className="booking-step full"><span>02</span><div><strong>Dettagli della sessione</strong><small>Aggiungi un riferimento facoltativo per la sessione.</small></div></div>
    <label className="full">Collegamento di riferimento <small>facoltativo</small><input name="referenceUrl" type="url" placeholder="https://"/></label>
    <div className="booking-step full"><span>03</span><div><strong>I tuoi dati</strong><small>La richiesta resta in attesa fino all’approvazione di GENKS.</small></div></div>
    <label>Nome<input name="name" required autoComplete="name"/></label><label>Nome d’arte <small>facoltativo</small><input name="artistName"/></label>
    <label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Telefono / WhatsApp<input name="phone" type="tel" required autoComplete="tel"/></label>
    <label className="full">Note <small>facoltative</small><textarea name="notes" rows={4} placeholder="Obiettivi della sessione, numero di artisti, informazioni utili…"/></label>
    <ServiceSubmit label="Invia la richiesta" disabled={!date || !time || loading} />
    <p className="service-form-note full">Scegli l’orario, invia la richiesta e attendi la conferma di GENKS. Nessun addebito automatico.</p>
  </form>;
}
