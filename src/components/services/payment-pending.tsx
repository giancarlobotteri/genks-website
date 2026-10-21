"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
export function PaymentPending() {
  const router = useRouter();
  const attempts = useRef(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (attempts.current++ < 5) router.refresh();
      else window.clearInterval(timer);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [router]);
  return <div className="portal-shell narrow-shell"><h1>Verifica del pagamento in corso.</h1><p>La conferma apparirà dopo la verifica del pagamento. Se hai completato il pagamento, non ripeterlo: controlla l’email o contatta GENKS.</p><Link className="button button-secondary" href="/">Torna alla home</Link></div>;
}
