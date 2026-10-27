import {homeStorefront} from '../home-storefront.ts';
import {mixTiersV10,ratesV10} from '../service-pricing-v10.ts';
import {serviceAmount} from '../service-rates.ts';
/** Same public calculator as the storefront; never a second price list. */
export function catalogAnswer(packagesOnly=false){
 const offers=homeStorefront().filter(o=>packagesOnly?o.group==='bundle':true);
 return ['**'+(packagesOnly?'Pacchetti GENKS':'Servizi e pacchetti GENKS')+'**',...offers.map(o=>`**${o.name}: ${o.unit==='da'?'da ':''}${serviceAmount(o.price)}${o.unit==='/ora'?'/ora':''}**${o.saving>0?` · risparmi ${serviceAmount(o.saving)}`:''}\n${o.detail}\n[Configura](${`https://www.prodbygenks.com${o.href}`})`),'I totali di partenza cambiano soltanto con le quantità e gli extra consentiti. Dimmi cosa ti serve: preparo un preventivo verificato, con link di acquisto.'].join('\n\n');
}
export function currentPricingKnowledge(){
 return ['LISTINO VERIFICATO DAL CONFIGURATORE:',...mixTiersV10.map(t=>`Mix ${t.min}–${t.max} tracce audio separate: ${serviceAmount(t.price)}; mix + master: ${serviceAmount(t.price+ratesV10.master)}.`),`Oltre 48: +${serviceAmount(ratesV10.extraTrack)} per traccia. Master ${serviceAmount(ratesV10.master)}, beat GENKS ${serviceAmount(ratesV10.beat)}, registrazione ${serviceAmount(ratesV10.recordingHour)}/ora.`,...homeStorefront().filter(o=>o.group==='bundle').map(o=>`${o.name}: da ${serviceAmount(o.price)}, risparmio ${serviceAmount(o.saving)}; ${o.detail}`)].join('\n');
}
