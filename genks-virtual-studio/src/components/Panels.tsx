import { Check, Minus, ShoppingBag, Trash2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { localAvailability, simulatedCheckout } from "../adapters.ts";
import { cartLines, cartTotal, formatEuro } from "../lib/catalog.ts";
import { useStudio, type Panel } from "../store.tsx";
import s from "../styles/vs.module.css";
import type { DemoRequest, MixService } from "../types.ts";
import { PlayButton } from "./BeatStore.tsx";
import { DemoForm } from "./DemoForm.tsx";
import { BeatCover, DemoBadge, DemoNotice, Field, fieldProps, Sheet } from "./ui.tsx";
import { UploadZone } from "./UploadZone.tsx";

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

const price = (v: number | null, prefix = "") => (v == null ? "Su richiesta" : `${prefix}${formatEuro(v)}`);

/* ---------------- Recording ---------------- */
function RecordingPanel() {
  const { content } = useStudio();
  const days = useMemo(() => localAvailability.list(new Date()), []);
  const [pkg, setPkg] = useState(content.recording[1]?.id ?? content.recording[0]?.id);
  const [day, setDay] = useState<string>("");
  const [slot, setSlot] = useState<string>("");
  const selected = content.recording.find(p => p.id === pkg);
  const dayObj = days.find(d => d.iso === day);
  return (
    <div className={s.panelStack}>
      <DemoNotice>Pacchetti, prezzi e disponibilità sono dimostrativi. La richiesta non blocca uno slot reale.</DemoNotice>
      <fieldset className={s.optionGrid}>
        <legend>1 · Scegli il pacchetto</legend>
        {content.recording.map(p => (
          <label key={p.id} className={s.optionCard} data-checked={pkg === p.id || undefined}>
            <input type="radio" name="pkg-choice" value={p.id} checked={pkg === p.id} onChange={() => setPkg(p.id)} />
            <span className={s.optionTitle}>{p.name}</span>
            <span className={s.optionPrice}>{price(p.price)} <DemoBadge /></span>
            <span className={s.muted}>{p.description}</span>
            <ul>{p.includes.map(i => <li key={i}><Check size={14} aria-hidden="true" />{i}</li>)}</ul>
          </label>
        ))}
      </fieldset>
      <fieldset className={s.calendar}>
        <legend>2 · Data e fascia oraria <span className={s.muted}>(disponibilità dimostrativa)</span></legend>
        <div className={s.days} role="radiogroup" aria-label="Giorno">
          {days.map(d => {
            const free = d.slots.some(x => x.free);
            return (
              <button key={d.iso} type="button" role="radio" aria-checked={day === d.iso} disabled={!free} className={s.day} onClick={() => { setDay(d.iso); setSlot(""); }}>
                <span>{d.weekday}</span><strong>{d.label}</strong><small>{free ? "disponibile" : "chiuso"}</small>
              </button>
            );
          })}
        </div>
        {dayObj && (
          <div className={s.slots} role="radiogroup" aria-label="Orario di inizio">
            {dayObj.slots.map(x => (
              <button key={x.start} type="button" role="radio" aria-checked={slot === x.start} disabled={!x.free} className={s.slot} onClick={() => setSlot(x.start)}>
                {x.start}{!x.free && <small> occupato</small>}
              </button>
            ))}
          </div>
        )}
      </fieldset>
      <DemoForm
        kind="booking"
        submitLabel="Prenota (richiesta demo)"
        rules={{ ...contactRules, date: { required: true, label: "Data desiderata" }, time: { required: true, label: "Fascia oraria" } }}
        extra={() => ({ package: selected?.name ?? "", date: day, time: slot, duration: `${selected?.hours ?? ""} h` })}
        summary={v => `${v.package} · ${v.date} ${v.time} · ${v.name}`}
      >
        {errors => <>
          <p className={s.formLegend}>3 · I tuoi dati</p>
          {(errors.date || errors.time) && <p className={s.fieldError} role="alert">Seleziona giorno e orario nel calendario qui sopra.</p>}
          <p className={s.muted}>Selezione: <strong>{selected?.name}</strong> · {day || "giorno da scegliere"} · {slot || "orario da scegliere"} · durata {selected?.hours} h</p>
          <ContactFields errors={errors} />
          <Field label="Riferimento (link a brano o demo)" name="reference" error={errors.reference}><input {...fieldProps("reference", errors)} type="url" placeholder="https://" /></Field>
          <Field label="Note" name="notes" error={errors.notes}><textarea {...fieldProps("notes", errors)} rows={3} /></Field>
        </>}
      </DemoForm>
    </div>
  );
}

/* ---------------- Mix & Master ---------------- */
const TAB_IDS = ["mix", "master", "mixmaster"] as const;

function MixPanel({ initialTab, initialView }: { initialTab?: MixService["id"]; initialView?: "services" | "remote" }) {
  const { content } = useStudio();
  const [tab, setTab] = useState<MixService["id"]>(initialTab ?? "mixmaster");
  const [view, setView] = useState(initialView ?? "services");
  const [files, setFiles] = useState<string[]>([]);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const svc = content.mix.find(m => m.id === tab) ?? content.mix[0];
  const onFiles = useCallback((n: string[]) => setFiles(n), []);

  const onKey = (e: KeyboardEvent) => {
    const i = TAB_IDS.indexOf(tab);
    const n = e.key === "ArrowRight" ? (i + 1) % 3 : e.key === "ArrowLeft" ? (i + 2) % 3 : e.key === "Home" ? 0 : e.key === "End" ? 2 : -1;
    if (n < 0) return;
    e.preventDefault();
    setTab(TAB_IDS[n]);
    tabRefs.current[TAB_IDS[n]]?.focus();
  };

  if (view === "remote") {
    return (
      <div className={s.panelStack}>
        <button type="button" className={s.btnText} onClick={() => setView("services")}>← Torna ai servizi</button>
        <DemoNotice>Invio progetto dimostrativo: nessun file viene caricato o conservato senza uno storage sicuro.</DemoNotice>
        <DemoForm
          kind="remote-project"
          submitLabel="Invia richiesta progetto (demo)"
          rules={{ ...contactRules, title: { required: true, label: "Titolo brano" }, service: { required: true, label: "Servizio" }, stems: { required: true, min: 1, max: 200, label: "Numero tracce/stems" }, referenceUrl: { url: true, label: "Link reference" } }}
          extra={() => ({ files: files.join(", ") })}
          summary={v => `${v.service} · “${v.title}” · ${v.stems} tracce · ${v.name}`}
        >
          {errors => <>
            <div className={s.grid2}>
              <Field label="Titolo brano *" name="title" error={errors.title}><input {...fieldProps("title", errors)} /></Field>
              <Field label="Servizio *" name="service" error={errors.service}>
                <select {...fieldProps("service", errors)} defaultValue={svc.name}>{content.mix.map(m => <option key={m.id}>{m.name}</option>)}</select>
              </Field>
              <Field label="Numero tracce / stems *" name="stems" error={errors.stems}><input {...fieldProps("stems", errors)} type="number" min={1} inputMode="numeric" /></Field>
              <Field label="Deadline" name="deadline" error={errors.deadline}><input {...fieldProps("deadline", errors)} type="date" /></Field>
            </div>
            <Field label="Link a una reference" name="referenceUrl" error={errors.referenceUrl}><input {...fieldProps("referenceUrl", errors)} type="url" placeholder="https://" /></Field>
            <Field label="Note per il mix" name="notes" error={errors.notes}><textarea {...fieldProps("notes", errors)} rows={3} /></Field>
            <UploadZone onChange={onFiles} />
            <ContactFields errors={errors} />
          </>}
        </DemoForm>
      </div>
    );
  }

  return (
    <div className={s.panelStack}>
      <div role="tablist" aria-label="Servizi" className={s.tabs} onKeyDown={onKey} style={{ ["--tab" as string]: TAB_IDS.indexOf(tab) }}>
        <span className={s.tabInk} aria-hidden="true" />
        {content.mix.map(m => (
          <button key={m.id} ref={el => { tabRefs.current[m.id] = el; }} role="tab" type="button" id={`tab-${m.id}`} aria-selected={tab === m.id} aria-controls="mix-tabpanel" tabIndex={tab === m.id ? 0 : -1} onClick={() => setTab(m.id)}>{m.name}</button>
        ))}
      </div>
      <div id="mix-tabpanel" role="tabpanel" aria-labelledby={`tab-${svc.id}`} className={s.tabPanel} key={svc.id}>
        <div className={s.tabLead}>
          <div>
            <h3>{svc.name}</h3>
            <p>{svc.summary}</p>
          </div>
          <p className={s.bigPrice}>{price(svc.price, "da ")}<small>{svc.priceNote}</small><DemoBadge /></p>
        </div>
        <ul className={s.checks}>{svc.includes.map(i => <li key={i}><Check size={16} aria-hidden="true" />{i}</li>)}</ul>
        <dl className={s.facts}>
          <div><dt>Tempi</dt><dd>{svc.turnaround}</dd></div>
          <div><dt>Revisioni</dt><dd>{svc.revisions}</dd></div>
          <div><dt>Cosa serve</dt><dd>{svc.needs}</dd></div>
        </dl>
      </div>
      <div className={s.tableWrap}>
        <table className={s.compare}>
          <caption>Confronto rapido <DemoBadge /></caption>
          <thead><tr><th scope="col">Caratteristica</th>{content.mix.map(m => <th key={m.id} scope="col">{m.name}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">Prezzo</th>{content.mix.map(m => <td key={m.id}>{price(m.price, "da ")}</td>)}</tr>
            <tr><th scope="row">Bilanciamento tracce</th>{content.mix.map(m => <td key={m.id}>{m.id === "master" ? <Minus size={16} aria-label="No" /> : <Check size={16} aria-label="Sì" />}</td>)}</tr>
            <tr><th scope="row">Loudness per streaming</th>{content.mix.map(m => <td key={m.id}>{m.id === "mix" ? <Minus size={16} aria-label="No" /> : <Check size={16} aria-label="Sì" />}</td>)}</tr>
            <tr><th scope="row">Materiale richiesto</th>{content.mix.map(m => <td key={m.id}>{m.needs}</td>)}</tr>
            <tr><th scope="row">Tempi</th>{content.mix.map(m => <td key={m.id}>{m.turnaround}</td>)}</tr>
            <tr><th scope="row">Revisioni</th>{content.mix.map(m => <td key={m.id}>{m.revisions}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <div className={s.ctaRow}>
        <button type="button" className={s.btnPrimary} onClick={() => setView("remote")}>Invia progetto da remoto</button>
        <p className={s.muted}>Il pagamento non è attivo nel prototipo: dopo la richiesta ricevi (in produzione) un preventivo confermato.</p>
      </div>
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
  if (!lines.length) return <div className={s.empty}><p>Il carrello demo è vuoto.</p><button type="button" className={s.btnPrimary} onClick={() => { close(); window.setTimeout(() => document.getElementById("beat-store")?.scrollIntoView(), 250); }}>Vai al Beat Store</button></div>;
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
      <Sheet open={is("recording")} onClose={close} kicker="Registrazione voce" title="Prenota una sessione" wide>
        {p?.type === "recording" && <RecordingPanel />}
      </Sheet>
      <Sheet open={is("mix")} onClose={close} kicker="Banco mixer" title="Mix, Master, Mix & Master" wide>
        {p?.type === "mix" && <MixPanel initialTab={p.tab} initialView={p.view} />}
      </Sheet>
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
