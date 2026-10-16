"use client";
import { useState } from "react";
import { unitEconomics, type EconomicsInput } from "@/lib/unit-economics";
import { formatPrice } from "@/lib/format";

const fields = [
  ["price", "Incasso di una vendita €", "Prima dello sconto"],
  ["discountPercent", "Sconto %", "Quello che vuoi simulare"],
  ["feePercent", "Commissione pagamento %", "Inserisci la tariffa applicabile"],
  ["feeFixed", "Commissione fissa €", "Per ogni pagamento"],
  ["variableCosts", "Altri costi per vendita €", "Collaboratori, acquisizione cliente e altri costi diretti"],
  ["hours", "Ore di lavoro per vendita", "Includi preparazione, revisioni e assistenza"],
  ["hourlyValue", "Valore di un’ora di lavoro €", "Compenso che vuoi riconoscere al tuo tempo"],
  ["monthlyCosts", "Costi fissi mensili €", "Studio, software, sito e altri costi fissi"],
] as const;
const amounts = new Set(["price", "feeFixed", "variableCosts", "hourlyValue", "monthlyCosts"]);
export function MarginPlanner() {
  const [values, setValues] = useState<Record<string,string>>({});
  const complete = fields.every(([key]) => values[key]?.trim());
  const data = Object.fromEntries(fields.map(([key]) => [key, Number(values[key] || 0) * (amounts.has(key) ? 100 : 1)])) as EconomicsInput;
  for (const key of amounts) data[key as keyof EconomicsInput] = Math.round(data[key as keyof EconomicsInput]);
  const result = complete ? unitEconomics(data) : null;
  return <section className="admin-form-card margin-planner"><span className="eyebrow">PRIMA DI DECIDERE IL PREZZO</span><h2>Quanto rimane davvero da ogni vendita?</h2><p>Compila tutti i valori, anche zero dove non c’è un costo. È una simulazione privata: non cambia prezzi, promozioni o costi registrati e non viene salvata.</p>
    <div className="margin-fields">{fields.map(([key,label,help]) => <label key={key}>{label}<input type="number" min="0" max={key.endsWith("Percent") ? 100 : key === "hours" ? 10000 : 1000000} step={key === "hours" ? "0.25" : "0.01"} value={values[key] ?? ""} onChange={event => setValues(current => ({...current,[key]:event.target.value}))} /><small>{help}</small></label>)}</div>
    <div className="margin-results" aria-live="polite">{result ? <><article><span>Incasso dopo lo sconto</span><strong>{formatPrice(result.charged)}</strong></article><article><span>Commissioni stimate</span><strong>{formatPrice(result.fees)}</strong></article><article><span>Valore delle ore dedicate</span><strong>{formatPrice(result.work)}</strong></article><article><span>Margine per coprire i costi fissi</span><strong>{formatPrice(result.contribution)}</strong><small>{result.marginPercent === null ? "Nessun incasso" : `${result.marginPercent.toLocaleString("it-IT",{maximumFractionDigits:1})}% dell’incasso`}</small></article><article><span>Vendite mensili per coprire i costi fissi</span><strong>{result.breakEven ?? "Non raggiungibile"}</strong><small>{result.contribution <= 0 ? "Ogni vendita consuma il margine: rivedi prezzo, sconto o costi." : "Ipotesi: tutte le vendite hanno questi stessi costi e questo stesso prezzo."}</small></article></> : <p>{complete ? "Controlla i valori: usa numeri positivi e percentuali da 0 a 100." : "Compila i valori per vedere il margine e il punto di pareggio."}</p>}</div>
    <p className="fine-print">Questo non è l’utile fiscale né il saldo Stripe. Le commissioni qui sono stime inserite da te; le commissioni effettive restano nel registro. Tieni separati imposte e altri importi che non restano all’attività e verifica le tue ipotesi con il commercialista. Il valore delle ore misura il lavoro; non è automaticamente un’uscita di cassa.</p>
  </section>;
}
