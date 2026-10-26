import {fromRomeWallTime} from "./rome-time.ts";
function easter(year:number){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return new Date(Date.UTC(year,month-1,day));}
export function isItalianBusinessDay(date:Date){const day=date.toISOString().slice(5,10);const monday=easter(date.getUTCFullYear());monday.setUTCDate(monday.getUTCDate()+1);return ![0,6].includes(date.getUTCDay())&&!["01-01","01-06","04-25","05-01","06-02","08-15","11-01","12-08","12-25","12-26"].includes(day)&&date.toISOString().slice(0,10)!==monday.toISOString().slice(0,10);}
export function firstVersionEstimate(now:Date,rush:boolean,earlyStart:boolean,businessDays=7){
 const eligible=new Date(now.getTime()+(earlyStart?0:14*86400000));
 if(rush)return new Date(eligible.getTime()+48*3600000).toISOString();
 const day=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(eligible);
 const date=new Date(day+"T12:00:00Z");let count=0;while(count<businessDays){date.setUTCDate(date.getUTCDate()+1);if(isItalianBusinessDay(date))count++;}
 return fromRomeWallTime(date.toISOString().slice(0,10),"23:59").toISOString();
}
export const deliveryDateLabel=(iso:string)=>new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",dateStyle:"long",timeStyle:"short"}).format(new Date(iso));
