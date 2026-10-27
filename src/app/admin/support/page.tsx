import {supportInboxStatus} from "@/lib/support-inbox";
import {checkSupportInbox} from "./actions";
import { requireAdmin } from "@/lib/auth";
import {randomUUID} from "node:crypto";
import {SupportComposer} from "@/components/admin/support-composer";

export default async function SupportPage() {
  await requireAdmin();
  const support=process.env.GENKS_SUPPORT_EMAIL;const inbox=await supportInboxStatus();
  return <><header className="admin-heading"><span className="eyebrow">GENKS CUSTOMER CARE</span><h1>Assistenza</h1><p>Leggi le richieste dei clienti e rispondi con l’indirizzo dello studio.</p></header>
    <section className="admin-form-card"><h2>{support??"Email da configurare"}</h2><p>La posta in arrivo è disponibile su Resend, nella sezione Emails → Receiving. Apri il messaggio, copia l’email del cliente e rispondi dal modulo qui sotto. I messaggi inviati sono visibili in Emails → Sending.</p><a className="button button-secondary" href="https://resend.com/emails/receiving" target="_blank" rel="noopener noreferrer">Leggi la posta in arrivo ↗</a><p className="fine-print">Questa configurazione usa Resend: non crea una casella Gmail o IMAP. Gli avvisi dei nuovi messaggi possono arrivare alla tua email amministratore, senza inoltrare allegati o il testo dei clienti. Puoi gestire qui le risposte senza acquistare un nuovo servizio di posta.</p></section>
    <section className="admin-form-card"><h2>Avvisi su Gmail</h2><p>{inbox.status==='active'?'Avvisi attivi: ricevi una notifica dei nuovi messaggi su prod.genks@gmail.com.':inbox.status==='webhook_ready'?'Collegamento firmato configurato. Il primo messaggio ricevuto verificherà l’invio dell’avviso.':inbox.status==='restricted'?'La credenziale Resend attuale consente l’invio ma non la lettura della posta ricevuta. Serve autorizzare la ricezione prima di poter inviare gli avvisi.':inbox.status==='delivery_pending'?'Messaggi rilevati; alcuni avvisi sono in attesa di invio.':'Verifica il collegamento per attivare gli avvisi dei nuovi messaggi.'}</p><p>Il controllo usa il processo automatico GENKS già esistente. I messaggi precedenti all’attivazione non generano avvisi retroattivi.</p><form action={checkSupportInbox}><button className="button button-primary">Verifica e aggiorna gli avvisi</button></form></section>
    <section className="admin-form-card"><h2>Rispondi a un cliente</h2><p>Mittente: GENKS {support?`· ${support}`:""}. Le risposte del cliente tornano allo stesso indirizzo.</p>{support?<SupportComposer nonce={randomUUID()}/>:<p className="notice">Completa prima la configurazione dell’indirizzo di assistenza.</p>}</section>
  </>;
}
