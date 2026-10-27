import type {PreventivoInput} from './pricing.ts';
type Message={role:'user'|'assistant';content:string};
const numbers:Record<string,number>={due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20};
/** Resolve production before audio-file questions. Only customer statements authorize services. */
export function projectIntake(messages:Message[]):{reply:string}|{input:PreventivoInput}|null{
 const user=messages.filter(m=>m.role==='user').map(m=>m.content.toLowerCase());
 if(!user.some(t=>/\bep\b|\balbum\b/.test(t)))return null;
 const text=user.join('\n');
 let source:'genks'|'external'|undefined;
 for(const t of user){
  if(/^(?:le|li) ho gi[aà][.!\s]*$/.test(t))source='external';
  if(/^(?:tutt[ei]|tutt[ei] genks|genks|da te)[.!\s]*$/.test(t))source='genks';
  if(/(?:ho|abbiamo|possiedo|abbiamo gia|ho gia).{0,20}(?:beat|bas[ei]|produzioni)|(?:beat|bas[ei]).{0,25}(?:altri? producer|gia pront|già pront|miei|mie)/.test(t)&&!/(?:non|nessun).{0,15}(?:ho|abbiamo|beat|bas[ei])/.test(t))source='external';
  if(/(?:mi servono|voglio|vorrei|ho bisogno di).{0,20}(?:produzioni|beat|basi)|(?:produzioni|beat|basi).{0,25}(?:da te|genks|fatte da te)|(?:falle|falli|producili|producile) tu/.test(t)&&!/(?:non|senza|niente).{0,15}(?:produzioni|beat|basi)/.test(t))source='genks';
  if(/(?:mi servono|voglio|vorrei).{0,15}produzioni/.test(t)&&/non ho.{0,12}(?:beat|bas[ei])/.test(t))source='genks';
 }
 // A mixed project requires a per-song choice; never flatten it into all GENKS or all external.
 if(/alcun[ie].{0,35}(?:genks|tu[eoia]|produzion)|(?:\d+|due|tre|quattro).{0,25}(?:genks|da te).{0,35}(?:altr|restant)/.test(text)){
  if(user.length>1&&/\b(?:brani|brano)\s*\d|\d\s*(?:e|,)\s*\d/.test(user.at(-1)!)&&/genks|da te|altr|esterne|gia|già/.test(user.at(-1)!))return null;
  return {reply:'Per quali brani vuoi una produzione GENKS e per quali hai già la base? Puoi indicare i numeri dei brani; poi definiamo la lavorazione di ciascuno.'};
 }
 if(!source)return {reply:'Per il tuo EP o album vuoi produzioni su misura GENKS, hai già le basi di altri producer, oppure una combinazione delle due? Prima definiamo questo; le tracce audio separate serviranno solo per i brani già pronti da lavorare.'};
 let count:number|undefined;
 for(const t of user){const matches=[...t.matchAll(/(?:\b(\d+|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti)\s+(?:brani|pezzi|canzoni)|(?:brani|pezzi|canzoni)\s+(?:saranno|sono|saranno in tutto|in totale sono)\s+(\d+|due|tre|quattro|cinque|sei|sette|otto|nove|dieci))/g)];for(const m of matches){const value=m[1]??m[2];count=numbers[value]??Number(value);}}
 if(!count){const match=text.match(/\b(?:ep|album)\s+da\s+(\d+|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b/);if(match)count=numbers[match[1]]??Number(match[1]);}
 if(!count)return {reply:'Quanti brani vuoi includere nel progetto?'};
 if(count<2||count>20)return {reply:'Il configuratore EP e album gestisce da 2 a 20 brani. Per progetti diversi [scrivi a GENKS nei DM Instagram](https://www.instagram.com/prodbygenks/).'};
 let service:'mix'|'master'|'mix_master'|'none'|undefined;
 for(const t of user){if(/(?:senza|nessun|niente).{0,8}mix.{0,8}master|solo.{0,8}(?:produzion|beat|basi)/.test(t))service='none';else if(/solo (?:il )?master/.test(t))service='master';else if(/solo (?:il )?mix/.test(t))service='mix';else if(/\bmix\b/.test(t)&&/\bmaster\b/.test(t))service='mix_master';else if(/\bmix\b/.test(t))service='mix';else if(/\bmaster\b/.test(t))service='master';}
 if(!service)return {reply:'Oltre alle basi, vuoi mix, master, entrambi oppure nessuna lavorazione audio?'};
 // External recordings and mixed requests continue through the model, after this prerequisite.
 if(source==='external')return null;
 if(/registr|\bstudio\b|\brec\b|revision|veloc|urgent|48\s*(?:ore|h)|\d+\s*(?:file|tracce|stem)/.test(text))return null;
 return {input:{progetto:{brani:Array.from({length:count},()=>({produzione:'genks' as const,servizio:service!,tracce:8,artisti:1,revisioni_extra:0,consegna_veloce:false})),registrazione:false,ore_extra:0}}};
}
