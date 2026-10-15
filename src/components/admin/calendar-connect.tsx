"use client";
import { useState } from "react";
export function CalendarConnect({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return <section className="admin-form-card calendar-connect"><span className="eyebrow">AGENDA GENKS</span><h2>Porta lo studio su Google Calendar.</h2>
    <p>Usa il tuo account Google attuale. Basta aggiungere questo calendario una volta, senza creare account tecnici o chiavi.</p>
    <ol><li>Copia il collegamento riservato qui sotto.</li><li>Apri Google Calendar dal computer. Accanto ad “Altri calendari”, premi + e scegli “Da URL”.</li><li>Incolla il collegamento e premi “Aggiungi calendario”.</li></ol>
    <label>Collegamento riservato del calendario<input readOnly value={url} onFocus={event => event.currentTarget.select()} /></label>
    <div className="admin-inline-actions"><button type="button" className="button button-primary" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Collegamento copiato" : "Copia collegamento"}</button><a className="button button-secondary" href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noreferrer">Apri Google Calendar</a></div>
    <p className="muted">Vedrai le sessioni confermate e le scadenze dei progetti pagati o in lavorazione. Google decide quando aggiornare i calendari sottoscritti: le modifiche possono richiedere diverse ore. Gli impegni del tuo calendario personale non vengono letti dal sito.</p>
    <small>Il collegamento permette di leggere l’agenda GENKS: conservalo per te. Gli eventi mostrano i riferimenti delle richieste, senza email o numeri dei clienti.</small>
  </section>;
}
