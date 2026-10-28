import {totalEnding99,roundingLineName} from '../order-rounding.ts';
import {audioPriceV10,fixedPackageV10,ratesV10} from '../service-pricing-v10.ts';
import {beatVoiceBundle,recordingDepositCents,discountedStudioBundle} from '../service-payment-policy.ts';
import {revisionTotal} from '../service-catalog.ts';
import type {ProductionInput} from '../production-calculator.ts';
import {calculateProduction} from '../production-calculator.ts';
export type Servizio='mix'|'mix_master'|'master';
export interface BranoInput{servizio:Servizio;quantita?:number;file?:number;artisti_correzione_voce?:number;revisioni_extra?:number;consegna_veloce?:boolean}
export interface PreventivoInput{progetto?:ProductionInput;brani?:BranoInput[];ore_registrazione?:number;mezzore_dopo_mezzanotte?:number;beat_su_misura?:number;usa_pacchetti?:boolean}
export interface Brano{file:number;servizio:Servizio;fascia:number;artisti:number;revisioni:number;veloce:boolean}
export type Componente={tipo:string;brani?:Brano[];ore?:number;beat?:number;quantita?:number;saldo?:number;aggancio?:string;studioAmount?:number;customAmount?:number};
export interface Riga{descrizione:string;prezzo:string;centesimi:number;componente?:Componente;personalizzato?:boolean}
export interface Preventivo{righe:Riga[];totale:string;totale_servizi_separati:string;risparmio:string;da_pagare_subito:string;saldo_successivo:string;offerta_personalizzata:boolean;link_acquisto?:string;link:string[];note:string[];importi_centesimi:{totale:number;subito:number;saldo:number;listino:number};errore?:string;unroundedTotal?:number;unroundedBalance?:number}
const site='https://www.prodbygenks.com';
export const euro=(c:number)=>(Math.round(c)/100).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
export const arrotonda99=(c:number)=>Math.max(99,Math.round(c/100)*100-1);
export const costoRevisioni=revisionTotal;
export function costoCorrezioneVoci(n:number){if(!Number.isInteger(n)||n<0||n>20)throw Error('invalid_artists');return 0;}
function int(value:unknown,fallback=0,max=1000){const n=value===undefined?fallback:Number(value);if(!Number.isInteger(n)||n<0||n>max)throw Error('Quantità non valida.');return n;}
export function codificaPreventivo(input:PreventivoInput){const bytes=new TextEncoder().encode(JSON.stringify(input));return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
export function decodificaPreventivo(code:string):PreventivoInput|null{try{if(!code||code.length>16000||!/^[A-Za-z0-9_-]+$/.test(code))return null;return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(code.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))));}catch{return null;}}
export function calcolaPreventivo(input:PreventivoInput):Preventivo{
 const righe:Riga[]=[],note:string[]=[];let total=0,listino=0,balance=0;
 const result=(errore?:string):Preventivo=>{
  const rawTotal=total,rawBalance=balance;
  if(!errore){const delta=totalEnding99(total)-total;if(delta){
   const meaningful=righe.filter(r=>!['night','audio_extra'].includes(r.componente?.tipo??''));
   const onlyRecording=meaningful.every(r=>r.componente?.tipo==='recording');
   if(onlyRecording&&meaningful[0]){const target=meaningful[0];balance+=(target.centesimi+delta-recordingDepositCents(target.centesimi+delta))-(target.centesimi-recordingDepositCents(target.centesimi));}
   total+=delta;righe.push({descrizione:roundingLineName,prezzo:euro(delta),centesimi:delta,componente:{tipo:'rounding',saldo:0}});
  }}
  return {righe,totale:euro(total),totale_servizi_separati:euro(listino),risparmio:euro(Math.max(0,listino-total)),da_pagare_subito:euro(total-balance),saldo_successivo:euro(balance),offerta_personalizzata:true,...!errore?{link_acquisto:`${site}/services/checkout?preventivo=${codificaPreventivo(input)}`}:{},link:[`${site}/services`],note,importi_centesimi:{totale:total,subito:total-balance,saldo:balance,listino},unroundedTotal:rawTotal,unroundedBalance:rawBalance,...errore?{errore}:{}};
 };
 const add=(name:string,amount:number,componente:Componente,separate=amount)=>{if(!Number.isSafeInteger(amount)||amount<0)throw Error('Importo non valido.');righe.push({descrizione:name,prezzo:euro(amount),centesimi:amount,componente});total+=amount;listino+=separate;balance+=Math.floor(componente.saldo??0);};
 try{
  if(!input||typeof input!=='object')throw Error('Indica il servizio desiderato.');
  if(input.progetto){
   const q=calculateProduction(input.progetto,brani=>calcolaPreventivo({brani,usa_pacchetti:false}));
   total=q.total;listino=q.listTotal;balance=q.balance;
   righe.push(...q.lines.map(l=>({descrizione:l.name,prezzo:euro(l.amount),centesimi:l.amount})));
   note.push('EP e album: produzioni GENKS, mix, master, una revisione e due ore di studio per brano. Il progetto configurato si paga interamente subito; non si possono aggiungere ore al pacchetto. Eventuali ore ulteriori richiedono una nuova prenotazione separata e il relativo pagamento, secondo disponibilità. Collaborazioni con altri producer possibili, con accordo sui diritti.');
   const out=result();const link=`${site}/services/album?preventivo=${codificaPreventivo(input)}`;return {...out,link_acquisto:link,link:[link]};
  }
  const songs:Brano[]=[];
  for(const b of input.brani??[]){
   if(!['mix','master','mix_master'].includes(b.servizio))throw Error('Servizio non valido.');
   const count=int(b.quantita,1,40),file=b.servizio==='master'?1:int(b.file,8);
   if(!count||!file||songs.length+count>40)throw Error('Scegli da 1 a 40 brani.');
   const artisti=int(b.artisti_correzione_voce,0,20),revisioni=int(b.revisioni_extra,0,2);
   costoCorrezioneVoci(artisti);
   for(let i=0;i<count;i++)songs.push({servizio:b.servizio,file,fascia:file<=8?0:file<=16?1:file<=24?2:file<=36?3:4,artisti,revisioni,veloce:Boolean(b.consegna_veloce)});
  }
  const use=input.usa_pacchetti!==false,masters=songs.filter(s=>s.servizio==='master'),others=songs.filter(s=>s.servizio!=='master');
  let hours=int(input.ore_registrazione,0,200),beats=int(input.beat_su_misura,0,20);
  const eligible=others.filter(s=>s.servizio==='mix_master'&&s.revisioni===0&&!s.veloce);
  if(use&&eligible.length===1&&hours>=1&&hours<=8){
   const s=eligible[0],audio=audioPriceV10('mix_master',s.file),beat=beats>0?ratesV10.beat:0;
   const bundled=discountedStudioBundle(audio,hours*ratesV10.recordingHour,beat);
   const studioBest=Math.floor(hours/5)*ratesV10.fiveHours+(hours%5)*ratesV10.recordingHour;
   if(bundled.total<audio+studioBest+beat){
    add(`${beat?'Singolo chiavi in mano':'Registrazione + mix/master'} · ${hours} ore · ${s.file} tracce audio separate · risparmi ${euro(bundled.saving)}`,bundled.total,{tipo:beat?'turnkey':'voice',brani:[s],ore:hours,beat:beat?1:0,saldo:0,studioAmount:bundled.studio,customAmount:bundled.beat},bundled.separate);
    others.splice(others.indexOf(s),1);hours=0;if(beat)beats--;
   }
  }

  while(use&&beats>0&&hours>=2){
   const studioBest=(n:number)=>Math.floor(n/5)*ratesV10.fiveHours+(n%5)*ratesV10.recordingHour;
   const before=studioBest(hours)+ratesV10.beat;
   let selected=0,best=before;
   for(let h=2;h<=Math.min(8,hours);h++){const cost=beatVoiceBundle(h).total+studioBest(hours-h);if(cost<best){best=cost;selected=h;}}
   if(!selected)break;
   const q=beatVoiceBundle(selected);add(`Beat & Voce · beat GENKS + ${selected} ore di studio · una revisione del beat`,q.total,{tipo:'beat_voice',ore:selected,beat:1,saldo:0,studioAmount:q.studio,customAmount:q.beat},q.separate);hours-=selected;beats--;
  }

  let done=0;
  if(use&&masters.every(s=>s.revisioni===0&&!s.veloce))for(;done+3<=masters.length;done+=3){const brani=masters.slice(done,done+3);const p=fixedPackageV10('masters');add('Master Pack · 3 master stereo · una revisione per brano',p.total,{tipo:'audio_pack',brani,saldo:0},p.separate);}
  for(const s of [...others,...masters.slice(done)])add(`${s.servizio==='master'?'Master stereo':s.servizio==='mix'?'Mix':'Mix + master'} · ${s.file} tracce audio separate`,audioPriceV10(s.servizio,s.file),{tipo:'audio',brani:[s],saldo:0});
  const extras=songs.reduce((sum,s)=>sum+costoRevisioni(s.revisioni)+(s.veloce?1999:0),0);if(extras)add('Extra audio scelti · revisioni e/o prima versione entro 48 ore',extras,{tipo:'audio_extra',brani:[],saldo:0});

  while(use&&hours>=5){add('Blocco 5 ore di registrazione · entro 90 giorni, massimo 2 appuntamenti',ratesV10.fiveHours,{tipo:'credits',ore:5,quantita:1,saldo:0},5*ratesV10.recordingHour);hours-=5;}
  while(hours>0){const h=Math.min(8,hours),amount=h*ratesV10.recordingHour;add(`Registrazione · ${h} ore a 19,99 €/ora`,amount,{tipo:'recording',ore:h,saldo:amount-recordingDepositCents(amount)});hours-=h;}

  if(beats)add(`Beat GENKS su misura · ${beats} × 34,99 €`,beats*ratesV10.beat,{tipo:'custom',beat:beats,saldo:0});
  const halfHours=Number(input.mezzore_dopo_mezzanotte??0);if(!Number.isFinite(halfHours)||halfHours<0||halfHours>20||!Number.isInteger(halfHours*2))throw Error('Durata notturna non valida.');
  if(halfHours){const amount=halfHours*500;const target=righe.find(r=>['recording','credits','voice','turnkey','beat_voice'].includes(r.componente?.tipo??''));if(!target)throw Error('Il supplemento notturno richiede una sessione.');if(target.componente!.tipo==='recording'){const old=target.componente!.saldo??0;target.componente!.saldo=target.centesimi+amount-recordingDepositCents(target.centesimi+amount);balance+=target.componente!.saldo-old;}add('Supplemento notturno · +10,00 €/ora oltre la tariffa base',amount,{tipo:'night',saldo:0});}
  if(!righe.length)throw Error('Indica il servizio desiderato.');
  note.push('Una revisione inclusa per lavorazione e brano. Master 29,99 €. Registrazione 19,99 €/ora, 29,99 €/ora dopo mezzanotte nelle sessioni del venerdì e sabato.','Pacchetti: totale configurato subito. Solo studio: acconto fisso 20 €, oppure 10 € per una sessione da 19,99 €, senza superare il totale. Beat singolo: 34,99 € da pagare interamente prima dell’avvio. Solo EP/album richiedono una nuova prenotazione separata e pagamento per ore oltre quelle incluse; gli altri pacchetti mantengono le ore configurabili consentite.','Beat GENKS: split 50/50; collaborazioni da concordare per iscritto, 100% dei diritti su preventivo.');
  return result();
 }catch(e){righe.length=0;total=0;listino=0;balance=0;return result(e instanceof Error?e.message:'Preventivo non valido.');}
}
export function verificaPreventivo(code:string){const input=decodificaPreventivo(code);if(!input)return null;const q=calcolaPreventivo(input);return q.errore?null:q;}
