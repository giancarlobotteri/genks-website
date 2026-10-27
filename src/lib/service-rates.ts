import {audioPriceV10,mixTiersV10} from './service-pricing-v10.ts';
export const serviceRateVersion="2026-10-27-recording-v10";
export const projectRateVersion="2026-10-27-project-v10";
export const recordingHourlyCents=1999;
export const projectRates={mix:2999,master:2999,mix_master:5998} as const;
export type ProjectService=keyof typeof projectRates;
export const projectTiers=mixTiersV10.map(t=>({min:t.min,max:t.max,mix:t.price,mix_master:t.price+2999}));
export function projectPrice(service:string,tracks:number):number|null{
 if(service==='master'&&tracks!==1)return null;
 if(!['mix','master','mix_master'].includes(service)||!Number.isInteger(tracks)||tracks<1||tracks>1000)return null;
 return audioPriceV10(service as ProjectService,tracks);
}
export const projectDelivery = "Prima versione entro 7 giorni lavorativi dal giorno successivo a pagamento, ricezione di tutti i file e avvio consentito del servizio. Sono escluse festività italiane e fine settimana. Una revisione inclusa per lavorazione e per brano.";
export const serviceAmount = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
