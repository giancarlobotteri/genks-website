import { useState } from "react";

/** Shown on the studio after the customer leaves the Stripe page without paying (?pagamento=annullato). */
export function PaymentNotice() {
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get("pagamento") === "annullato");
  if (!open) return null;
  const close = () => {
    setOpen(false);
    history.replaceState(null, "", location.pathname + location.hash);
  };
  return (
    <div className="payment-notice" role="status">
      <p><strong>Pagamento annullato.</strong> Nessun addebito effettuato. L’orario scelto torna libero da solo entro mezz’ora: puoi ripetere la prenotazione quando vuoi.</p>
      <button type="button" onClick={close}>Chiudi</button>
    </div>
  );
}
