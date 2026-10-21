"use client";

import { useRef, useState } from "react";
import { extraTimePolicy } from "@/lib/extra-time";
import { CalendarDays, Clock3 } from "lucide-react";
import { createBooking } from "@/app/services/actions";
import { ServiceSubmit } from "./service-submit";
import { recordingHourlyCents, serviceAmount, serviceRateVersion } from "@/lib/service-rates";

export function RecordingRequestForm() {
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
  async function loadAvailability(nextDate: string) {
    const request = ++requestId.current;
    setDate(nextDate); setLoading(true); setTime(""); setDuration("1");
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
  function chooseTime(slot: string) {
    setTime(slot);
    const options = durationsBySlot[slot] ?? [];
    setDuration(String(options.includes(1) ? 1 : options.filter(value => value < 1).at(-1) ?? options[0] ?? 1));
  }

  return <form action={createBooking} className="premium-form form-grid booking-form">
    <input type="hidden" name="rateVersion" value={serviceRateVersion}/><label className="form-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <input type="hidden" name="duration" value={duration}/>
    <div className="booking-step full"><span>01</span><div><strong>Scegli la data</strong><small>Prima scegli il giorno, poi uno degli orari disponibili.</small></div></div>
    <label className="date-field full"><CalendarDays size={18}/><span>Data</span><input name="date" type="date" required value={date} min={new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} onChange={(event) => void loadAvailability(event.target.value)}/></label>
    <div className="booking-step full"><span>02</span><div><strong>Scegli l’orario</strong><small>Vedrai la durata disponibile per l’orario che selezioni.</small></div></div>
    <fieldset className="full slot-fieldset"><legend><Clock3 size={17}/> Orario di inizio disponibile</legend>
      {!date && <p className="muted">Scegli una data per vedere gli orari disponibili.</p>}
      {loading && <p className="muted" role="status">Controllo degli orari disponibili…</p>}
      {availabilityError && <p className="notice error">{availabilityError}</p>}
      {!loading && date && !availabilityError && !slots.length && <p className="notice">Non ci sono orari disponibili per questo giorno.</p>}
      <div className="slot-grid">{slots.map((slot) => <label key={slot} className={time === slot ? "slot-option selected" : "slot-option"}><input type="radio" name="time" value={slot} required checked={time === slot} onChange={() => chooseTime(slot)}/><span>{slot}</span></label>)}</div>
    </fieldset>
    <div className="booking-step full"><span>03</span><div><strong>La durata della sessione</strong><small>Puoi lasciare la durata proposta oppure personalizzarla.</small></div></div>
    <div className="full booking-duration">
      <p>{time ? <>Durata: <strong>{durationLabel(Number(duration))}</strong>{!availableDurations.includes(1) && <small> Per questo orario rimane meno di un’ora disponibile.</small>}</> : "Scegli prima un orario. Se disponibile, la durata iniziale è di 1 ora."}</p>
      <details className="service-optional"><summary>Personalizza la durata <span>facoltativo</span></summary><div>
        <label>Quanto tempo ti serve?<select aria-label="Durata della sessione" value={duration} disabled={!time || loading} onChange={event => setDuration(event.target.value)}>
          {!time && <option value="1">1 ora</option>}
          {availableDurations.map(value => <option key={value} value={value}>{durationLabel(value)}</option>)}
        </select></label>
        <small>Puoi scegliere anche mezz’ore e quarti d’ora. Sono mostrate solo le durate compatibili con gli altri appuntamenti e la chiusura a mezzanotte.</small>
      </div></details>
    </div>
    <div className="booking-step full"><span>04</span><div><strong>Dettagli e contatti</strong><small>Riceverai la conferma e il riepilogo via email.</small></div></div>
    <p className="service-form-note full">Lo studio è in Via Quintina, Ponte San Giovanni, Perugia (PG). Dal lunedì al venerdì: 19:30–00:00. Sabato e domenica: 10:00–00:00. Le sessioni prenotate terminano entro mezzanotte. Eventuale tempo extra viene concordato in studio e registrato personalmente da GENKS. Prima di mezzanotte: 20 €/ora. {extraTimePolicy}</p>
    <label className="full">Collegamento di riferimento <small>facoltativo</small><input name="referenceUrl" type="url" placeholder="https://"/></label>
    <label>Nome<input name="name" required minLength={2} maxLength={120} autoComplete="name"/></label><label>Nome d’arte <small>facoltativo</small><input name="artistName"/></label>
    <label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Telefono / WhatsApp<input name="phone" type="tel" required minLength={6} maxLength={40} autoComplete="tel"/></label>
    <label className="full">Note <small>facoltative</small><textarea name="notes" rows={4} placeholder="Obiettivi della sessione, numero di artisti, informazioni utili…"/></label>
    <p className="service-form-note full"><a className="text-link" href="/services/regole">Cambi data, cancellazioni e ritardi →</a></p>
    <aside className="notice full" aria-live="polite"><strong>Totale: {serviceAmount(recordingHourlyCents * Number(duration))}</strong><p>{durationLabel(Number(duration))} × {serviceAmount(recordingHourlyCents)}/ora. Pagamento in contanti presso lo studio.</p></aside><label className="full consent-label"><input type="checkbox" name="accepted" required/>Accetto il totale di {serviceAmount(recordingHourlyCents * Number(duration))}, il pagamento in contanti e le <a className="text-link" href="/services/regole" target="_blank" rel="noopener noreferrer">regole degli appuntamenti</a>.</label><ServiceSubmit label="Conferma la prenotazione" disabled={!date || !time || loading || !availableDurations.includes(Number(duration))} />
    <p className="service-form-note full">Tutti gli orari sono indicati nel fuso italiano. La prenotazione conferma subito il tuo orario, salvo che sia appena stato occupato da un’altra persona. Pagamento in contanti presso lo studio; pagamento online con carta non disponibile. Nessun addebito automatico.</p>
  </form>;
}
