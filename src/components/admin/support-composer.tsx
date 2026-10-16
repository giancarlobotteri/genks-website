"use client";
import {useActionState} from "react";
import {sendSupportMessage} from "@/app/admin/support/actions";

export function SupportComposer({nonce}:{nonce:string}) {
  const [state,action,pending]=useActionState(sendSupportMessage,{});
  return <form action={action} className="premium-form" key={state.sent?state.nonce:undefined}>
    <input type="hidden" name="nonce" value={state.nonce??nonce}/>
    {state.error&&<p className="notice error" role="alert">{state.error}</p>}
    {state.sent&&<p className="notice success" role="status">Messaggio inviato. Lo trovi anche nella posta inviata su Resend.</p>}
    <label>Email del cliente<input type="email" name="to" autoComplete="off" maxLength={254} defaultValue={state.to??""} required/></label>
    <label>Oggetto<input name="subject" minLength={3} maxLength={180} defaultValue={state.subject??""} placeholder="Re: richiesta GENKS" required/></label>
    <label>Il tuo messaggio<textarea name="body" rows={9} minLength={5} maxLength={10000} defaultValue={state.body??""} required/></label>
    <button className="button button-primary" disabled={pending}>{pending?"Invio in corso…":"Invia da assistenza GENKS"}</button>
  </form>;
}
