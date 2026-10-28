export type HistoryMessage={role:'user'|'assistant';content:string};
/** Keep complete recent exchanges; the validated draft also travels separately. */
export function chatRequestHistory(messages:HistoryMessage[]):HistoryMessage[]{
 const usable=messages[0]?.role==='assistant'?messages.slice(1):messages;
 let history=usable.slice(-59);if(history[0]?.role==='assistant')history=history.slice(1);
 return history.map(m=>({...m,content:m.content.slice(0,1000)}));
}
