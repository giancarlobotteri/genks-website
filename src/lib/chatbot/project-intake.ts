import type {PreventivoInput} from './pricing.ts';
type Message={role:'user'|'assistant';content:string};
const numbers:Record<string,number>={un:1,uno:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20};
const quantity='\\d+|'+Object.keys(numbers).join('|');
/** Bare quantities belong to the question just asked, not to every numeric field. */
export function projectSongCount(messages:Message[]):number|undefined{
 let count:number|undefined;
 for(let i=0;i<messages.length;i++){
  if(messages[i].role!=='user')continue;
  const text=messages[i].content.toLowerCase().trim();
  const explicit=new RegExp(`(?:\\b(${quantity})\\s+(?:brani|pezzi|canzoni)|(?:brani|pezzi|canzoni)\\s+(?:saranno|sono|saranno in tutto|in totale sono)\\s+(${quantity})|\\b(?:ep|album)\\s+da\\s+(${quantity})\\b)`,'g');
  let found=false;
  for(const m of text.matchAll(explicit)){const value=m[1]??m[2]??m[3];count=numbers[value]??Number(value);found=true;}
  if(found)continue;
  const correction=text.match(new RegExp(`^(?:anzi|facciamo|cambia a|invece)\\s+(${quantity})(?:\\s+(?:brani|pezzi|canzoni))?[.!\\s]*$`));if(correction){count=numbers[correction[1]]??Number(correction[1]);continue;}
  const previous=messages[i-1];
  if(previous?.role!=='assistant'||!/(?:quanti|quante|numero|quantità).{0,35}(?:brani|pezzi|canzoni)/i.test(previous.content))continue;
  const answer=text.match(new RegExp(`^(?:(?:sono|saranno|facciamo|ne (?:voglio|vorrei|faccio)|vorrei|voglio|in totale|totale)\\s+)?(${quantity})(?:\\s+(?:in tutto|in totale))?[.!\\s]*$`));
  if(answer)count=numbers[answer[1]]??Number(answer[1]);
 }
 return count;
}
/** Resolve production before audio-file questions. Only customer statements authorize services. */
export function projectIntake(messages:Message[]):{reply:string}|{input:PreventivoInput}|null{
 const user=messages.filter(m=>m.role==='user').map(m=>m.content.toLowerCase());
 const text=user.join('\n');if(!/\bep\b|\balbum\b/.test(text))return null;
 const latest=user.at(-1)??'';
 // A new standalone request is not a modification of an earlier EP quote.
 if(!/\bep\b|\balbum\b|aggiung|nel progetto|al progetto|nel pacchetto|al pacchetto|brano\s+\d/.test(latest)&&/mix|master|registr/.test(latest)&&/quanto|preventivo|(?:un|1)\s+(?:brano|pezzo)|voglio registr|vorrei registr/.test(latest))return null;
 const format=user.reduce<'ep'|'album'>((f,t)=>/\balbum\b/.test(t)?'album':/\bep\b/.test(t)?'ep':f,'ep');
 let external=false;
 for(const t of user){if(/(?:ho già|ho gia|possiedo).{0,25}(?:basi|beat)|beat di altri|basi esterne/.test(t))external=true;else if(/(?:voglio|scelgo|facciamo|produzioni|beat).{0,20}genks/.test(t))external=false;}
 if(external)return {reply:'EP e album comprendono produzioni GENKS, anche in collaborazione con altri producer, mix, master e 2 ore di registrazione per brano. Se vuoi lavorare esclusivamente su basi esterne puoi acquistare [mix e master singolarmente](https://www.prodbygenks.com/services/project).'};
 const count=projectSongCount(messages);
 if(count===undefined)return {reply:`L’${format==='ep'?'EP':'album'} include beat GENKS, mix, master, una revisione e 2 ore di studio per brano. Quanti brani vuoi includere?`};
 if(count<2||count>20)return {reply:'Puoi configurare da 2 a 20 brani. Per un progetto diverso [scrivi a GENKS nei DM Instagram](https://www.instagram.com/prodbygenks/).'};
 if(/(?:senza|solo).{0,12}(?:mix|master|beat)/.test(user.at(-1)??''))return {reply:'EP e album includono sempre produzione GENKS, mix, master e 2 ore di registrazione per brano. Puoi scegliere le quantità di tracce audio separate; le 2 ore per brano sono incluse e le ore ulteriori richiedono una nuova prenotazione separata. Per lavorazioni diverse trovi i [servizi singoli](https://www.prodbygenks.com/services).'};
 if(/(?:\b[3-9]\b|tre|quattro|cinque)\s+revisioni?\s+(?:extra|aggiuntive)/.test(latest))return {reply:'Una revisione è inclusa per brano e lavorazione. Per più di due revisioni aggiuntive occorre concordare prima disponibilità e preventivo nei [DM Instagram](https://www.instagram.com/prodbygenks/).'};
 const tracks=Array.from({length:count},()=>8);let artists=1;
 const number=(s:string)=>numbers[s]??Number(s);
 for(const t of user){
  const n=t.match(/\b(\d+)\s+artisti\b/);if(n)artists=Number(n[1]);
  const groups=[...t.matchAll(new RegExp(`\\b(${quantity})\\s+(?:brani\\s+)?da\\s+(\\d+)\\b`,'g'))].map(m=>({count:number(m[1]),tracks:Number(m[2])}));
  if(groups.length>1){
   if(groups.reduce((n,g)=>n+g.count,0)!==count)return {reply:`La distribuzione delle tracce non corrisponde ai ${count} brani scelti. Indica quanti brani hanno ciascuna quantità di tracce audio separate.`};
   tracks.splice(0,count,...groups.flatMap(g=>Array.from({length:g.count},()=>g.tracks)));
  }else{
   const specific=[...t.matchAll(/\bbrano\s+(\d+)\s*(?:(?:ha|con|da|a)\s+)?(\d+)\s+(?:tracce|stem|file)\b/g)];
   if(specific.length){for(const m of specific){const i=Number(m[1])-1;if(i<0||i>=count)return {reply:`Il progetto ha ${count} brani. Indica un numero di brano compreso tra 1 e ${count}.`};tracks[i]=Number(m[2]);}}
   else {const m=t.match(/\b(?:tutti|tutte)\s+da\s+(\d+)\b/)??t.match(/\b(\d+)\s+(?:tracce|stem|file)\b/);if(m)tracks.fill(Number(m[1]));}
  }

 }
 if(tracks.some(n=>n<1||n>1000)||artists<1||artists>20)return {reply:'Controlla tracce audio separate (da 1 a 1000) e artisti (da 1 a 20). Per esigenze diverse scrivi nei DM Instagram.'};
 return {input:{progetto:{format,brani:tracks.map(tracce=>({produzione:'genks',servizio:'mix_master',tracce,artisti:artists,revisioni_extra:0,consegna_veloce:false})),registrazione:true,ore_extra:0}}};
}
