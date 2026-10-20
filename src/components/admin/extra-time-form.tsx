"use client";
import { useState } from "react";
import { setBookingExtraTime } from "@/app/admin/cash-actions";
import { ServiceSubmit } from "@/components/services/service-submit";
import { serviceAmount } from "@/lib/service-rates";
export function ExtraTimeForm({ id, minutes, base }: { id: string; minutes: number; base: number }) {
  const [value, setValue] = useState(String(minutes));
  const amount = Number(value);
  const valid = value !== "" && Number.isInteger(amount) && amount >= 0 && amount <= 1440;
  return <details><summary>Registra o correggi il tempo extra effettivo</summary><form action={setBookingExtraTime} className="premium-form">
    <input name="id" type="hidden" value={id}/><input name="expectedMinutes" type="hidden" value={minutes}/>
    <label>Minuti extra totali oltre la sessione prenotata<input name="minutes" type="number" min="0" max="1440" step="1" required value={value} onChange={event=>setValue(event.target.value)}/></label>
    <p>Inserisci il totale dei minuti extra, anche se prosegui dopo mezzanotte. Correggere questo numero sostituisce il valore precedente: non lo somma una seconda volta.</p>
    <p aria-live="polite">{valid ? `Totale aggiornato: ${serviceAmount(base + Math.round(amount * 2000 / 60))} · supplemento ${serviceAmount(Math.round(amount * 2000 / 60))}` : "Inserisci un numero intero di minuti valido."}</p>
    <label><input name="confirm" type="checkbox" required/>Confermo il tempo extra effettivamente svolto e comunicato al cliente.</label>
    <ServiceSubmit label="Aggiorna il totale da incassare" disabled={!valid}/>
    <p>Il cliente riceve il riepilogo via email. Registra i contanti ricevuti solo dopo aver aggiornato il tempo extra; nessun incasso è automatico.</p>
  </form></details>;
}
