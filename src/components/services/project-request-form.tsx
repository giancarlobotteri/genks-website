"use client";
import { useState } from "react";
import { Banknote, CreditCard } from "lucide-react";
import styles from "./project-payment-options.module.css";
import { createProject } from "@/app/services/actions";
import { ServiceSubmit } from "./service-submit";
import { projectPrice, projectDelivery, serviceAmount, projectRateVersion } from "@/lib/service-rates";

const options = [{ code: "mix", title: "Mix", copy: "Equilibrio, spazio e carattere per le tue tracce." }, { code: "master", title: "Master", copy: "Definizione e resa finale del tuo mix." }, { code: "mix_master", title: "Mix & Master", copy: "Il percorso completo fino al brano finito." }];

export function ProjectRequestForm({ initialService, remoteCardReady }: { initialService: string; remoteCardReady: boolean }) {
  const [service, setService] = useState(initialService);
  const [mode, setMode] = useState("");
  const [payment, setPayment] = useState("");
  const [tracks, setTracks] = useState(1);
  const total = projectPrice(service, service === "master" ? 1 : tracks);
  const [earlyStart, setEarlyStart] = useState(false);
  return <form action={createProject} className="premium-form form-grid service-request-form">
    <input type="hidden" name="rateVersion" value={projectRateVersion}/><label className="form-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <div className="booking-step full"><span>01</span><div><strong>Seleziona il tipo di servizio di cui hai bisogno</strong><small>Scegli il servizio: il prezzo per un brano appare dopo la selezione.</small></div></div>
    <fieldset className="full project-service-options"><legend className="sr-only">Servizio</legend>{options.map(option => <label key={option.code} className={service === option.code ? "selected" : ""}>
      <input type="radio" name="service" value={option.code} checked={service === option.code} onChange={() => setService(option.code)} required />
      <strong>{option.title}</strong><small>{option.copy}</small>
    </label>)}</fieldset>
    {service && <aside className="notice full" aria-live="polite"><strong>{total === null ? "Oltre 48 tracce: preventivo personalizzato" : `Prezzo: ${serviceAmount(total)} · 1 brano`}</strong><p>Mix: fino a 8 tracce 99,99 €; 9–24 tracce 149,99 €; 25–48 tracce 199,99 €. Mix + master: 129,99 € / 189,99 € / 239,99 €. Master stereo: 39,99 €.</p><p>{projectDelivery}</p></aside>}
    <fieldset className="full project-mode-options"><legend>Come vuoi lavorare?</legend>
      <label><input type="radio" name="mode" value="remote" required checked={mode === "remote"} onChange={() => { setMode("remote"); if (payment === "cash") setPayment(""); }}/><span><strong>A distanza</strong><small>Invia i file online e lavora con GENKS da dove vuoi.</small></span></label>
      <label><input type="radio" name="mode" value="studio" required checked={mode === "studio"} onChange={() => setMode("studio")}/><span><strong>Fisicamente in studio</strong><small>L’incontro si organizza insieme e non prenota uno slot di registrazione.</small></span></label>
    </fieldset>
    <fieldset className={`full project-mode-options ${styles.options}`}><legend>Scegli come pagare</legend>
      <p>Puoi pagare con carta sia a distanza sia lavorando in studio. I contanti sono disponibili per il lavoro fisicamente in studio.</p>
      <label className={payment === "card" ? styles.selected : ""}><input type="radio" name="payment" value="card" required checked={payment === "card"} onChange={() => setPayment("card")} disabled={!remoteCardReady}/><CreditCard size={25} aria-hidden="true"/><span><strong>Carta · pagamento online</strong><small>Stripe · Apple Pay sui dispositivi compatibili. Disponibile sia a distanza sia in studio.</small></span></label>
      <label className={payment === "cash" ? styles.selected : ""}><input type="radio" name="payment" value="cash" required checked={payment === "cash"} onChange={() => setPayment("cash")} disabled={mode !== "studio"}/><Banknote size={25} aria-hidden="true"/><span><strong>Contanti · presso lo studio</strong><small>{mode === "studio" ? "Paghi quando vieni in studio, senza addebiti online." : "Scegli prima di lavorare fisicamente in studio per pagare in contanti."}</small></span></label>
    </fieldset>
    {!remoteCardReady && <p className="notice full">Il pagamento con carta è temporaneamente non disponibile. Per informazioni <a className="text-link" href="mailto:assistenza@prodbygenks.com">contatta GENKS</a>.</p>}
    <label>Titolo del brano<input name="trackTitle" required maxLength={160} placeholder="Come si chiama il tuo prossimo brano?" /></label>
    <label>{service === "master" ? "Un mix stereo pronto per il master" : "Numero di tracce audio separate"}<input name="trackCount" type="number" min="1" max="200" required value={service === "master" ? 1 : tracks} readOnly={service === "master"} onChange={event => setTracks(Number(event.target.value))}/><small>Conta ogni file audio mono o stereo separato. Un brano per progetto; il master stereo utilizza un solo mix, non gli stem.</small></label>{service && total === null && <p className="notice full">Per più di 48 tracce <a href="mailto:assistenza@prodbygenks.com">richiedi un preventivo</a>: nessun prezzo o pagamento automatico.</p>}
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
    {service && <aside className="notice full" aria-live="polite"><strong>Totale: {total === null ? "preventivo personalizzato" : serviceAmount(total)} · 1 brano</strong></aside>}<label className="full consent-label"><input type="checkbox" name="accepted" required/>Accetto {service && total !== null ? `il totale di ${serviceAmount(total)} per un brano` : "il prezzo del servizio selezionato"} e {payment === "card" ? "il pagamento con carta tramite Stripe" : payment === "cash" ? "il pagamento in contanti presso lo studio" : "la modalità di pagamento che selezionerò"}. Ho letto le <a href="/legal/terms" target="_blank" rel="noreferrer">condizioni del servizio e dei rimborsi</a> e l’<a href="/legal/privacy" target="_blank" rel="noreferrer">informativa privacy</a>. Sono incluse 2 revisioni; prima versione entro 7 giorni lavorativi dall’avvio consentito, dopo pagamento e file completi.</label><label className="full consent-label"><input type="checkbox" name="earlyStart" checked={earlyStart} onChange={event => setEarlyStart(event.target.checked)}/>Chiedo espressamente che il servizio inizi prima dei 14 giorni previsti per il recesso. Facoltativo: senza questa richiesta il lavoro inizia dopo tale termine.</label>{earlyStart && <label className="full consent-label"><input type="checkbox" name="withdrawalAcknowledged" required/>Riconosco che perderò il diritto di recesso solo quando il servizio sarà stato interamente eseguito. Se recedo prima, può essere dovuto solo l’importo proporzionale al lavoro effettivamente svolto, nei casi previsti dalla legge.</label>}<ServiceSubmit label={payment === "card" ? "Continua al pagamento" : "Conferma la prenotazione"} disabled={total === null || !service || !mode || !payment || payment === "card" && !remoteCardReady} />
    <p className="service-form-note full">{payment === "card" ? "Il pagamento si completa su Stripe; la conferma arriva dopo la verifica del pagamento." : payment === "cash" ? "La prenotazione in studio è confermata subito, senza addebiti online." : "Scegli la modalità di lavoro e il pagamento per proseguire."} La scadenza desiderata è una preferenza. Le 2 revisioni riguardano il materiale iniziale; nuovo materiale o lavorazioni extra richiedono un preventivo separato accettato da te.</p>
  </form>;
}
