import { projectPrice, recordingHourlyCents } from "./service-rates.ts";
export const extraRates = { rush:1999, vocal:0, versions:0, revision:999 } as const;
export const customBeat = {total:9999,deposit:5000,balance:4999,businessDays:10,revisions:1} as const;
export const packages = {
 ep:{name:"EP Pack",price:27999,separate:31996,songs:4,service:"mix_master",studio:false,description:"Mix + master di 4 brani, fino a 8 file audio ciascuno; una revisione per brano"},
 masters:{name:"Master Pack",price:7999,separate:8997,songs:3,service:"master",studio:false,description:"3 master stereo, una revisione per brano"},
 voice:{name:"Registrazione + mix/master",price:10999,separate:11997,songs:1,service:"mix_master",studio:true,description:"Base fornita dal cliente, 2 ore di registrazione + mix/master fino a 8 file"},
 hours:{name:"Blocco 5 ore di registrazione",price:8999,separate:9995,songs:0,service:"recording",studio:true,description:"5 ore entro 90 giorni, massimo 2 appuntamenti"},
 turnkey:{name:"Singolo chiavi in mano",price:14999,separate:21996,songs:1,service:"mix_master",studio:true,description:"Beat su misura GENKS + 2 ore di registrazione + mix/master fino a 8 file"},
} as const;
export type PackageCode=keyof typeof packages;
export function packageByCode(code:unknown){return typeof code==="string"&&Object.hasOwn(packages,code)?packages[code as PackageCode]:null;}
export function packageUpgrade(tracks:number){return !Number.isInteger(tracks)||tracks<1||tracks>48?null:tracks<=8?0:tracks<=24?2500:7000;}
export function guaranteeRefund(listPrice:number,packagePrice?:number,separate?:number){
 if(!Number.isSafeInteger(listPrice)||listPrice<0||packagePrice!==undefined&&(!separate||separate<packagePrice))throw new Error("invalid_refund");
 return Math.round(listPrice*(packagePrice??1)/(separate??1)*.3);
}
export function revisionPrice(additional:number){if(!Number.isInteger(additional)||additional<1||additional>100)throw new Error("invalid_revision");return 999+(additional-1)*500;}
export function revisionTotal(count:number){if(!Number.isInteger(count)||count<0||count>100)throw new Error("invalid_revision");return count*999+250*count*(count-1);}
export function vocalPrice(artists:number){if(!Number.isInteger(artists)||artists<0||artists>20)throw new Error('invalid_artists');return 0;}
export function separatePackagePrices(){return {ep:4*projectPrice("mix_master",8)!,masters:3*projectPrice("master",1)!,voice:2*recordingHourlyCents+projectPrice("mix_master",8)!,hours:5*recordingHourlyCents,turnkey:customBeat.total+2*recordingHourlyCents+projectPrice("mix_master",8)!};}
export const sortedPackages=()=>Object.entries(packages).sort(([,a],[,b])=>(a.separate-a.price)-(b.separate-b.price));
