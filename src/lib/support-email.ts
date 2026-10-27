export function supportRecipientMatches(to:unknown,support:string){return Array.isArray(to)&&to.some(address=>typeof address==='string'&&(address.match(/<([^>]+)>/)?.[1]??address).trim().toLowerCase()===support.toLowerCase());}
export const supportField=(value:string)=>value.replace(/[\r\n\t]/g,' ').slice(0,300);
