"use client";
import { useState } from "react";
import { createProject } from "@/app/services/actions";
import { ServiceSubmit } from "./service-submit";

const options = [{ code: "mix", title: "Mix", copy: "Equilibrio, spazio e carattere per le tue tracce." }, { code: "master", title: "Master", copy: "Definizione e resa finale del tuo mix." }, { code: "mix_master", title: "Mix & Master", copy: "Il percorso completo fino al brano finito." }];

export function ProjectRequestForm({ initialService }: { initialService: string }) {
  const [service, setService] = useState(initialService);
  return <form action={createProject} className="premium-form form-grid service-request-form">
    <label className="form-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <div className="booking-step full"><span>01</span><div><strong>Seleziona il tipo di servizio di cui hai bisogno</strong><small>Scegli il servizio: riceverai un preventivo prima di pagare.</small></div></div>
    <fieldset className="full project-service-options"><legend className="sr-only">Servizio</legend>{options.map(option => <label key={option.code} className={service === option.code ? "selected" : ""}>
      <input type="radio" name="service" value={option.code} checked={service === option.code} onChange={() => setService(option.code)} required />
      <strong>{option.title}</strong><small>{option.copy}</small>
    </label>)}</fieldset>
    <label>Titolo del brano<input name="trackTitle" required maxLength={160} placeholder="Come si chiama il tuo prossimo brano?" /></label>
    <label>Numero di tracce separate<input name="trackCount" type="number" min="1" max="200" defaultValue="1" /></label>
    <label className="full">Descrizione del progetto<textarea name="description" required minLength={10} maxLength={4000} rows={4} placeholder="Raccontami il risultato che cerchi e in che fase è il brano." /></label>
    <label className="full">Scadenza desiderata <small>facoltativa</small><input name="desiredDeadline" type="date" /></label>
    <details className="service-optional full"><summary>Aggiungi riferimenti o note <span>facoltativo</span></summary><div>
      <label>Collegamenti di riferimento <small>facoltativi</small><textarea name="referenceLinks" rows={2} maxLength={2000} placeholder="Uno o più collegamenti, se ne hai" /></label>
      <label>Note <small>facoltative</small><textarea name="notes" rows={3} maxLength={2000} placeholder="Altri dettagli che vuoi condividere" /></label>
    </div></details>
    <div className="booking-step full"><span>02</span><div><strong>Come posso ricontattarti?</strong><small>La risposta alla richiesta arriverà via email.</small></div></div>
    <label>Nome<input name="name" required minLength={2} maxLength={120} autoComplete="name" /></label>
    <label>Nome d’arte <small>facoltativo</small><input name="artistName" maxLength={120} /></label>
    <label>Email<input name="email" type="email" required autoComplete="email" /></label>
    <label>Telefono <small>facoltativo</small><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
    <ServiceSubmit label="Richiedi un preventivo" />
    <p className="service-form-note full">Nessun pagamento in questa fase. Prima concordiamo il lavoro, poi scegli se procedere.</p>
  </form>;
}
