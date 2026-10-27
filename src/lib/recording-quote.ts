import {durationLabel} from './studio-scheduler.ts';
import {recordingHourlyCents,serviceAmount} from "./service-rates.ts";
import {discountPrice,type PublicDiscount} from "./public-discounts.ts";
import {recordingSessionCents} from "./extra-time.ts";
export function buildRecordingQuote(date:string,time:string,hours:number,discounts:PublicDiscount[]=[]){
 if(!Number.isFinite(hours)||hours<.25||hours>8||hours*4!==Math.round(hours*4))throw new Error("invalid_duration");
 const hourly=discountPrice(recordingHourlyCents,["recording","services"],discounts);
 const base=Math.round(hours*hourly),total=recordingSessionCents(date,time,hours,hourly),night=Math.max(0,recordingSessionCents(date,time,hours,recordingHourlyCents)-Math.round(hours*recordingHourlyCents));
 if(!Number.isSafeInteger(total))throw new Error("invalid_recording_quote");
 const minimum=Math.max(0,total-base-night);
 return {hourly,base,night,minimum,total,lines:[{name:`Registrazione · ${durationLabel(hours)} × ${serviceAmount(hourly)}/ora`,quantity:1,unitAmount:base},...(night?[{name:"Supplemento dopo mezzanotte · 9,99 € ogni 30 minuti",quantity:1,unitAmount:night}]:[]),...(minimum?[{name:"Adeguamento al minimo di pagamento 0,50 €",quantity:1,unitAmount:minimum}]:[])]};
}
