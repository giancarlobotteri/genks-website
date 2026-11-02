/** Conservative guard, not a guarantee of anonymisation. No input is logged. */
export function containsPrivateChatData(text:string):boolean{
 return /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){8,}|https?:\/\/|\b(?:BKG|PRJ|ORD|CS|PI)[-_][a-z0-9_-]{4,}|\bIT\d{2}[A-Z0-9]{23}\b|\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b|\b(?:password|api[ _-]?key|codice fiscale|carta di credito|indirizzo di casa|mi chiamo|sono nato|abito in)\b|\b(?:il mio|mio)\s+(?:numero|telefono)\b/i.test(text);
}
export function safeModelHistory(messages:{role:'user'|'assistant';content:string}[]){
 return messages.map(m=>({...m,content:containsPrivateChatData(m.content)?'[Contenuto personale o collegamento omesso]':m.content}));
}
const enums=new Set(['mix','master','mix_master','genks','external','ep','album','card','cash','recording','production','custom']);
/** Provider receives only quantities, booleans and known service enums, never free-text draft fields. */
export function minimalModelDraft(value:unknown):unknown{
 if(typeof value==='number')return Number.isFinite(value)?value:undefined;
 if(typeof value==='boolean')return value;
 if(typeof value==='string')return enums.has(value)?value:undefined;
 if(Array.isArray(value))return value.map(minimalModelDraft).filter(v=>v!==undefined);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).flatMap(([k,v])=>{const safe=minimalModelDraft(v);return safe===undefined?[]:[[k,safe]];}));
 return undefined;
}
export const CHAT_SESSION_MS=30*60*1000;
