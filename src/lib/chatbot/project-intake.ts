import type {PreventivoInput} from './pricing.ts';
type Message={role:'user'|'assistant';content:string};
const numbers:Record<string,number>={due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20};
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
 const format=user.reduce<'ep'|'album'>((f,t)=>/\balbum\b/.test(t)?'album':/\bep\b/.test(t)?'ep':f,'ep');
 if(/(?:ho già|ho gia|possiedo|beat di altri|basi esterne)/.test(user.at(-1)??''))return {reply:'EP e album comprendono produzioni GENKS, anche in collaborazione con altri producer, mix, master e 2 ore di registrazione per brano. Se vuoi lavorare esclusivamente su basi esterne puoi acquistare [mix e master singolarmente](https://www.prodbygenks.com/services/project).'};
 const count=projectSongCount(messages);
 if(count===undefined)return {reply:`L’${format==='ep'?'EP':'album'} include beat GENKS, mix, master, una revisione e 2 ore di studio per brano. Quanti brani vuoi includere?`};
 if(count<2||count>20)return {reply:'Puoi configurare da 2 a 20 brani. Per un progetto diverso [scrivi a GENKS nei DM Instagram](https://www.instagram.com/prodbygenks/).'};
 if(/(?:senza|solo).{0,12}(?:mix|master|beat)/.test(user.at(-1)??''))return {reply:'EP e album includono sempre produzione GENKS, mix, master e 2 ore di registrazione per brano. Puoi scegliere soltanto quantità di tracce audio separate e ore aggiuntive. Per lavorazioni diverse trovi i [servizi singoli](https://www.prodbygenks.com/services).'};
 let tracks=8,artists=1;
 for(const t of user){const m=t.match(/\b(\d+)\s+(?:tracce|stem|file)\b/);if(m)tracks=Number(m[1]);const n=t.match(/\b(\d+)\s+artisti\b/);if(n)artists=Number(n[1]);}
 if(tracks<1||tracks>1000||artists<1||artists>20)return {reply:'Controlla il numero di tracce audio separate e artisti. Per progetti oltre i limiti del configuratore scrivi nei DM Instagram.'};
 return {input:{progetto:{format,brani:Array.from({length:count},()=>({produzione:'genks',servizio:'mix_master',tracce:tracks,artisti:artists,revisioni_extra:0,consegna_veloce:false})),registrazione:true,ore_extra:0}}};
}
