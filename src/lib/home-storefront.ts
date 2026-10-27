import {productionSelection} from './production-order.ts';
import {packages,customBeat} from './service-catalog.ts';
import {quoteOrder,type OrderSelection} from './service-order-v8.ts';
import {discountPrice,type PublicDiscount} from './public-discounts.ts';
import {projectRates,recordingHourlyCents} from './service-rates.ts';
export type StoreCard={id:string;name:string;detail:string;price:number;separate:number;saving:number;href:string;group:'bundle'|'audio'|'studio'|'custom';unit?:string;tag:string};
export function homeStorefront(discounts:PublicDiscount[]=[]):StoreCard[]{
 const bundleCards=Object.entries(packages).filter(([code])=>code!=='ep').map(([code,p]):StoreCard=>{
  const selection:OrderSelection={kind:'package',packageCode:code,songs:Array.from({length:p.songs},(_,i)=>({trackTitle:'Brano '+(i+1),trackCount:p.service==='master'?1:8,artists:0,revisions:0,rush:false,fileUrl:''})),hours:code==='hours'?5:p.studio?1:0,extraHours:0,date:p.studio&&code!=='hours'?'2030-01-01':'',time:p.studio&&code!=='hours'?'19:30':'',payment:'card',notes:'',rights:code==='turnkey'?'split50':'own'};
  const q=quoteOrder([selection],true,new Date(),discounts).parts[0];
  return {id:code,name:p.name,detail:p.description,price:q.total,separate:q.listTotal,saving:q.saving,href:`/services/project?package=${code}`,group:'bundle',tag:code==='hours'?'ORE IN STUDIO':p.studio?'STUDIO + MUSICA':'PACCHETTO AUDIO'};
 });
 const project=productionSelection({brani:Array.from({length:4},()=>({servizio:"mix_master",produzione:"genks",tracce:8,artisti:1,revisioni_extra:0,consegna_veloce:false})),registrazione:true,ore_extra:0});
 const full=quoteOrder([project],true,new Date(),discounts).parts[0];
 bundleCards.push({id:"production",name:"EP / Album Pack · il più scelto",detail:"4 produzioni GENKS, mix, master e 2 ore di studio per brano. Una revisione inclusa. Cambia soltanto tracce audio separate e ore aggiuntive.",price:full.total,separate:full.listTotal,saving:full.saving,href:"/services/album",group:"bundle",tag:"CONFIGURA BRANO PER BRANO"});
 bundleCards.sort((a,b)=>a.price-b.price);
 const audio=(id:'mix'|'master'|'mix_master',name:string,detail:string):StoreCard=>{const price=discountPrice(projectRates[id],[id,'projects','services'],discounts);return {id,name,detail,price,separate:projectRates[id],saving:projectRates[id]-price,href:`/services/project?service=${id}`,group:'audio',tag:id==='master'?'MASTER STEREO':'FINO A 8 FILE AUDIO',unit:id==='master'?undefined:'da'};};
 const recording=discountPrice(recordingHourlyCents,['recording','services'],discounts);
 return [...bundleCards,audio('mix','Mix','Dai equilibrio a voce e base. Una revisione inclusa.'),audio('master','Master stereo','Il passaggio finale per il tuo mix. Una revisione inclusa.'),audio('mix_master','Mix + master','Dalle tracce al brano finito. Una revisione inclusa.'),{id:'recording',name:'Registrazione in studio',detail:'Ponte San Giovanni, Perugia. Scegli giorno, durata e orario.',price:recording,separate:recordingHourlyCents,saving:recordingHourlyCents-recording,href:'/services/recording',group:'studio',unit:'/ora',tag:'PRENOTA IL TUO ORARIO'},{id:'custom',name:'Beat su misura',detail:'Una produzione GENKS per te. 17,50 € di anticipo e 17,49 € di saldo. Split 50/50; una revisione inclusa.',price:customBeat.total,separate:customBeat.total,saving:0,href:'/services/custom',group:'custom',tag:'PRODUZIONE GENKS'}];
}
