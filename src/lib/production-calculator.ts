import {projectPackageV10,ratesV10} from './service-pricing-v10.ts';
export type ProductionSong={servizio:'none'|'mix'|'master'|'mix_master';produzione:'genks'|'external';tracce:number;artisti:number;revisioni_extra:number;consegna_veloce:boolean};
export type ProductionInput={format?:'ep'|'album';brani:ProductionSong[];registrazione:boolean;ore_extra:number};
export const productionRates={beat:3499,includedHours:2,extraHour:1999} as const;
type AudioInput={servizio:'mix'|'master'|'mix_master';file:number;artisti_correzione_voce:number;revisioni_extra:number;consegna_veloce:boolean};
type AudioQuote={righe:{descrizione:string;prezzo:string}[];importi_centesimi:{totale:number;listino:number};errore?:string};
export function calculateProduction(input:ProductionInput,quoteAudio:(songs:AudioInput[])=>AudioQuote){
 void quoteAudio;
 if(!input||!Array.isArray(input.brani)||!Number.isInteger(input.ore_extra)||input.ore_extra!==0||input.registrazione!==true)throw Error('EP e album includono due ore di registrazione per brano. Eventuali ore ulteriori richiedono una nuova prenotazione e il relativo pagamento, non si aggiungono al pacchetto.');
 for(const s of input.brani){if(!s||s.produzione!=='genks'||s.servizio!=='mix_master'||!Number.isInteger(s.artisti)||s.artisti<1||s.artisti>20||s.revisioni_extra!==0||s.consegna_veloce!==false)throw Error('EP e album includono produzione GENKS, mix, master e una revisione. Puoi modificare le tracce audio separate; le ore incluse restano fisse.');}
 const q=projectPackageV10(input.format??(input.brani.length>=8?'album':'ep'),input.brani.map(s=>({source:s.produzione,tracks:s.tracce})));
 const beats=input.brani.length,studio=input.ore_extra*ratesV10.recordingHour,custom=q.rows.reduce((sum,r)=>sum+r.base,0);
 const total=q.total+studio,listTotal=q.separate+studio,balance=0,hours=beats*2+input.ore_extra;
 const shares=q.rows.map(r=>r.mix+r.master);
 const lines=q.rows.flatMap((r,i)=>[{name:`Brano ${i+1} · produzione GENKS su misura · quota pacchetto scontata`,amount:r.base},{name:`Brano ${i+1} · mix · ${input.brani[i].tracce} tracce audio separate`,amount:r.mix},{name:`Brano ${i+1} · master stereo`,amount:r.master}]);
 lines.push({name:`Registrazione inclusa · 2 ore per brano · ${beats*2} ore totali`,amount:0});
 if(studio)lines.push({name:`Ore aggiuntive già previste nel progetto · ${input.ore_extra} × 19,99 €`,amount:studio});
 return {total,listTotal,balance,dueNow:total-balance,studio,custom,hours,beats,lines,shares,songTotals:q.rows.map(r=>r.total),audio:{righe:[],importi_centesimi:{totale:shares.reduce((a,b)=>a+b,0),listino:shares.reduce((a,b)=>a+b,0)}}};
}
