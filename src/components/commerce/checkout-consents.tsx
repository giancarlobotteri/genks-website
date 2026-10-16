import Link from "next/link";

export function CheckoutConsents() {
  return <fieldset className="checkout-consents">
    <legend>Condizioni dell’acquisto</legend>
    <label><input type="checkbox" name="acceptedTerms" required /><span>Ho letto e accetto le <Link href="/legal/terms" target="_blank">condizioni di vendita</Link> e la licenza selezionata. Ho letto l’<Link href="/legal/privacy" target="_blank">informativa privacy</Link>.</span></label>
    <label><input type="checkbox" name="immediateDelivery" required /><span>Chiedo la fornitura immediata dei contenuti digitali dopo il pagamento e riconosco che, con l’inizio della fornitura, perderò il diritto di recesso previsto per tali contenuti.</span></label>
  </fieldset>;
}
