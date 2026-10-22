import { projectPrice, recordingHourlyCents } from "./service-rates.ts";
export const extraRates = { rush:3000, vocal:1500, versions:1999, revision:1500 } as const;
export const customBeat = {total:24999,deposit:12500,balance:12499,businessDays:10,revisions:2} as const;
export const packages = {
 single:{name:"Singolo completo",price:14999,separate:16498,songs:1,service:"mix_master",studio:false,description:"Mix + master fino a 8 tracce, versioni strumentale e a cappella, 1 revisione in più"},
 ep:{name:"EP Pack",price:44999,separate:51996,songs:4,service:"mix_master",studio:false,description:"Mix + master di 4 brani fino a 8 tracce ciascuno"},
 masters:{name:"Master Pack",price:9999,separate:11997,songs:3,service:"master",studio:false,description:"3 master stereo"},
 voice:{name:"Dalla voce al master",price:18999,separate:20496,songs:1,service:"mix_master",studio:true,description:"3 ore di registrazione + mix + master fino a 8 tracce"},
 hours:{name:"Blocco 5 ore di registrazione",price:10999,separate:12495,songs:0,service:"recording",studio:true,description:"5 ore di registrazione, da usare entro 90 giorni"},
 turnkey:{name:"Singolo chiavi in mano",price:39999,separate:45495,songs:1,service:"mix_master",studio:true,description:"Beat su misura + 3 ore di registrazione + mix + master fino a 8 tracce"},
} as const;
export type PackageCode=keyof typeof packages;
export function packageByCode(code:unknown){return typeof code==="string"&&Object.hasOwn(packages,code)?packages[code as PackageCode]:null;}
export function packageUpgrade(tracks:number){return !Number.isInteger(tracks)||tracks<1||tracks>48?null:tracks<=8?0:tracks<=24?6000:11000;}
export function guaranteeRefund(listPrice:number,packagePrice?:number,separate?:number){
 if(!Number.isSafeInteger(listPrice)||listPrice<0)throw new Error("invalid_refund");
 return Math.round(listPrice*(packagePrice??1)/(separate??1)/2);
}
// Consistency checks also run in tests: no invented reference prices.
export function separatePackagePrices(){return {single:projectPrice("mix_master",8)!+extraRates.versions+extraRates.revision,ep:4*projectPrice("mix_master",8)!,masters:3*projectPrice("master",1)!,voice:3*recordingHourlyCents+projectPrice("mix_master",8)!,hours:5*recordingHourlyCents,turnkey:customBeat.total+3*recordingHourlyCents+projectPrice("mix_master",8)!};}
