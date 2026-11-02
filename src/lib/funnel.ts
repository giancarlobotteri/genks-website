export const funnelServices=['mix','master','mix_master','recording','custom','production','beat_voice','masters','voice','hours','turnkey','cart'] as const;
export type FunnelService=typeof funnelServices[number];
export const funnelServiceLabels:Record<FunnelService,string>={mix:'Mix',master:'Master',mix_master:'Mix + master',recording:'Registrazione',custom:'Beat su misura',production:'EP / Album',beat_voice:'Beat & Voce',masters:'Master Pack',voice:'Registrazione + mix/master',hours:'Blocco 5 ore',turnkey:'Singolo chiavi in mano',cart:'Carrello / più servizi'};
export const funnelSteps=['service_selected','form_started','checkout_viewed','payment_started','payment_completed'] as const;
export const funnelLabels=['Servizio scelto','Compilazione iniziata','Riepilogo aperto','Pagamento carta avviato','Pagamento carta confermato'];
export const clientFunnelSteps=['service_selected','form_started','checkout_viewed','checkout_error'] as const;
export function funnelService(path:string,query=new URLSearchParams()):FunnelService|null{
 if(path==='/services/album')return 'production';
 if(path==='/services/recording')return 'recording';
 if(path==='/services/custom'||path==='/services/beat')return 'custom';
 if(path==='/services/checkout')return 'cart';
 if(path==='/services/project'){const s=query.get('package')??query.get('service')??'mix_master';return funnelServices.includes(s as FunnelService)?s as FunnelService:null;}
 return null;
}
export type FunnelRow={step:string;reached:number;abandoned:number};
export type FunnelReport={rows:FunnelRow[];sessions:number;active:number;cash:number;errors:number;devices:{device:string;sessions:number;paid:number}[];services:{service:FunnelService;sessions:number;paid:number}[]};
export function funnelPercent(n:number,total:number){return total?Math.round(n/total*1000)/10:0;}
