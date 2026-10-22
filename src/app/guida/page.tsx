import { StudioPaymentNotice } from "@/components/services/studio-payment-notice";
import type { Metadata } from "next";
import Link from "next/link";
import { PurchaseHelp } from "@/components/commerce/purchase-help";
import { getLicenses } from "@/lib/repositories/beats";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Guida a beat, licenze e acquisti", description: "Come scegliere una licenza GENKS, acquistare un beat, ritrovare i file e richiedere studio, mix o master.", alternates: { canonical: "/guida" } };

export default async function Guide() {
  const licenses = await getLicenses();
  return <div className="portal-shell purchase-guide-page">
    <header className="service-page-heading"><div><span className="eyebrow">GENKS · GUIDA ALL’ACQUISTO</span><h1>Scegli il suono.<br />Sai già come continuare.</h1><p>Ascolta, confronta la licenza e scegli come portare avanti il tuo brano.</p></div></header>
    <StudioPaymentNotice />
    <section id="licenze" className="license-guide"><h2>Parti dai file di cui hai bisogno.</h2><p>Questa è una sintesi dei formati. Le condizioni della licenza del beat scelto definiscono i diritti di utilizzo.</p><div className="license-guide-grid">{licenses.map(license => <article key={license.id}><span className="eyebrow">{license.format}</span><h3>{license.name}</h3><strong>{`da ${formatPrice(license.priceCents)}`}</strong><p>{license.id === "mp3" ? "Il file MP3, per chi cerca questo formato." : license.id === "wav" ? "Anche il WAV non compresso, per lavorare sul brano." : license.isExclusive || license.id === "exclusive" ? "Un accordo dedicato: invia una richiesta a GENKS." : "Tracce separate, per intervenire sui singoli elementi nel mix."}</p><small>Il prezzo specifico del beat e le condizioni sono mostrati prima del pagamento.</small></article>)}</div></section>
    <PurchaseHelp />
    <div className="guide-actions"><Link className="button button-primary" href="/beats">Esplora i beat</Link><Link className="button button-secondary" href="/services">Richiedi un servizio</Link></div>
  </div>;
}
