import {codificaPreventivo,type PreventivoInput,type Preventivo} from './pricing.ts';
const words:Record<string,number>={un:1,uno:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10};
const count=(s:string)=>words[s.toLowerCase()]??Number(s);
/** Resolve explicit customer quantities before pricing; never alter the calculator or its prices. */
export function normalizeQuoteRequest(input:PreventivoInput,text:string,authorizationText=text):PreventivoInput{
 const auth=authorizationText.toLowerCase();const t=text.toLowerCase();let next:PreventivoInput={...input,brani:input.brani?.map(b=>({...b,artisti_correzione_voce:/correz|intonaz|pulizia.*voc|tuning|editing|artisti.*voc/.test(auth)?b.artisti_correzione_voce:0,revisioni_extra:/revision|modifiche aggiuntive/.test(auth)?b.revisioni_extra:0,consegna_veloce:/veloc|urgent|rush|express|fast|48\s*(?:ore|h)|consegna.*domani/.test(auth)?b.consegna_veloce:false}))};
 const distribution=[...t.matchAll(/\b(un[oa]?|due|tre|quattro|cinque|sei|\d+)\s+da\s+(\d+)\b/g)].map(m=>({quantita:count(m[1]),file:Number(m[2])}));
 const explicit=t.match(/\b(\d+|un[oa]?|due|tre|quattro|cinque|sei|sette|otto)\s+(?:brani|brano|pezzi|pezzo|canzoni)\b/);
 const expected=explicit?count(explicit[1]):null;
 if(distribution.length>1&&expected&&distribution.reduce((n,b)=>n+b.quantita,0)===expected&&next.brani?.length){
  const first=next.brani[0];if(next.brani.every(b=>b.servizio===first.servizio&&(b.artisti_correzione_voce??0)===(first.artisti_correzione_voce??0)&&(b.revisioni_extra??0)===(first.revisioni_extra??0)&&!!b.consegna_veloce===!!first.consegna_veloce))next.brani=distribution.map(b=>({...first,...b}));
 }
 if(expected&&next.brani?.length&&next.brani.reduce((n,b)=>n+(b.quantita??1),0)!==expected)throw Error(`Il cliente ha richiesto ${expected} brani totali: correggi le quantità, senza aggiungere brani.`);
 if(/\bbeat\b/.test(t)&&/registr|studio/.test(t)&&/mix/.test(t)&&!/senza.*beat|base (?:mia|fornita)|fornisco.*base|beat.*(?:non.*genks|un altro|già pronto)/.test(t)){
  next={...next,beat_su_misura:next.beat_su_misura||1,ore_registrazione:next.ore_registrazione||2,brani:next.brani?.length?next.brani.map(b=>({...b,servizio:'mix_master'})):[{servizio:'mix_master',file:8}]};
 }
 return next;
}
export function formatQuote(input:PreventivoInput,result:Preventivo,text:string){
 const english=/\bhow much|\bcan i|\bi (?:want|need|have)\b/i.test(text);
 const link=`https://www.prodbygenks.com/services/checkout?preventivo=${codificaPreventivo(input)}`;
 if(english)return [`**Total: ${result.totale}**`,`${(input.brani??[]).reduce((n,b)=>n+(b.quantita??1),0)} ${(input.brani??[]).reduce((n,b)=>n+(b.quantita??1),0)===1?"song":"songs"}. One revision per song and service included. First version within 7 working days, or 48 hours if selected.`,...(result.importi_centesimi.listino>result.importi_centesimi.totale?[`You save ${result.risparmio}.`]:[]),...(result.importi_centesimi.saldo?[`Pay now: ${result.da_pagare_subito}. Remaining balance: ${result.saldo_successivo}.`]:[]),`[Buy this offer](${link})`].join('\n\n');
 return [`**Totale: ${result.totale}**`,...result.righe.slice(0,6).map(r=>`${r.descrizione}: **${r.prezzo}**`),...(result.importi_centesimi.listino>result.importi_centesimi.totale?[`Risparmi **${result.risparmio}** rispetto agli stessi servizi separati.`]:[]),...(result.importi_centesimi.saldo?[`Da versare ora: **${result.da_pagare_subito}**. Saldo successivo: ${result.saldo_successivo}.`]:[]),...result.note.filter(n=>n.startsWith('Suggerimento:')),...((input.brani?.length||input.beat_su_misura)?['Una revisione inclusa per brano e lavorazione.']:[]),...((input.brani??[]).some(b=>b.servizio!=='master'&&!b.file)?['Prezzo per brani fino a 8 file; oltre questa fascia il totale cambia.']:[]),`[Acquista questa offerta](${link})`].join('\n\n');
}
