import type {OrderSelection,OrderPart} from './service-order-v8.ts';
import {projectPrice} from './service-rates.ts';
import {buildRecordingQuote} from './recording-quote.ts';
import {discountPrice,type PublicDiscount} from './public-discounts.ts';
import {customBeat} from './service-catalog.ts';
import {discountedStudioBundle} from './service-payment-policy.ts';
import {firstVersionEstimate} from './service-delivery.ts';
export function quoteStudioBundle(selection:OrderSelection,hours:number,early:boolean,now:Date,discounts:PublicDiscount[]):OrderPart{
 const turnkey=selection.packageCode==='turnkey',song=selection.songs[0];
 if(!song||selection.songs.length!==1)throw Error('Il pacchetto contiene un brano.');
 const audio=discountPrice(projectPrice('mix_master',song.trackCount)!,['mix_master','projects','services'],discounts);
 const recording=buildRecordingQuote(selection.date,selection.time,hours,discounts);
 const q=discountedStudioBundle(audio,recording.total-recording.night,turnkey?customBeat.total:0);
 const total=q.total+recording.night,studio=q.studio+recording.night;
 const lines=[{name:`${song.trackTitle} · mix + master · quota pacchetto`,amount:q.audio},{name:`Registrazione · ${hours} ore · quota pacchetto${recording.night?' con supplemento notturno':''}`,amount:studio},...(turnkey?[{name:'Beat GENKS su misura · quota pacchetto',amount:q.beat}]:[])].map(l=>({...l,payNow:l.amount}));
 return {selection,title:turnkey?'Singolo chiavi in mano':'Registrazione + mix/master',total,listTotal:q.separate+recording.night,saving:q.saving,deposit:total,dueNow:total,cardNow:selection.payment==='card'?total:0,cashNow:selection.payment==='cash'?total:0,balance:0,studioAmount:studio,customAmount:q.beat,hours,bookingAmount:studio,bookingDeposit:studio,guarantees:[{title:song.trackTitle,amount:Math.round(q.audio*.3)}],lines,firstVersion:firstVersionEstimate(now,false,early,turnkey?10:7)};
}
