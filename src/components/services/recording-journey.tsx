"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cashHoldLabel } from '@/lib/cash-hold';
import { fromRomeWallTime } from '@/lib/rome-time';
import type { PublicDiscount } from '@/lib/public-discounts';
import { recordingStartAllowed } from '@/lib/recording-selection';
import { storeService } from '@/lib/service-cart-storage';
import { quoteOrder, type OrderSelection } from '@/lib/service-order-v8';
import { serviceAmount } from '@/lib/service-rates';
import { LiveOrderSummary } from './live-order-summary';
import { StudioScheduler } from './studio-scheduler';
import styles from './recording-journey.module.css';

type Props = { discounts: PublicDiscount[]; initialDate: string; initialTime: string; hours: number };

export function RecordingJourney({ discounts, initialDate, initialTime, hours }: Props) {
  const router = useRouter();
  const [selection, setSelection] = useState<OrderSelection>(() => ({
    kind: 'recording', date: initialDate, time: initialTime, hours, songs: [],
    extraHours: 0, payment: 'card', notes: '', rights: 'own',
  }));
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  function update(patch: Partial<OrderSelection>) {
    setSelection(value => ({ ...value, ...patch }));
    setMessage('');
  }

  let quote;
  try { quote = quoteOrder([selection], true, new Date(clock), discounts).parts[0]; } catch {}
  const ready = Boolean(quote && available);
  const midpoint = ready && selection.payment === 'cash'
    ? cashHoldLabel(clock, fromRomeWallTime(selection.date, selection.time).getTime()) : '';

  async function continueBooking(direct: boolean) {
    if (!ready || !recordingStartAllowed(selection.date, selection.time, selection.payment, Date.now())) {
      setMessage('Scegli un orario disponibile per la durata indicata.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      quoteOrder([selection], true, new Date(), discounts, { requireFiles: true });
      await storeService(selection, direct);
      if (direct) router.push('/services/checkout?direct=1');
      else setMessage('Sessione aggiunta al carrello.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Riprova tra poco.');
    } finally {
      setBusy(false);
    }
  }

  return <div className={`service-v8-layout ${styles.layout}`}>
    {ready && <LiveOrderSummary total={quote?.total} dueNow={quote?.dueNow} balance={quote?.balance} lines={quote?.lines}/>}
    <section className={`premium-form ${styles.form}`}>
      <header className="service-form-heading">
        <Link className={styles.back} href="/services">← Tutti i percorsi</Link>
        <h1>Prenota lo studio</h1>
        <p>Scegli giorno, durata e orario. Poi controlla il prezzo della tua sessione.</p>
      </header>
      <StudioScheduler value={selection} bundle={false} clock={clock} compact onChange={update} onValidityChange={setAvailable}/>
      <details className={styles.rules}><summary>Orari dello studio e supplemento notturno</summary>
        <p>Da lunedì a giovedì 19:30–00:00, venerdì dalle 19:30, sabato dalle 10:00 e domenica 10:00–00:00. Tutti gli orari sono italiani.</p>
        <p>Venerdì e sabato, dopo mezzanotte, si aggiungono 10 € l’ora. Il supplemento è incluso nel totale mostrato quando scegli l’orario.</p>
        <Link href="/services/regole">Regole di prenotazione</Link>
      </details>
      {ready && <fieldset className={`payment-choice ${styles.payment}`}><legend>Come vuoi versare l’acconto?</legend>
        <label><input type="radio" name="recording-payment" checked={selection.payment==='card'} onChange={()=>update({payment:'card'})}/>Carta o Apple Pay</label>
        <label><input type="radio" name="recording-payment" checked={selection.payment==='cash'} onChange={()=>update({payment:'cash'})}/>Contanti in studio</label>
        {midpoint&&<p>In studio, entro {midpoint} circa. L’email riporta la scadenza esatta.</p>}
      </fieldset>}
    </section>
    <div className={`service-side-stack ${styles.summaryStack}`}>
      <aside className={`service-v8-summary ${styles.summary}`} aria-label="Costi della sessione">
        <h2>Costi della sessione</h2>
        {ready && quote ? <>
          <dl className={styles.costs}>
            {quote.lines.map((line,index)=><div key={index}><dt>{line.name}</dt><dd>{serviceAmount(line.amount)}</dd></div>)}
            <div className={styles.total}><dt>Totale</dt><dd>{serviceAmount(quote.total)}</dd></div>
            <div><dt>Acconto per confermare</dt><dd>{serviceAmount(quote.dueNow)}</dd></div>
            <div><dt>Saldo ancora da pagare</dt><dd>{serviceAmount(quote.balance)}</dd></div>
          </dl>
        </>:<p>Acconto fisso di 20,00 €. Scegli durata e orario per vedere il totale e il saldo.</p>}
        <div className={styles.actions}>
          <button type="button" className="button button-primary" disabled={busy||!ready} onClick={()=>continueBooking(true)}>Continua al riepilogo</button>
          {ready&&<button type="button" className="button button-secondary" disabled={busy} onClick={()=>continueBooking(false)}>Aggiungi al carrello</button>}
        </div>
        {message&&<p role="status">{message}</p>}
      </aside>
    </div>
  </div>;
}
