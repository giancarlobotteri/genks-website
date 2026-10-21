"use client";
import { useState } from "react";
import { createProject } from "@/app/services/actions";
import { ServiceSubmit } from "./service-submit";
import { projectRates, serviceAmount, serviceRateVersion } from "@/lib/service-rates";

const options = [{ code: "mix", title: "Mix", copy: "Equilibrio, spazio e carattere per le tue tracce." }, { code: "master", title: "Master", copy: "Definizione e resa finale del tuo mix." }, { code: "mix_master", title: "Mix & Master", copy: "Il percorso completo fino al brano finito." }];

export function ProjectRequestForm({ initialService, remoteCardReady }: { initialService: string; remoteCardReady: boolean }) {
  const [service, setService] = useState(initialService);
  const [mode, setMode] = useState("");
  const total = projectRates[service as keyof typeof projectRates];
  return <form action={createProject} className="premium-form form-grid service-request-form">
    <input type="hidden" name="rateVersion" value={serviceRateVersion}/><label className="form-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <div className="booking-step full"><span>01</span><div><strong>Seleziona il tipo di servizio di cui hai bisogno</strong><small>Scegli il servizio: il prezzo per un brano appare dopo la selezione.</small></div></div>
    <fieldset className="full project-service-options"><legend className="sr-only">Servizio</legend>{options.map(option => <label key={option.code} className={service === option.code ? "selected" : ""}>
      <input type="radio" name="service" value={option.code} checked={service === option.code} onChange={() => setService(option.code)} required />
      <strong>{option.title}</strong><small>{option.copy}</small>
    </label>)}</fieldset>
    {service && <aside className="notice full" aria-live="polite"><strong>Prezzo: {serviceAmount(total)} · 1 brano</strong><p>Il numero di tracce separate non moltiplica il prezzo.</p></aside>}
    <fieldset className="full project-mode-options"><legend>Come vuoi lavorare?</legend>
      <p>Puoi lavorare a distanza oppure fisicamente in studio. L’incontro in studio si organizza insieme e non occupa automaticamente uno slot di registrazione.</p>
      <label><input type="radio" name="mode" value="remote" required checked={mode === "remote"} onChange={() => setMode("remote")}/><span><strong>A distanza</strong><small>Invio file online · pagamento con carta tramite Stripe{!remoteCardReady && " (in preparazione)"}.</small></span></label>
      <label><input type="radio" name="mode" value="studio" required checked={mode === "studio"} onChange={() => setMode("studio")}/><span><strong>Fisicamente in studio</strong><small>Incontro da organizzare · pagamento in contanti presso lo studio.</small></span></label>
    </fieldset>
    {mode === "remote" && !remoteCardReady && <p className="notice full">Il pagamento con carta per il lavoro a distanza è in preparazione. Per informazioni <a className="text-link" href="mailto:assistenza@prodbygenks.com">contatta GENKS</a>.</p>}
    <label>Titolo del brano<input name="trackTitle" required maxLength={160} placeholder="Come si chiama il tuo prossimo brano?" /></label>
    <label>Numero di tracce separate<input name="trackCount" type="number" min="1" max="200" defaultValue="1" /></label>
    <label className="full">Descrizione del progetto<textarea name="description" required minLength={10} maxLength={4000} rows={4} placeholder="Raccontami il risultato che cerchi e in che fase è il brano." /></label>
    <label className="full">Scadenza desiderata <small>facoltativa</small><input name="desiredDeadline" type="date" /></label>
    <details className="service-optional full"><summary>Aggiungi riferimenti o note <span>facoltativo</span></summary><div>
      <label>Collegamenti di riferimento <small>facoltativi</small><textarea name="referenceLinks" rows={2} maxLength={2000} placeholder="Uno o più collegamenti, se ne hai" /></label>
      <label>Note <small>facoltative</small><textarea name="notes" rows={3} maxLength={2000} placeholder="Altri dettagli che vuoi condividere" /></label>
    </div></details>
    <div className="booking-step full"><span>02</span><div><strong>Come posso ricontattarti?</strong><small>Ricevi via email la conferma e i prossimi passi per inviare i file.</small></div></div>
    <label>Nome<input name="name" required minLength={2} maxLength={120} autoComplete="name" /></label>
    <label>Nome d’arte <small>facoltativo</small><input name="artistName" maxLength={120} /></label>
    <label>Email<input name="email" type="email" required autoComplete="email" /></label>
    <label>Telefono <small>facoltativo</small><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
    {service && <aside className="notice full" aria-live="polite"><strong>Totale: {serviceAmount(total)} · 1 brano</strong></aside>}<label className="full consent-label"><input type="checkbox" name="accepted" required/>Accetto {service ? `il totale di ${serviceAmount(total)} per un brano` : "il prezzo del servizio selezionato"} e {mode === "remote" ? "il pagamento con carta tramite Stripe" : "il pagamento in contanti presso lo studio"}. Consegna e revisioni saranno concordate prima dell’avvio del lavoro.</label><ServiceSubmit label={mode === "remote" ? "Continua al pagamento" : "Conferma la prenotazione"} disabled={!service || !mode || mode === "remote" && !remoteCardReady} />
    <p className="service-form-note full">{mode === "remote" ? "Il pagamento si completa su Stripe; la conferma arriva dopo la verifica del pagamento." : "La prenotazione in studio è confermata subito, senza addebiti online."} La scadenza desiderata è una preferenza: file, tempi di consegna e revisioni vengono definiti prima di iniziare.</p>
  </form>;
}
