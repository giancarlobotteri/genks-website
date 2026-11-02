import type {PreventivoInput} from './pricing.ts';
type Reply={reply:string;draft?:PreventivoInput;review?:boolean;active?:boolean;clearDraft?:boolean};
/** Split independent questions, never the conjunction in "mix e master" or a song distribution. */
export function splitChatRequests(text:string):string[]{
 const parts=text.split(/(?<=[?])\s+(?=[A-ZÀ-Üa-zà-ü])|\s*;\s*(?=(?:inoltre\b|poi\b|come\b|quanto\b|posso\b|vorrei\b|voglio\b))|\s+e\s+(?=(?:come|posso|quanto|quali|quando|dove|vorrei|voglio)\b)|\s+inoltre[, :]\s*|\n\s*(?:\d+[.)]|[-•])\s*/i).map(p=>p.replace(/^(?:inoltre|e poi|poi)\s*[, :]?\s*/i,'').trim()).filter(Boolean);
 // Bound provider work; oversized lists remain one request for the model to enumerate.
 return parts.length>1&&parts.length<=4?parts:[text];
}
export function combineChatReplies(replies:Reply[]):Reply{
 const drafts=replies.filter(r=>r.draft);
 return {reply:replies.map((r,i)=>`**${i+1}.**\n\n${r.reply}`).join('\n\n---\n\n')+(drafts.length>1?'\n\nHai richiesto più offerte distinte: dimmi quale vuoi riprendere per prima. Nessun ordine è stato creato.':''),...(drafts.length===1?{draft:drafts[0].draft,review:drafts[0].review}:{}),clearDraft:drafts.length>1,active:replies.some(r=>r.active!==false)};
}
