import type {PreventivoInput} from './pricing.ts';
const words:Record<string,number>={un:1,uno:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10};
const numeric='\\d+|'+Object.keys(words).join('|');
/** Clear standalone audio requests do not need a language model to calculate. */
export function simpleAudioRequest(text:string):PreventivoInput|null{
 const t=text.toLowerCase();
 if(!/mix|master/.test(t)||/\bep\b|album|beat|produzion|registr|studio|garanzia|rimborso|sconto|diritt|ordine|cancell|file.*(?:invio|invian|mando)|come.*(?:file|prepar|cont)/.test(t))return null;
 if(!/quanto|costa|prezzo|preventivo|vorrei|voglio|mi serve|how much|i need|i want/.test(t))return null;
 const mix=/mix/.test(t),master=/master/.test(t)&&!/senza (?:il )?master|solo (?:il )?mix/.test(t);
 const servizio=mix&&master?'mix_master':mix?'mix':'master';
 const raw=t.match(new RegExp(`\\b(${numeric})\\s+(?:brani|brano|pezzi|pezzo|canzoni|canzone|song|songs|tracks? to master)\\b`))?.[1];
 const quantita=raw?words[raw]??Number(raw):1;
 const file=servizio==='master'?1:Number(t.match(/\b(\d+)\s+(?:tracce|file|stem|stems|tracks)\b/)?.[1]??8);
 // Mixed per-song distributions and revisions requiring confirmation stay with the guided flow.
 if(/\b(?:due|tre|uno|una|\d+)\s+da\s+\d+/.test(t))return null;
 const revision=t.match(/\b(\d+)\s+revisioni?\s+(?:extra|aggiuntive)/);
 if(revision&&Number(revision[1])>2)return null;
 return {brani:[{servizio,quantita,file,revisioni_extra:revision?Number(revision[1]):0,consegna_veloce:/veloc|urgent|rush|48\s*(?:ore|h)/.test(t)}]};
}
