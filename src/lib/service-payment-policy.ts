/** Only new quotes use this policy; saved orders keep their original agreement. */
export const paymentPolicyVersion='2026-10-27-fixed-studio-deposit';
export function recordingDepositCents(total:number){
 if(!Number.isSafeInteger(total)||total<0)throw Error('Importo sessione non valido.');
 return total===1999?1000:Math.min(2000,total);
}
export const studioBundleSavingCents=1000;
/** Allocate the actual bundle price across services without losing a cent. */
export function discountedStudioBundle(audio:number,studio:number,beat=0){
 const components=[audio,studio,beat];
 if(components.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('Componenti del pacchetto non validi.');
 const separate=components.reduce((a,b)=>a+b,0),total=separate-studioBundleSavingCents;
 if(total<50)throw Error('Totale pacchetto non valido.');
 const paid=components.map(n=>Math.floor(n*total/separate));
 const remainders=components.map((n,i)=>({i,remainder:n*total%separate})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
 let remaining=total-paid.reduce((a,b)=>a+b,0);
 for(const r of remainders){if(!remaining)break;paid[r.i]++;remaining--;}
 return {total,separate,saving:studioBundleSavingCents,audio:paid[0],studio:paid[1],beat:paid[2]};
}
