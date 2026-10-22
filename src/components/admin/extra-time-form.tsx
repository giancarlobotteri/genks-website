"use client";
import { useState } from "react";
import { setBookingExtraTime } from "@/app/admin/cash-actions";
import { ServiceSubmit } from "@/components/services/service-submit";
import { serviceAmount } from "@/lib/service-rates";
import { extraTimeCents, extraTimePolicy } from "@/lib/extra-time";
export function ExtraTimeForm({ id, minutes, nightMinutes, base, hourly = 2499 }: { id: string; minutes: number; nightMinutes: number; base: number; hourly?: number }) {
  const [value, setValue] = useState(String(minutes - nightMinutes));
  const [nightValue, setNightValue] = useState(String(nightMinutes));
  const amount = Number(value);
  const night = Number(nightValue);
  const valid = value !== "" && nightValue !== "" && Number.isInteger(amount) && Number.isInteger(night) && amount >= 0 && night >= 0 && amount + night <= 1440;
  return <details><summary>Registra o correggi il tempo extra effettivo</summary><form action={setBookingExtraTime} className="premium-form">
    <input name="id" type="hidden" value={id}/><input name="expectedMinutes" type="hidden" value={minutes}/><input name="expectedNightMinutes" type="hidden" value={nightMinutes}/>
    <label>Minuti extra prima di mezzanotte · {serviceAmount(hourly)}/ora<input name="minutes" type="number" min="0" max="1440" step="1" required value={value} onChange={event=>setValue(event.target.value)}/></label>
    <label>Minuti extra dopo mezzanotte · base + 9,99 € ogni mezz’ora<input name="nightMinutes" type="number" min="0" max="1440" step="1" required value={nightValue} onChange={event=>setNightValue(event.target.value)}/></label>
    <p>{hourly===2499?extraTimePolicy:"Si applica la tariffa base del contratto originale; dopo mezzanotte si aggiungono 9,99 € ogni 30 minuti, solo venerdì e sabato."}</p><p>Inserisci i minuti effettivi di ciascuna fascia. Correggere questi numeri sostituisce i valori precedenti: non li somma una seconda volta.</p>
    <p aria-live="polite">{valid ? `Totale aggiornato: ${serviceAmount(base + extraTimeCents(amount, night, hourly))} · supplemento ${serviceAmount(extraTimeCents(amount, night, hourly))}` : "Inserisci minuti interi validi, al massimo 1440 complessivi."}</p>
    <label><input name="confirm" type="checkbox" required/>Confermo il tempo extra effettivamente svolto e comunicato al cliente.</label>
    <ServiceSubmit label="Aggiorna il totale da incassare" disabled={!valid}/>
    <p>Il cliente riceve il riepilogo via email. Registra i contanti ricevuti solo dopo aver aggiornato il tempo extra; nessun incasso è automatico.</p>
  </form></details>;
}
