"use client";
import {useEffect,useState} from 'react';
import {dayHasAvailability,durationLabel,studioSlotAvailable,type StudioDay} from '@/lib/studio-scheduler';
import {shiftDay} from '@/lib/booking-slots';
import {recordingAppointmentLabel} from '@/lib/recording-selection';
import {serviceAmount,recordingHourlyCents} from '@/lib/service-rates';
import styles from './recording-journey.module.css';
import type {OrderSelection} from '@/lib/service-order-v8';
export function StudioScheduler({value,bundle,clock,fixedHours,minHours,maxHours=8,compact=false,onChange,onValidityChange}:{value:OrderSelection;bundle:boolean;clock:number;fixedHours?:number;minHours?:number;maxHours?:number;compact?:boolean;onChange:(v:Partial<OrderSelection>)=>void;onValidityChange:(v:boolean)=>void}){
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(clock));
 const [page,setPage]=useState(value.date||today),[days,setDays]=useState<StudioDay[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [showMoreDays,setShowMoreDays]=useState(false);
 useEffect(()=>{const abort=new AbortController();fetch('/api/availability?'+new URLSearchParams({date:page,calendar:'1'}),{signal:abort.signal,cache:'no-store'}).then(async r=>{const b=await r.json();if(!r.ok||!Array.isArray(b.days))throw Error(b.error??'Calendario non disponibile. Riprova.');return b.days as StudioDay[];}).then(setDays).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();},[page,retry]);
 const hours=fixedHours??(bundle?2+value.extraHours:value.hours),day=days.find(d=>d.date===value.date);
 const valid=!loading&&studioSlotAvailable(day,value.time,hours,value.payment,clock);
 useEffect(()=>onValidityChange(valid),[valid,onValidityChange]);
 const changeDuration=(next:number)=>{const canKeep=studioSlotAvailable(day,value.time,next,value.payment,clock);onChange({...bundle?{extraHours:next-2}:{hours:next},time:canKeep?value.time:''});};
 const pickPage=(next:string)=>{setLoading(true);setError('');setDays([]);setShowMoreDays(false);setPage(next);};

 if(compact){
  const firstDays=days.slice(0,6);
  const visibleDays=showMoreDays||Boolean(day&&!firstDays.includes(day))?days:firstDays;
  const availableTimes=day?.allSlots.filter(time=>studioSlotAvailable(day,time,hours,value.payment,clock))??[];
  const overnightDate=day&&[5,6].includes(new Date(day.date+'T12:00:00Z').getUTCDay())?shiftDay(day.date,1):null;
  const overnightDay=days.find(d=>d.date===overnightDate);
  const hasOvernight=overnightDay?.allSlots.some(time=>time<'10:00'&&studioSlotAvailable(overnightDay,time,hours,value.payment,clock));
  const nextCompatibleDay=day&&!availableTimes.length?days.find(d=>d.date>day.date&&d.allSlots.some(time=>studioSlotAvailable(d,time,hours,value.payment,clock))):undefined;
  const slots=(times:string[])=>times.map(time=><button type="button" key={time} disabled={loading} aria-pressed={value.time===time} onClick={()=>onChange({time})}>{time}</button>);
  return <div className={`studio-scheduler ${styles.scheduler}`}>
   <section aria-labelledby="recording-day"><div className="studio-step-title"><span>1</span><h2 id="recording-day">Scegli il giorno</h2></div>
    <div className="booking-calendar-nav"><button type="button" aria-label="Due settimane precedenti" disabled={page<=today||loading} onClick={()=>pickPage(shiftDay(page,-14)<today?today:shiftDay(page,-14))}>←</button><strong>{new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(new Date(page+'T12:00:00Z'))}</strong><button type="button" aria-label="Due settimane successive" disabled={loading||shiftDay(page,14)>shiftDay(today,180)} onClick={()=>pickPage(shiftDay(page,14))}>→</button></div>
    {loading&&<p role="status">Carico il calendario…</p>}
    {error&&<div role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={()=>{setLoading(true);setError('');setRetry(n=>n+1);}}>Riprova</button></div>}
    <div className={`booking-days ${styles.days}`}>{visibleDays.map(d=>{
      const available=dayHasAvailability(d,value.payment,clock,1);
      return <button type="button" key={d.date} disabled={!available||loading} aria-pressed={value.date===d.date} onClick={()=>onChange({date:d.date,time:''})}><span>{new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'numeric',month:'short'}).format(new Date(d.date+'T12:00:00Z'))}</span><small>{available?'Libero':'Non disponibile'}</small></button>;
    })}</div>
    {!showMoreDays&&visibleDays.length<days.length&&<button type="button" className={styles.moreDays} onClick={()=>setShowMoreDays(true)}>Mostra altri giorni ↓</button>}
   </section>
   {day&&<>
    <section aria-labelledby="recording-duration"><div className="studio-step-title"><span>2</span><h2 id="recording-duration">Quanto tempo ti serve?</h2></div>
     <label className={styles.duration}><span>Durata della registrazione</span><select value={hours} onChange={event=>changeDuration(Number(event.target.value))}>{Array.from({length:(maxHours-1)*2+1},(_,index)=>1+index/2).map(option=><option key={option} value={option}>{durationLabel(option)}</option>)}</select></label>
    </section>
    <section aria-labelledby="recording-time"><div className="studio-step-title"><span>3</span><h2 id="recording-time">Scegli l’ora di inizio</h2></div>
     {availableTimes.length?<><div className={`slot-grid ${styles.slots}`}>{slots(availableTimes.slice(0,6))}</div>
      {availableTimes.length>6&&<details key={`${day.date}-${hours}`} open={availableTimes.indexOf(value.time)>5||undefined}><summary>Altri orari ({availableTimes.length-6})</summary><div className={`slot-grid ${styles.slots}`}>{slots(availableTimes.slice(6))}</div></details>}</>:<div role="status"><p>Non ci sono {durationLabel(hours)} consecutive libere in questa data. Il venerdì e il sabato puoi proseguire oltre mezzanotte quando lo studio è libero.</p>{nextCompatibleDay&&<button type="button" className={styles.moreDays} onClick={()=>onChange({date:nextCompatibleDay.date,time:''})}>Primo giorno con {durationLabel(hours)} libere: {new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'numeric',month:'short'}).format(new Date(nextCompatibleDay.date+'T12:00:00Z'))} →</button>}</div>}
     {hasOvernight&&overnightDate&&<button type="button" className={styles.moreDays} onClick={()=>onChange({date:overnightDate,time:''})}>Vedi gli orari dopo mezzanotte →</button>}
     {valid&&<p className="studio-selection" role="status">{recordingAppointmentLabel(value.date,value.time,hours)}</p>}
    </section>
   </>}
  </div>;
 }
 return <div className="studio-scheduler">
 <section className="studio-hours"><h3>Quando puoi registrare</h3><div><span>Lunedì–giovedì</span><strong>19:30–00:00</strong></div><div><span>Venerdì</span><strong>Dalle 19:30</strong></div><div><span>Sabato</span><strong>Dalle 10:00</strong></div><div><span>Domenica</span><strong>10:00–00:00</strong></div><p>Venerdì e sabato si può proseguire oltre mezzanotte, secondo gli orari disponibili. Supplemento: +10,00 € ogni ora dopo le 00:00, oltre al costo del tempo.</p></section><section aria-label="Scegli il giorno"><div className="studio-step-title"><span>1</span><h3>Scegli il giorno</h3></div><p>Gli impegni già occupati restano visibili. Tutti gli orari sono italiani.</p>
 <div className="booking-calendar-nav"><button type="button" aria-label="Due settimane precedenti" disabled={page<=today||loading} onClick={()=>pickPage(shiftDay(page,-14)<today?today:shiftDay(page,-14))}>←</button><strong>{new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(new Date(page+'T12:00:00Z'))}</strong><button type="button" aria-label="Due settimane successive" disabled={loading||shiftDay(page,14)>shiftDay(today,180)} onClick={()=>pickPage(shiftDay(page,14))}>→</button></div>
 {loading&&<p role="status">Verifico gli orari disponibili…</p>}{error&&<div role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={()=>{setLoading(true);setError('');setRetry(n=>n+1);}}>Riprova il calendario</button></div>}
 <div className="booking-days">{days.map(d=>{const available=dayHasAvailability(d,value.payment,clock,fixedHours??(bundle?2:minHours??.25));return <button type="button" key={d.date} disabled={!available||loading} aria-pressed={value.date===d.date} onClick={()=>onChange({date:d.date,time:''})}><span>{new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'numeric',month:'short'}).format(new Date(d.date+'T12:00:00Z'))}</span><small>{available?'Disponibile':d.allSlots.length?'Occupato / non prenotabile':'Non disponibile'}</small></button>;})}</div></section>
 {day&&fixedHours===undefined&&<section aria-label="Scegli la durata"><div className="studio-step-title"><span>2</span><h3>Quanto vuoi registrare?</h3></div><div className="studio-duration-control"><button type="button" aria-label="Riduci durata" disabled={hours<=(minHours??(bundle?2:.25))} onClick={()=>changeDuration(Math.max(minHours??(bundle?2:.25),hours-.5))}>−</button><strong>{durationLabel(hours)}</strong><button type="button" aria-label="Aumenta durata" disabled={hours>=maxHours} onClick={()=>changeDuration(Math.min(maxHours,hours+.5))}>+</button></div>
 <div className="studio-duration-options">{(bundle?[2,3,4,5]:maxHours===5?[1,2,3,4,5]:[1,2,3,4]).filter(h=>h<=maxHours&&h>=(minHours??.25)).map(h=><button type="button" key={h} aria-pressed={hours===h} onClick={()=>changeDuration(h)}>{durationLabel(h)}<small>{bundle?h===2?'Incluse nel pacchetto':`+${serviceAmount((h-2)*999)}`:value.packageCode==='hours'?'Dal credito di 5 ore':value.packageCode==='beat_voice'?h===2?'Incluse nel pacchetto':`+${serviceAmount(Math.round((h-2)*recordingHourlyCents))}`:serviceAmount(Math.round(h*recordingHourlyCents))}</small></button>)}</div>
 <p>{bundle?'Due ore incluse. Ogni ora aggiuntiva nella stessa sessione costa 9,99 €.':value.packageCode==='hours'?'Scegli quante delle 5 ore usare nel primo appuntamento. Il prezzo del blocco resta 79,99 €; il residuo si usa entro 90 giorni, in massimo 2 appuntamenti complessivi.':value.packageCode==='beat_voice'?'Due ore incluse in Beat & Voce. Le ore ulteriori costano 19,99 €/ora, con supplemento notturno dove previsto.':'19,99 € per ogni ora di registrazione. Il totale si aggiorna subito.'}</p></section>}
 {day&&<section aria-label="Scegli l’orario"><div className="studio-step-title"><span>3</span><h3>Scegli l’orario di inizio</h3></div><p>Seleziona un orario con {durationLabel(hours)} {hours===1?'consecutiva libera':'consecutive libere'}.</p><div className="slot-grid">{day.allSlots.map(time=>{const available=studioSlotAvailable(day,time,hours,value.payment,clock);return <button type="button" key={time} disabled={!available||loading} aria-pressed={value.time===time} onClick={()=>onChange({time})}><strong>{time}</strong><small>{available?'Disponibile':day.durationsBySlot[time]?.length?'Durata non disponibile':'Occupato'}</small></button>;})}</div>{!Object.keys(day.durationsBySlot).some(t=>studioSlotAvailable(day,t,hours,value.payment,clock))&&<p role="status">Nessun intervallo di questa durata: riduci le ore oppure scegli un altro giorno.</p>}{valid&&<p className="studio-selection" role="status">{recordingAppointmentLabel(value.date,value.time,hours)}</p>}</section>}
 <aside className="studio-night-note"><strong>Se registri dopo mezzanotte</strong><p>Solo venerdì e sabato: +10,00 € ogni ora dopo le 00:00, oltre al costo del tempo. Il supplemento compare nel totale prima di pagare.</p></aside>
 </div>;
}
