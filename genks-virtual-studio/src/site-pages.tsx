import { useEffect, useState } from "react";

/**
 * The plain pages of the new site that are not part of the 3D studio: the order confirmation
 * (return from Stripe, cash orders) and the legal texts. Customers never leave www.prodbygenks.com.
 */

const euro = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

export const LEGAL_DOCS: Record<string, string> = {
  terms: "Condizioni dei servizi",
  privacy: "Privacy",
  cookies: "Cookie",
  refunds: "Rimborsi e recesso",
  licensing: "Licenze beat",
  booking: "Prenotazioni",
};

/** Which plain page a path shows, or null for the studio. */
export function sitePageFor(path: string): { kind: "order" } | { kind: "legal"; doc: string } | null {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === "/ordine" || clean === "/services/ordine") return { kind: "order" };
  if (clean === "/recesso") return { kind: "legal", doc: "refunds" };
  const legal = /^\/legal\/([a-z]+)$/.exec(clean);
  if (legal) return { kind: "legal", doc: legal[1] };
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-page">
      <header className="site-page-head">
        <a href="/" aria-label="GENKS, torna allo studio"><img src="/brand/genks-symbol.svg" alt="" width={36} height={36} /> <span>GENKS</span></a>
      </header>
      <main className="site-page-main">{children}</main>
      <footer className="site-page-foot">
        <nav aria-label="Documenti legali">{Object.entries(LEGAL_DOCS).map(([id, label]) => <a key={id} href={`/legal/${id}`}>{label}</a>)}</nav>
        <p>Assistenza: <a href="mailto:assistenza@prodbygenks.com">assistenza@prodbygenks.com</a></p>
      </footer>
    </div>
  );
}

type Status = { state: "received" | "paid" | "pending" | "review"; reference: string; amount?: number };

function OrderPage() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code") ?? "", session = params.get("session") ?? "";
  const [status, setStatus] = useState<Status>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!code && !session) return;
    const ctrl = new AbortController();
    const query = new URLSearchParams(code ? { code } : { session });
    fetch(`/api/cinematic/status?${query}`, { signal: ctrl.signal, cache: "no-store", headers: { Accept: "application/json" } })
      .then(async r => {
        const body = await r.json().catch(() => null);
        if (!r.ok || !body?.state) throw new Error(body?.error ?? "Verifica dell’ordine non disponibile. Riprova tra poco.");
        setStatus(body as Status);
        setError("");
        // Stripe confirms the payment to GENKS a few seconds after the return: check again.
        if (body.state === "pending" && attempt < 6) setTimeout(() => setAttempt(a => a + 1), 2500);
      })
      .catch(e => { if ((e as Error).name !== "AbortError") setError((e as Error).message); });
    return () => ctrl.abort();
  }, [code, session, attempt]);

  if (!code && !session) {
    return <Shell><h1>Nessun ordine da mostrare.</h1><p>Il riepilogo e le scadenze di ogni ordine arrivano via email.</p><a className="site-page-button" href="/">Torna allo studio</a></Shell>;
  }
  const title = !status ? "Verifico l’ordine…"
    : status.state === "received" ? "Ordine ricevuto."
    : status.state === "paid" ? "Pagamento ricevuto."
    : status.state === "review" ? "Pagamento ricevuto, verifica in corso."
    : "Stiamo verificando il pagamento.";
  return (
    <Shell>
      <p className="site-page-eyebrow">GENKS · IL TUO ORDINE</p>
      <h1 aria-live="polite">{title}</h1>
      {status?.reference && <p className="site-page-code">Codice ordine <strong>{status.reference}</strong></p>}
      {status?.state === "paid" && status.amount ? <p>Importo pagato: <strong>{euro(status.amount)}</strong></p> : null}
      {status?.state === "received" && <p>L’orario o il lavoro è riservato a tuo nome. Per la registrazione in studio versa l’acconto in contanti al tuo arrivo; il saldo si paga a fine lavoro. Conserva il codice ordine.</p>}
      {status?.state === "paid" && <p>Il pagamento è confermato. Ricevi via email il riepilogo, le condizioni accettate e i prossimi passi.</p>}
      {status?.state === "pending" && <p>La banca sta confermando il pagamento. Questa pagina si aggiorna da sola; riceverai comunque un’email appena il pagamento è confermato.</p>}
      {status?.state === "review" && <p>Il pagamento è arrivato ed è in verifica. GENKS ti scrive via email appena è confermato.</p>}
      {error && <p role="alert" className="site-page-error">{error}</p>}
      <p>Controlla l’email per il riepilogo, le scadenze dello studio e il calendario.</p>
      <a className="site-page-button" href="/">Torna allo studio</a>
    </Shell>
  );
}

function LegalPage({ doc }: { doc: string }) {
  const [text, setText] = useState<{ title: string; body: string }>();
  const [error, setError] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/cinematic/legal?${new URLSearchParams({ doc })}`, { signal: ctrl.signal, headers: { Accept: "application/json" } })
      .then(async r => {
        const body = await r.json().catch(() => null);
        if (!r.ok || !body?.body) throw new Error(r.status === 404 ? "Documento non trovato." : "Documento non disponibile in questo momento. Riprova tra poco.");
        setText(body);
        document.title = `${body.title} · GENKS`;
      })
      .catch(e => { if ((e as Error).name !== "AbortError") setError((e as Error).message); });
    return () => ctrl.abort();
  }, [doc]);
  return (
    <Shell>
      <p className="site-page-eyebrow">GENKS · DOCUMENTI</p>
      <h1>{text?.title ?? LEGAL_DOCS[doc] ?? "Documento"}</h1>
      {error && <p role="alert" className="site-page-error">{error}</p>}
      {!text && !error && <p aria-busy="true">Carico il documento…</p>}
      {text && <div className="site-page-legal">{text.body.split(/\n{2,}/).map((block, i) => <p key={i}>{block.split("\n").flatMap((line, j) => j ? [<br key={j} />, line] : [line])}</p>)}</div>}
    </Shell>
  );
}

export function SitePage({ page }: { page: NonNullable<ReturnType<typeof sitePageFor>> }) {
  return page.kind === "order" ? <OrderPage /> : <LegalPage doc={page.doc} />;
}
