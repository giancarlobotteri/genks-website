import { ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";
import { enterStore } from "../lib/nav.ts";
import { simulatedCheckout } from "../adapters.ts";
import { cartLines, cartTotal, formatEuro } from "../lib/catalog.ts";
import { useStudio, type Panel } from "../store.tsx";
import s from "../styles/vs.module.css";
import type { DemoRequest } from "../types.ts";
import { PlayButton } from "./BeatStore.tsx";
import { DemoForm } from "./DemoForm.tsx";
import { BeatCover, DemoBadge, DemoNotice, Field, fieldProps, Sheet } from "./ui.tsx";

const contactRules = {
  name: { required: true, label: "Nome" },
  email: { required: true, email: true, label: "Email" },
};

function ContactFields({ errors, artist = true }: { errors: Record<string, string>; artist?: boolean }) {
  return (
    <div className={s.grid2}>
      <Field label="Nome *" name="name" error={errors.name}><input {...fieldProps("name", errors)} autoComplete="name" /></Field>
      {artist && <Field label="Nome artista" name="artist" error={errors.artist}><input {...fieldProps("artist", errors)} /></Field>}
      <Field label="Email *" name="email" error={errors.email}><input {...fieldProps("email", errors)} type="email" autoComplete="email" /></Field>
      <Field label="Telefono (facoltativo)" name="phone" error={errors.phone}><input {...fieldProps("phone", errors)} type="tel" autoComplete="tel" /></Field>
    </div>
  );
}

/* ---------------- Beat detail / licences ---------------- */
function BeatPanel({ id }: { id: string }) {
  const { content, addToCart, open, cart } = useStudio();
  const beat = content.beats.find(b => b.id === id);
  const avail = content.licenses.filter(l => beat?.licenses.includes(l.id));
  const inCart = cart.find(c => c.beatId === id)?.licenseId;
  const [lic, setLic] = useState(inCart ?? avail.find(l => l.price != null)?.id ?? avail[0]?.id);
  const [added, setAdded] = useState(false);
  if (!beat) return <p>Beat non disponibile.</p>;
  const chosen = avail.find(l => l.id === lic);
  return (
    <div className={s.beatDetail}>
      <div className={s.beatDetailHead}>
        <BeatCover beat={beat} className={s.detailCover} />
        <div>
          <p className={s.beatMeta}>{beat.genre} · {beat.bpm} BPM · {beat.key} · {beat.mood.join(", ")}</p>
          <p>{beat.description}</p>
          <div className={s.inlinePlay}><PlayButton beat={beat} /> <span>Anteprima originale (generata nel browser)</span></div>
        </div>
      </div>
      <fieldset className={s.licenses}>
        <legend>Scegli la licenza <DemoBadge>Licenze DEMO</DemoBadge></legend>
        {avail.map(l => (
          <label key={l.id} className={s.licenseCard} data-checked={lic === l.id || undefined}>
            <input type="radio" name="license" value={l.id} checked={lic === l.id} onChange={() => { setLic(l.id); setAdded(false); }} />
            <span className={s.optionTitle}>{l.name}<small>{l.format}</small></span>
            <span className={s.optionPrice}>{l.price == null ? "Su richiesta" : formatEuro(l.price)}</span>
            <span className={s.licCols}>
              <span><strong>Include</strong>{l.includes.map(i => <span key={i}>✓ {i}</span>)}</span>
              <span><strong>Limiti</strong>{l.limits.map(i => <span key={i}>– {i}</span>)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className={s.muted}>Testo di licenza dimostrativo: le condizioni reali saranno definite nel contratto prima della messa in vendita.</p>
      <div className={s.ctaRow}>
        {chosen?.price == null ? (
          <button type="button" className={s.btnPrimary} onClick={() => open({ type: "exclusive", beatId: beat.id })}>Richiedi esclusiva</button>
        ) : (
          <button type="button" className={s.btnPrimary} onClick={() => { addToCart({ beatId: beat.id, licenseId: chosen.id }); setAdded(true); }}>
            <ShoppingBag size={16} /> {inCart ? "Aggiorna licenza nel carrello" : "Aggiungi al carrello"} · {formatEuro(chosen.price)}
          </button>
        )}
        {added && <span role="status" className={s.okMsg}>Aggiunto al carrello demo. <button type="button" className={s.btnText} onClick={() => open({ type: "cart" })}>Apri carrello</button></span>}
      </div>
    </div>
  );
}

function ExclusivePanel({ beatId }: { beatId: string }) {
  const { content } = useStudio();
  const beat = content.beats.find(b => b.id === beatId);
  return (
    <div className={s.panelStack}>
      <DemoNotice>L’esclusiva non ha un prezzo fisso e non viene venduta automaticamente: è una richiesta separata.</DemoNotice>
      <DemoForm kind="exclusive" submitLabel="Invia richiesta esclusiva (demo)" rules={{ ...contactRules, offer: { min: 0, label: "Offerta indicativa" } }}
        extra={() => ({ beat: beat?.title ?? beatId })} summary={v => `Esclusiva “${v.beat}” · ${v.name}`}>
        {errors => <>
          <p>Beat: <strong>{beat?.title}</strong></p>
          <ContactFields errors={errors} />
          <Field label="Offerta indicativa in € (facoltativa)" name="offer" error={errors.offer}><input {...fieldProps("offer", errors)} type="number" min={0} inputMode="numeric" /></Field>
          <Field label="Progetto e utilizzo previsto" name="notes" error={errors.notes}><textarea {...fieldProps("notes", errors)} rows={3} /></Field>
        </>}
      </DemoForm>
    </div>
  );
}

/* ---------------- Cart & checkout ---------------- */
function CartPanel() {
  const { content, cart, removeFromCart, open, close } = useStudio();
  const lines = cartLines(cart, content.beats, content.licenses);
  if (!lines.length) return <div className={s.empty}><p>Il carrello demo è vuoto.</p><button type="button" className={s.btnPrimary} onClick={() => { close(); window.setTimeout(() => void enterStore(), 250); }}>Vai al Beat Store</button></div>;
  return (
    <div className={s.panelStack}>
      <ul className={s.cartList}>
        {lines.map(l => (
          <li key={l.beat.id}>
            <BeatCover beat={l.beat} className={s.cartCover} />
            <span><strong>{l.beat.title}</strong><small>{l.license.name} · {l.license.format}</small>
              <button type="button" className={s.btnText} onClick={() => open({ type: "beat", id: l.beat.id })}>Cambia licenza</button></span>
            <span className={s.price}>{formatEuro(l.price)}</span>
            <button type="button" className={s.iconBtn} aria-label={`Rimuovi ${l.beat.title}`} onClick={() => removeFromCart(l.beat.id)}><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
      <p className={s.total}>Totale <strong>{formatEuro(cartTotal(lines))}</strong> <DemoBadge /></p>
      <button type="button" className={s.btnPrimary} onClick={() => open({ type: "checkout" })}>Procedi al checkout simulato</button>
      <p className={s.muted}>Nessun pagamento è attivo in questo prototipo.</p>
    </div>
  );
}

function CheckoutPanel() {
  const { content, cart, clearCart } = useStudio();
  const lines = cartLines(cart, content.beats, content.licenses);
  const [order, setOrder] = useState<DemoRequest | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  if (order) {
    return (
      <div className={s.success} role="status">
        <h3>Ordine simulato <DemoBadge /></h3>
        <p>Riferimento <strong>{order.id}</strong>. <strong>Nessun addebito</strong> è stato effettuato e <strong>nessun file</strong> viene consegnato: questo è un riepilogo dimostrativo.</p>
        <p className={s.muted}>In produzione: pagamento tramite provider, webhook di conferma, email e download autorizzati.</p>
      </div>
    );
  }
  if (!lines.length) return <p>Il carrello demo è vuoto.</p>;
  return (
    <form className={s.form} noValidate onSubmit={e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const v = { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), ack: fd.get("ack") ? "yes" : "" };
      const errors: Record<string, string> = {};
      if (!v.name.trim()) errors.name = "Nome: campo obbligatorio.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errors.email = "Email: inserisci un indirizzo valido.";
      if (!v.ack) errors.ack = "Conferma di aver capito che si tratta di una simulazione.";
      setErr(errors);
      if (Object.keys(errors).length) return;
      const r = simulatedCheckout.simulate(lines.map(l => `${l.beat.title} (${l.license.name})`).join(", ") + ` · ${formatEuro(cartTotal(lines))}`, { ...v, total: String(cartTotal(lines)) });
      setOrder(r.order);
      clearCart();
    }}>
      <div className={s.demoBanner} role="note"><DemoBadge>CHECKOUT DEMO</DemoBadge> Simulazione: nessun dato di pagamento richiesto, nessun addebito.</div>
      <ul className={s.summary}>
        {lines.map(l => <li key={l.beat.id}><span>{l.beat.title} · {l.license.name}</span><span>{formatEuro(l.price)}</span></li>)}
        <li className={s.summaryTotal}><span>Totale (demo)</span><span>{formatEuro(cartTotal(lines))}</span></li>
      </ul>
      <div className={s.grid2}>
        <Field label="Nome *" name="name" error={err.name}><input {...fieldProps("name", err)} autoComplete="name" /></Field>
        <Field label="Email *" name="email" error={err.email}><input {...fieldProps("email", err)} type="email" autoComplete="email" /></Field>
      </div>
      <label className={s.check}><input type="checkbox" name="ack" aria-invalid={err.ack ? true : undefined} /> Ho capito che è un ordine simulato senza pagamento né download.</label>
      {err.ack && <p className={s.fieldError} role="alert">{err.ack}</p>}
      <button type="submit" className={s.btnPrimary}>Simula ordine</button>
    </form>
  );
}

function BundlePanel({ id }: { id: string }) {
  const { content } = useStudio();
  const b = content.bundles.find(x => x.id === id);
  if (!b) return <p>Offerta non disponibile.</p>;
  return (
    <div className={s.panelStack}>
      {b.status === "example" && <DemoNotice>Offerta di esempio, non ancora pubblicata.</DemoNotice>}
      <p>{b.summary}</p>
      <DemoForm kind="bundle" submitLabel="Richiedi questo pacchetto (demo)" rules={contactRules}
        extra={() => ({ bundle: b.name })} summary={v => `Pacchetto “${v.bundle}” · ${v.name}`}>
        {errors => <>
          <ContactFields errors={errors} />
          <Field label="Preferenze e richieste" name="notes" error={errors.notes}><textarea {...fieldProps("notes", errors)} rows={3} /></Field>
        </>}
      </DemoForm>
    </div>
  );
}

/* ---------------- Host ---------------- */
export function PanelHost() {
  const { panel, lastPanel, close, content } = useStudio();
  // Audio keeps playing while panels are open: panels never interrupt the player.
  const p = panel ?? lastPanel;
  const is = (t: Panel["type"]) => panel?.type === t;
  const beatTitle = p?.type === "beat" ? content.beats.find(b => b.id === p.id)?.title ?? "Beat" : "";
  const bundleTitle = p?.type === "bundle" ? content.bundles.find(b => b.id === p.id)?.name ?? "Pacchetto" : "";
  return (
    <>
      <Sheet open={is("beat")} onClose={close} kicker="Dettaglio beat" title={beatTitle} wide>
        {p?.type === "beat" && <BeatPanel key={p.id} id={p.id} />}
      </Sheet>
      <Sheet open={is("exclusive")} onClose={close} kicker="Licenza esclusiva" title="Richiesta di esclusiva">
        {p?.type === "exclusive" && <ExclusivePanel beatId={p.beatId} />}
      </Sheet>
      <Sheet open={is("cart")} onClose={close} kicker="Carrello demo" title="Il tuo carrello" variant="side">
        {p?.type === "cart" && <CartPanel />}
      </Sheet>
      <Sheet open={is("checkout")} onClose={close} kicker="Checkout DEMO" title="Riepilogo ordine simulato">
        {p?.type === "checkout" && <CheckoutPanel />}
      </Sheet>
      <Sheet open={is("bundle")} onClose={close} kicker="Pacchetti" title={bundleTitle}>
        {p?.type === "bundle" && <BundlePanel id={p.id} />}
      </Sheet>
    </>
  );
}
