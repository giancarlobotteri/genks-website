export type HistoryMessage={role:'user'|'assistant';content:string};
/** Keep the initial choices and the latest exchange within the existing 11-message limit. */
export function chatRequestHistory(messages:HistoryMessage[]):HistoryMessage[]{
 const usable=messages[0]?.role==='assistant'?messages.slice(1):messages;
 const history=usable.length<=11?usable:[...usable.slice(0,8),...usable.slice(-3)];
 return history.map(m=>({...m,content:m.content.slice(0,1000)}));
}
