import { ArrowLeft, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { localContent, localRequests } from "../adapters.ts";
import { useStudio } from "../store.tsx";
import s from "../styles/vs.module.css";
import type { Beat, BeatStyle, Bundle, DemoRequest, PublishState, StudioContent } from "../types.ts";
import { GenksSymbol } from "./brand.tsx";
import { DemoBadge } from "./ui.tsx";

const toEuro = (c: number | null) => (c == null ? "" : String(c / 100));
const fromEuro = (v: string) => (v.trim() === "" ? null : Math.round(Number(v.replace(",", ".")) * 100));
const lines = (a: string[]) => a.join("\n");
const unlines = (v: string) => v.split("\n").map(x => x.trim()).filter(Boolean);

function T({ label, value, onChange, area, type = "text" }: { label: string; value: string | number; onChange: (v: string) => void; area?: boolean; type?: string }) {
  return (
    <label className={s.adminField}>
      <span>{label}</span>
      {area ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} /> : <input type={type} value={value} onChange={e => onChange(e.target.value)} />}
    </label>
  );
}

function Status({ value, onChange }: { value: PublishState; onChange: (v: PublishState) => void }) {
  return (
    <label className={s.adminField}><span>Stato</span>
      <select value={value} onChange={e => onChange(e.target.value as PublishState)}>
        <option value="published">Pubblicato</option><option value="example">Esempio (non pubblicato)</option><option value="hidden">Nascosto</option>
      </select>
    </label>
  );
}

function Card({ title, onDelete, children }: { title: string; onDelete?: () => void; children: ReactNode }) {
  return (
    <details className={s.adminCard}>
      <summary><span>{title}</span>{onDelete && <button type="button" className={s.iconBtn} aria-label={`Elimina ${title}`} onClick={e => { e.preventDefault(); if (confirm(`Eliminare “${title}” dai dati demo?`)) onDelete(); }}><Trash2 size={16} /></button>}</summary>
      <div className={s.adminGrid}>{children}</div>
    </details>
  );
}

const TABS = ["Beat", "Licenze", "Servizi", "Pacchetti", "Richieste demo"] as const;

/** Demo CMS: edits mock content in this browser only. No authentication — NOT for production. */
export function Admin({ backHref }: { backHref: string }) {
  const { content, setContent } = useStudio();
  const [draft, setDraft] = useState<StudioContent>(content);
  const [base, setBase] = useState(content);
  // Re-sync the editable draft when the saved content changes (e.g. another tab or a reset).
  if (base !== content) { setBase(content); setDraft(content); }
  const [tab, setTab] = useState<(typeof TABS)[number]>("Beat");
  const [saved, setSaved] = useState("");
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  useEffect(() => {
    const load = () => setRequests(localRequests.list());
    load();
    window.addEventListener("genks:vs:requests", load);
    return () => window.removeEventListener("genks:vs:requests", load);
  }, []);

  const up = (fn: (d: StudioContent) => void) => setDraft(d => { const n: StudioContent = JSON.parse(JSON.stringify(d)); fn(n); return n; });
  const dirty = JSON.stringify(draft) !== JSON.stringify(content);

  return (
    <div className={s.admin}>
      <header className={s.adminHead}>
        <a href={backHref} className={s.btnText}><ArrowLeft size={16} /> Torna allo studio</a>
        <h1><GenksSymbol size={30} /> Gestione contenuti <DemoBadge>DEMO LOCALE</DemoBadge></h1>
        <p className={s.demoBanner} role="note">Le modifiche sono salvate solo in questo browser (localStorage). Non c’è autenticazione: in produzione servono login amministratore, database e permessi lato server.</p>
        <div className={s.adminActions}>
          <button type="button" className={s.btnPrimary} disabled={!dirty} onClick={() => { setContent(draft); setSaved("Modifiche salvate nel browser."); }}><Save size={16} /> Salva modifiche</button>
          <button type="button" className={s.btnGhost} onClick={() => { if (confirm("Ripristinare tutti i dati demo originali?")) { const c = localContent.reset(); setContent(c); setDraft(c); setSaved("Dati demo ripristinati."); } }}><RotateCcw size={16} /> Ripristina dati demo</button>
          <span role="status" className={s.okMsg}>{dirty ? "Modifiche non salvate" : saved}</span>
        </div>
      </header>
      <div role="tablist" className={s.adminTabs} aria-label="Sezioni gestione">
        {TABS.map(t => <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      <div role="tabpanel" className={s.adminPanel}>
        {tab === "Beat" && <>
          <button type="button" className={s.btnSmall} onClick={() => up(d => { const n = d.beats.length + 1; d.beats.unshift({ id: `b${Date.now()}`, title: `Nuovo beat ${n}`, genre: "Trap", mood: ["Scuro"], bpm: 140, key: "A min", description: "Descrizione demo.", licenses: ["mp3", "wav"], style: "trap", seed: Math.floor(Math.random() * 999), hue: 10, status: "hidden", createdAt: new Date().toISOString().slice(0, 10) }); })}><Plus size={14} /> Aggiungi beat</button>
          {draft.beats.map((b, i) => {
            const set = (patch: Partial<Beat>) => up(d => { Object.assign(d.beats[i], patch); });
            return (
              <Card key={b.id} title={`${b.title} · ${b.status === "published" ? "pubblicato" : b.status === "example" ? "esempio" : "nascosto"}`} onDelete={() => up(d => { d.beats.splice(i, 1); })}>
                <T label="Titolo" value={b.title} onChange={v => set({ title: v })} />
                <T label="Genere" value={b.genre} onChange={v => set({ genre: v })} />
                <T label="Mood (separati da virgola)" value={b.mood.join(", ")} onChange={v => set({ mood: v.split(",").map(x => x.trim()).filter(Boolean) })} />
                <T label="BPM" type="number" value={b.bpm} onChange={v => set({ bpm: Number(v) || 0 })} />
                <T label="Tonalità (es. F# min)" value={b.key} onChange={v => set({ key: v })} />
                <label className={s.adminField}><span>Stile anteprima</span>
                  <select value={b.style} onChange={e => set({ style: e.target.value as BeatStyle })}>{["trap", "drill", "rnb", "boombap", "afro", "lofi"].map(x => <option key={x}>{x}</option>)}</select>
                </label>
                <Status value={b.status} onChange={v => set({ status: v })} />
                <T label="Descrizione" area value={b.description} onChange={v => set({ description: v })} />
                <fieldset className={s.adminField}><legend>Licenze disponibili</legend>
                  {draft.licenses.map(l => <label key={l.id} className={s.check}><input type="checkbox" checked={b.licenses.includes(l.id)} onChange={e => set({ licenses: e.target.checked ? [...b.licenses, l.id] : b.licenses.filter(x => x !== l.id) })} /> {l.name}</label>)}
                </fieldset>
              </Card>
            );
          })}
        </>}

        {tab === "Licenze" && draft.licenses.map((l, i) => (
          <Card key={l.id} title={l.name}>
            <T label="Nome" value={l.name} onChange={v => up(d => { d.licenses[i].name = v; })} />
            <T label="Prezzo € (vuoto = su richiesta)" value={toEuro(l.price)} onChange={v => up(d => { d.licenses[i].price = fromEuro(v); })} />
            <T label="Formato" value={l.format} onChange={v => up(d => { d.licenses[i].format = v; })} />
            <T label="Include (una per riga)" area value={lines(l.includes)} onChange={v => up(d => { d.licenses[i].includes = unlines(v); })} />
            <T label="Limiti (uno per riga)" area value={lines(l.limits)} onChange={v => up(d => { d.licenses[i].limits = unlines(v); })} />
          </Card>
        ))}

        {tab === "Servizi" && <>
          <h2>Registrazione</h2>
          {draft.recording.map((r, i) => (
            <Card key={r.id} title={r.name}>
              <T label="Nome" value={r.name} onChange={v => up(d => { d.recording[i].name = v; })} />
              <T label="Ore" type="number" value={r.hours} onChange={v => up(d => { d.recording[i].hours = Number(v) || 0; })} />
              <T label="Prezzo € (vuoto = su richiesta)" value={toEuro(r.price)} onChange={v => up(d => { d.recording[i].price = fromEuro(v); })} />
              <T label="Descrizione" value={r.description} onChange={v => up(d => { d.recording[i].description = v; })} />
              <T label="Include (una per riga)" area value={lines(r.includes)} onChange={v => up(d => { d.recording[i].includes = unlines(v); })} />
            </Card>
          ))}
          <h2>Mix &amp; Master</h2>
          {draft.mix.map((m, i) => (
            <Card key={m.id} title={m.name}>
              <T label="Descrizione breve" value={m.summary} onChange={v => up(d => { d.mix[i].summary = v; })} />
              <T label="Prezzo da € (vuoto = su richiesta)" value={toEuro(m.price)} onChange={v => up(d => { d.mix[i].price = fromEuro(v); })} />
              <T label="Nota prezzo" value={m.priceNote} onChange={v => up(d => { d.mix[i].priceNote = v; })} />
              <T label="Tempi orientativi" value={m.turnaround} onChange={v => up(d => { d.mix[i].turnaround = v; })} />
              <T label="Revisioni" value={m.revisions} onChange={v => up(d => { d.mix[i].revisions = v; })} />
              <T label="Include (una per riga)" area value={lines(m.includes)} onChange={v => up(d => { d.mix[i].includes = unlines(v); })} />
            </Card>
          ))}
          <h2>Beat su misura</h2>
          <Card title="Impostazioni beat su misura">
            <T label="Tempi orientativi" value={draft.customBeat.turnaround} onChange={v => up(d => { d.customBeat.turnaround = v; })} />
            <T label="Revisioni" value={draft.customBeat.revisions} onChange={v => up(d => { d.customBeat.revisions = v; })} />
            <T label="Prezzo da € (vuoto = su preventivo)" value={toEuro(draft.customBeat.priceFrom)} onChange={v => up(d => { d.customBeat.priceFrom = fromEuro(v); })} />
          </Card>
        </>}

        {tab === "Pacchetti" && <>
          <button type="button" className={s.btnSmall} onClick={() => up(d => { d.bundles.push({ id: `bd${Date.now()}`, name: "Nuovo pacchetto", summary: "", includes: [], limits: [], price: null, listValue: null, status: "example" } as Bundle); })}><Plus size={14} /> Aggiungi pacchetto</button>
          {draft.bundles.map((b, i) => (
            <Card key={b.id} title={`${b.name} · ${b.status === "published" ? "pubblicato" : b.status === "example" ? "esempio" : "nascosto"}`} onDelete={() => up(d => { d.bundles.splice(i, 1); })}>
              <T label="Nome" value={b.name} onChange={v => up(d => { d.bundles[i].name = v; })} />
              <Status value={b.status} onChange={v => up(d => { d.bundles[i].status = v; })} />
              <T label="Prezzo pacchetto € (vuoto = su preventivo)" value={toEuro(b.price)} onChange={v => up(d => { d.bundles[i].price = fromEuro(v); })} />
              <T label="Valore servizi singoli € (per mostrare il risparmio)" value={toEuro(b.listValue)} onChange={v => up(d => { d.bundles[i].listValue = fromEuro(v); })} />
              <T label="Descrizione" area value={b.summary} onChange={v => up(d => { d.bundles[i].summary = v; })} />
              <T label="Servizi inclusi (uno per riga)" area value={lines(b.includes)} onChange={v => up(d => { d.bundles[i].includes = unlines(v); })} />
              <T label="Limiti (uno per riga)" area value={lines(b.limits)} onChange={v => up(d => { d.bundles[i].limits = unlines(v); })} />
            </Card>
          ))}
        </>}

        {tab === "Richieste demo" && <>
          <p className={s.muted}>Richieste e ordini simulati creati in questo browser. Nessuno è stato inviato o pagato.</p>
          <button type="button" className={s.btnSmall} disabled={!requests.length} onClick={() => { if (confirm("Cancellare tutte le richieste demo?")) localRequests.clear(); }}><Trash2 size={14} /> Svuota elenco</button>
          {requests.length === 0 ? <p className={s.empty}>Nessuna richiesta demo.</p> : (
            <div className={s.tableWrap}><table className={s.compare}>
              <thead><tr><th scope="col">Codice</th><th scope="col">Tipo</th><th scope="col">Data</th><th scope="col">Riepilogo</th></tr></thead>
              <tbody>{requests.map(r => <tr key={r.id}><td>{r.id}</td><td>{r.kind}</td><td>{new Date(r.createdAt).toLocaleString("it-IT")}</td><td>{r.summary}</td></tr>)}</tbody>
            </table></div>
          )}
        </>}
      </div>
    </div>
  );
}
