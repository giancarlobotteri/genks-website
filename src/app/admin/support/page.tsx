import { requireAdmin } from "@/lib/auth";
import {randomUUID} from "node:crypto";
import {SupportComposer} from "@/components/admin/support-composer";

export default async function SupportPage() {
  await requireAdmin();
  const support=process.env.GENKS_SUPPORT_EMAIL;
  return <><header className="admin-heading"><span className="eyebrow">GENKS CUSTOMER CARE</span><h1>Assistenza</h1><p>Leggi le richieste dei clienti e rispondi con l’indirizzo dello studio.</p></header>
    <section className="admin-form-card"><h2>{support??"Email da configurare"}</h2><p>La posta in arrivo è disponibile su Resend, nella sezione Emails → Receiving. Apri il messaggio, copia l’email del cliente e rispondi dal modulo qui sotto. I messaggi inviati sono visibili in Emails → Sending.</p><a className="button button-secondary" href="https://resend.com/emails/receiving" target="_blank" rel="noopener noreferrer">Leggi la posta in arrivo ↗</a><p className="fine-print">Questa configurazione usa Resend: non crea una casella Gmail o IMAP. Non inoltra automaticamente i messaggi alla tua email personale. Puoi gestire qui le risposte senza acquistare un nuovo servizio di posta.</p></section>
    <section className="admin-form-card"><h2>Rispondi a un cliente</h2><p>Mittente: GENKS {support?`· ${support}`:""}. Le risposte del cliente tornano allo stesso indirizzo.</p>{support?<SupportComposer nonce={randomUUID()}/>:<p className="notice">Completa prima la configurazione dell’indirizzo di assistenza.</p>}</section>
  </>;
}
