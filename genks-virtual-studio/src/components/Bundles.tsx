import { Check } from "lucide-react";
import { bundleSaving, formatEuro, visibleBundles } from "../lib/catalog.ts";
import { useStudio } from "../store.tsx";
import s from "../styles/vs.module.css";
import { GenksSymbol } from "./brand.tsx";

export function Bundles() {
  const { content, open } = useStudio();
  const list = visibleBundles(content.bundles);
  return (
    <section id="bundle" className={s.bundles} aria-labelledby="bundle-title">
      <div className={s.bundleHalo} aria-hidden="true"><GenksSymbol size={420} /></div>
      <header className={s.sectionHead}>
        <p className={s.kicker}>Pacchetti e offerte</p>
        <h2 id="bundle-title">Servizi combinati, confrontabili a colpo d’occhio.</h2>
        <p>Il risparmio è calcolato sugli stessi servizi presi separatamente.</p>
      </header>
      {list.length === 0 ? <p className={s.empty}>Nessun pacchetto pubblicato al momento.</p> : (
        <ul className={s.bundleGrid}>
          {list.map((b, i) => {
            const saving = bundleSaving(b);
            return (
              <li key={b.id} className={s.bundleCard} style={{ ["--i" as string]: i }}>
                                <h3>{b.name}</h3>
                <p>{b.summary}</p>
                <ul className={s.checks}>{b.includes.map(x => <li key={x}><Check size={16} aria-hidden="true" />{x}</li>)}</ul>
                <p className={s.limits}><strong>Limiti:</strong> {b.limits.join(" · ")}</p>
                <div className={s.bundlePrice}>
                  {b.price != null ? <strong>{formatEuro(b.price)}</strong> : <strong>Su preventivo</strong>}
                  {saving != null && <span>Risparmi {formatEuro(saving)} rispetto ai servizi singoli ({formatEuro(b.listValue!)})</span>}
                </div>
                <button type="button" className={s.btnPrimary} onClick={() => open({ type: "bundle", id: b.id })}>Richiedi il pacchetto</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
