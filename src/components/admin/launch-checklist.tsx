import "server-only";
import Link from "next/link";
import { legalDocuments } from "@/data/legal";
import { studioCashOnly } from "@/lib/studio-payment-mode";
import { remoteProjectPaymentsReady } from "@/lib/remote-project-payments";
import { stripeTestMode } from "@/lib/preview-mode";

export async function LaunchChecklist({ ready, total, sellerReady, legalReady }: { ready: number; total: number; sellerReady: boolean; legalReady: boolean }) {
  const drafts = Object.values(legalDocuments).filter(document => document.body.includes("BOZZA DA COMPLETARE"));
  const documentsReady = legalReady === true && drafts.length === 0;
  const remoteReady=await remoteProjectPaymentsReady();
  const paymentMode = remoteReady ? "Carta per mix/master a distanza e in studio · contanti in studio" : studioCashOnly ? "Contanti presso lo studio · carta online sospesa" : !process.env.STRIPE_SECRET_KEY ? "Da collegare" : stripeTestMode() ? "Ambiente di prova" : "Ambiente reale: collaudo da confermare";
  return <section className="admin-form-card">
    <span className="eyebrow">VERSO LA PRIMA VENDITA</span><h2>Cosa manca per aprire gli incassi</h2>
    <p>Il sito pubblico e i test riusciti non equivalgono all’apertura delle vendite reali. Completa questi passaggi prima del collaudo finale.</p>
    <div className="admin-cards">
      <article><div><span className="eyebrow">01 · CATALOGO</span><h3>{ready} offerte complete su {total}</h3><p>{ready > 0 ? "Le altre offerte rimangono non acquistabili finché mancano i materiali." : "Servono beat veri: copertina, anteprima ascoltabile, file inclusi e contratto definitivo. I beat di esempio non sono prodotti pronti."}</p><p>Questo controllo riguarda i beat; i servizi seguono il percorso richiesta, preventivo e pagamento.</p><Link className="text-link" href="/admin/beats">Prepara i beat</Link> · <Link className="text-link" href="/admin/licenses">Completa le licenze</Link></div></article>
      <article><div><span className="eyebrow">02 · VENDITORE E DOCUMENTI</span><h3>{sellerReady === true && documentsReady ? "Preparazione registrata" : "Da completare con il titolare"}</h3><p>Dati del venditore: {sellerReady === true ? "preparazione registrata" : "preparazione non confermata"}. Documenti: {documentsReady ? "versioni definitive registrate" : "non ancora definitivi"}.</p>{drafts.length > 0 && <p>Bozze presenti: {drafts.map(document => document.title).join("; ")}.</p>}<p>Servono le versioni approvate dei documenti, le condizioni delle licenze e le regole di cancellazione. Mix e master a listino includono 2 revisioni e prima versione entro 7 giorni lavorativi dall’avvio consentito, dopo pagamento e file completi.</p></div></article>
      <article><div><span className="eyebrow">03 · PAGAMENTI</span><h3>{paymentMode}</h3><p>{studioCashOnly ? "Conferma gli accordi da Prenotazioni o Mix & Master. Registra nelle Vendite soltanto i contanti effettivamente ricevuti. Il documento fiscale va gestito separatamente. Mix e master, a distanza o in studio, possono essere pagati con carta quando il collegamento nelle Impostazioni risulta attivo." : "Prima dell’apertura: verifica del titolare in Stripe, collegamento delle conferme e collaudo completo."}</p><Link className="text-link" href="/admin/settings">Controlla Stripe</Link> · <Link className="text-link" href="/admin/analytics">Apri il registro Vendite</Link></div></article>
      <article><div><span className="eyebrow">04 · CAPACITÀ E LANCIO</span><h3>Piani e prova finale da verificare</h3><p>Prima degli incassi verifica un piano hosting compatibile con l’uso commerciale e quote sufficienti per email, file e traffico. Ogni sessione può generare due promemoria oltre alle altre email.</p><p>Questo pannello non legge gli abbonamenti dei fornitori e non attiva servizi a pagamento. Dopo i materiali definitivi va ripetuto il percorso completo come cliente.</p></div></article>
    </div>
  </section>;
}
