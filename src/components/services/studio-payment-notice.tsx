import { studioCashOnly, studioPaymentMessage } from "@/lib/studio-payment-mode";
import styles from "./studio-payment-notice.module.css";
export function StudioPaymentNotice() {
  if (!studioCashOnly) return null;
  return <aside className={styles.notice} aria-label="Pagamento in studio"><strong>Beat, registrazioni, mix e master · su prenotazione</strong><p>{studioPaymentMessage}</p><p>Invia una richiesta senza pagare: GENKS ti contatta per il preventivo e la conferma.</p></aside>;
}
