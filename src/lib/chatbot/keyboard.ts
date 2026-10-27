/** Send with Enter, preserving newlines and input-method composition. */
export function shouldSendChatMessage(event: {key:string;shiftKey:boolean;isComposing?:boolean;keyCode?:number}):boolean {
 return event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229;
}
