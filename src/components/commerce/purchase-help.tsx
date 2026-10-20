import Link from "next/link";
import { studioCashOnly } from "@/lib/studio-payment-mode";
import { ArrowUpRight, Download, Mail, ShieldCheck } from "lucide-react";
import { purchaseQuestions } from "@/data/purchase-help";

export function PurchaseHelp({ compact = false }: { compact?: boolean }) {
  return <section className="purchase-help" aria-label="Risposte prima dell’acquisto">
    <div className="purchase-reassurance">
      <span><ShieldCheck size={19} aria-hidden="true" />{studioCashOnly ? "Pagamento in contanti in studio" : "Pagamento gestito da Stripe"}</span>
      <span><Download size={19} aria-hidden="true" />{studioCashOnly ? "File e consegna concordati" : "File nella tua raccolta"}</span>
      <span><Mail size={19} aria-hidden="true" />Assistenza GENKS via email</span>
    </div>
    <div className="purchase-help-heading"><div><span className="eyebrow">TUTTO CHIARO, PRIMA DI SCEGLIERE</span><h2>Il tuo suono. Senza dubbi.</h2></div>{compact && <Link className="text-link" href="/guida">Guida all’acquisto <ArrowUpRight size={17} /></Link>}</div>
    <div className="purchase-questions">{purchaseQuestions.slice(0, compact ? 3 : undefined).map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div>
    <p className="purchase-help-contact">Non trovi la risposta? <a href="mailto:assistenza@prodbygenks.com">Scrivi all’assistenza GENKS</a> oppure <Link href="/services/regole">leggi come gestire l’appuntamento</Link>.</p>
  </section>;
}
