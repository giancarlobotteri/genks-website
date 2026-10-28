import {simpleAudioRequest} from './audio-request.ts';
import {quoteInputSchema} from './checkout.ts';
import {calcolaPreventivo,type PreventivoInput} from './pricing.ts';
import {formatQuote} from './quote-request.ts';

export type ChatResult={reply:string;draft?:PreventivoInput;review?:boolean};
const names={mix:'Mix',master:'Master stereo',mix_master:'Mix + master'};
/** The draft contains quantities only. All amounts are recalculated, including at checkout. */
export function reviewQuote(raw:unknown):ChatResult{
 const draft=quoteInputSchema.parse(raw),q=calcolaPreventivo(draft);
 if(q.errore)throw Error(q.errore);
 const lines:string[]=[];
 if(draft.progetto){
  const p=draft.progetto,groups=new Map<number,number>();
  for(const b of p.brani)groups.set(b.tracce,(groups.get(b.tracce)??0)+1);
  lines.push(`**${p.format==='album'?'Album':'EP'} · ${p.brani.length} brani**`,'Beat GENKS, mix + master, una revisione e 2 ore di studio per brano.',`Tracce audio separate: ${[...groups].map(([n,c])=>`${c} ${c===1?'brano':'brani'} da ${n}`).join(' · ')}.`,...p.brani.every(b=>b.tracce===8)?['Fascia iniziale fino a 8 tracce per le produzioni da creare; se cambia, il totale va aggiornato.']:[],`Studio: ${p.brani.length*2} ore incluse. Per ore ulteriori serve una nuova prenotazione separata, con relativo pagamento e secondo disponibilità.`);
 }else{
  for(const b of draft.brani??[])lines.push(`${b.quantita??1} ${b.quantita===1||!b.quantita?'brano':'brani'} · **${names[b.servizio]}**${b.servizio==='master'?'':` · ${b.file??8} tracce audio separate per brano`}${b.consegna_veloce?' · prima versione in 48 ore':''}${b.revisioni_extra?` · ${b.revisioni_extra} revisioni aggiuntive per brano`:''}.`);
  if(draft.beat_su_misura)lines.push(`**${draft.beat_su_misura} beat GENKS su misura**, una revisione inclusa; split 50/50 sulla composizione.`);
  if(draft.ore_registrazione)lines.push(`**${draft.ore_registrazione} ore di registrazione**, giorno e orario da scegliere e verificare nel modulo.`);
  if((draft.mezzore_dopo_mezzanotte??0)>0)lines.push('Supplemento notturno incluso nel calcolo; viene verificato sull’appuntamento scelto.');
 }
 lines.push(`**Totale verificato: ${q.totale}**`,...q.importi_centesimi.listino>q.importi_centesimi.totale?[`Risparmi **${q.risparmio}** rispetto agli stessi servizi separati.`]:[],`Da pagare prima della conferma/avvio: **${q.da_pagare_subito}**.${q.importi_centesimi.saldo?` Saldo ancora da pagare: ${q.saldo_successivo}.`:''}`,'**Confermi questo riepilogo?** Puoi anche dirmi cosa cambiare. Non è stato creato alcun ordine né riservato un orario.');
 return {reply:['**Riepilogo prima dell’offerta**',...lines].join('\n\n'),draft,review:true};
}
export function isQuoteConfirmation(text:string){return /^(?:s[iì](?:[,!\s]+confermo)?|confermo(?: il riepilogo| tutto)?|ok(?:[,!\s]+(?:confermo|procedi|va bene))?|va bene(?:[,!\s]+(?:confermo|procedi))?|procedi|yes|confirm)[.!\s]*$/i.test(text.trim());}
export function confirmedQuote(raw:unknown,text=''):ChatResult{
 const draft=quoteInputSchema.parse(raw),q=calcolaPreventivo(draft);if(q.errore)throw Error(q.errore);
 return {reply:formatQuote(draft,q,text),draft,review:false};
}
/** Handle clear edits to the current request without resetting its other choices. */
export function reviseQuote(raw:PreventivoInput,text:string):PreventivoInput|null{
 const draft=structuredClone(raw),t=text.toLowerCase();
 if(!/aggiung|togli|cambi|anzi|invece|solo|senza|brano\s+\d|tutti|tutte|facciamo/.test(t))return null;
 if(draft.progetto)return null; // Project history resolves per-song edits and included studio time.
 let changed=false;
 const count=t.match(/(?:facciamo|invece|anzi|cambia a)\s+(\d+)\s+(?:brani|pezzi)/);
 if(count&&draft.brani?.length===1){draft.brani[0].quantita=Number(count[1]);changed=true;}
 if(/(?:solo|invece|passa al)\s+(?:il\s+)?master/.test(t)&&draft.brani?.length){draft.brani=draft.brani.map(b=>({...b,servizio:'master',file:1}));changed=true;}
 if(/(?:solo|invece)\s+(?:il\s+)?mix(?!.*master)/.test(t)&&draft.brani?.length){draft.brani=draft.brani.map(b=>({...b,servizio:'mix'}));changed=true;}
 const revisions=t.match(/(\d+)\s+revisioni?\s+(?:extra|aggiuntive)/);
 if(revisions&&draft.brani?.length){if(Number(revisions[1])>2)throw Error('Per oltre due revisioni aggiuntive concorda prima la disponibilità con GENKS.');draft.brani=draft.brani.map(b=>({...b,revisioni_extra:Number(revisions[1])}));changed=true;}

 const hours=t.match(/\b(\d+)\s+or[ae]\b/);
 if(hours&&/registr|studio|rec\b/.test(t)){const n=Number(hours[1]);draft.ore_registrazione=/aggiung/.test(t)?(draft.ore_registrazione??0)+n:n;changed=true;}
 if(/togli|senza/.test(t)&&/registr|studio|rec\b/.test(t)){draft.ore_registrazione=0;changed=true;}
 if(/veloce|48\s*(?:ore|h)/.test(t)&&draft.brani?.length){draft.brani=draft.brani.map(b=>({...b,consegna_veloce:!/togli|senza/.test(t)}));changed=true;}
 const specific=t.match(/brano\s+(\d+).*?(\d+)\s+(?:tracce|stem|file)/);
 const tracks=t.match(/\b(\d+)\s+(?:tracce|stem|file)/);
 if(tracks&&draft.brani?.length){
  const expanded=draft.brani.flatMap(b=>Array.from({length:b.quantita??1},()=>({...b,quantita:1})));
  const i=specific?Number(specific[1])-1:null;if(i!==null&&(i<0||i>=expanded.length))throw Error('Indica un numero di brano presente nel riepilogo.');
  draft.brani=expanded.map((b,n)=>i===null||i===n?{...b,file:Number(specific?.[2]??tracks[1])}:b);changed=true;
 }
 return changed?quoteInputSchema.parse(draft):null;
}

/** Resolve the one missing audio quantity from the question actually asked. */
export function audioIntake(messages:{role:'user'|'assistant';content:string}[]):ChatResult|{input:PreventivoInput}|null{
 const latest=messages.at(-1)?.content??'',previous=messages.at(-2);
 let request=latest;
 if(previous?.role==='assistant'&&/Quante tracce audio separate/.test(previous.content)&&/^\s*\d+(?:\s+(?:tracce|file|stems?))?[.!\s]*$/i.test(latest)){
  const earlier=[...messages.slice(0,-2)].reverse().find(m=>m.role==='user'&&/mix|master/i.test(m.content));if(earlier)request=earlier.content+' con '+latest.match(/\d+/)![0]+' tracce audio separate';
 }
 const input=simpleAudioRequest(request);if(!input)return null;
 if(input.brani?.some(b=>b.servizio!=='master')&&!/\d+\s+(?:tracce|file|stems?|tracks)\b/i.test(request)){
  const q=calcolaPreventivo(input);return {reply:`Per la fascia fino a 8 tracce, il totale di partenza è **${q.totale}**. Prima di preparare l’offerta: **Quante tracce audio separate ha ogni brano?** Se non le conosci, dimmelo e ti aiuto a contarle.`};
 }
 return {input};
}
