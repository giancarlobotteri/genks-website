import {useEffect, useRef, useState} from 'react';
import type {DemoRequest, DemoRequestKind} from './types.ts';

type Draft = {kind:DemoRequestKind;summary:string;data:Record<string,string>;resolve:(value:DemoRequest)=>void;reject:(error:Error)=>void;id:string};
export const CHECKOUT_EVENT = 'genks:cinematic-checkout';
export function prepareCheckout(kind:DemoRequestKind, summary:string, data:Record<string,string>):Promise<DemoRequest> {
  return new Promise((resolve,reject)=>window.dispatchEvent(new CustomEvent<Draft>(CHECKOUT_EVENT,{detail:{kind,summary,data,resolve,reject,id:crypto.randomUUID()}})));
}
type Quote = {total:number;cardNow:number;cashNow:number;balance:number;parts:{title:string;lines:{name:string;amount:number}[]}[]};
const euro=(amount:number)=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(amount/100);
export function CommerceCheckout() {
  const [draft,setDraft]=useState<Draft>();
  const [quote,setQuote]=useState<Quote>();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [payment,setPayment]=useState<'card'|'cash'>('card');
  const dialog=useRef<HTMLDialogElement>(null);
  const form=useRef<HTMLFormElement>(null);
  const [early,setEarly]=useState(false);
  const cancel=()=>{if(busy)return;draft?.reject(new Error('Conferma annullata. Puoi modificare i dettagli.'));setDraft(undefined);setQuote(undefined);};
  useEffect(()=>{
    const open=(event:Event)=>{const next=(event as CustomEvent<Draft>).detail;setDraft(next);setQuote(undefined);setError('');setPayment('card');setEarly(false);};
    window.addEventListener(CHECKOUT_EVENT,open);
    return()=>window.removeEventListener(CHECKOUT_EVENT,open);
  },[]);
  useEffect(()=>{if(draft&&!dialog.current?.open)dialog.current?.showModal();if(!draft)dialog.current?.close();},[draft]);
  const details=()=>({...draft!.data,...Object.fromEntries(new FormData(form.current!).entries())}) as Record<string,string>;
  const review=async()=>{
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/cinematic/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:draft!.kind,data:details(),payment,earlyStart:early})});
      const result=await response.json().catch(()=>({error:'Collegamento temporaneamente non disponibile. Riprova tra poco.'}));
      if(!response.ok)throw Error(result.error || 'Preventivo non disponibile.');
      setQuote(result);
    }catch(e){setError(e instanceof Error?e.message:'Impossibile calcolare il totale.');}
    finally{setBusy(false);}
  };
  const submit=async()=>{
    if(!draft||!quote||!form.current?.reportValidity())return;
    const data=details();
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/cinematic/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        cinematic:{kind:draft.kind,data,payment},name:data.name,artistName:data.artist||'',email:data.email,phone:data.phone,
        accepted:'on',earlyStart:early,withdrawalAcknowledged:early,contactOwner:'',saveContact:false,requestId:draft.id,direct:true,
        expectedTotal:quote.total,website:'',
      })});
      const result=await response.json().catch(()=>({error:'Collegamento temporaneamente non disponibile. Nessun addebito confermato.'}));
      if(!response.ok||!result.url)throw Error(result.error||'Conferma non riuscita.');
      const target=new URL(result.url,location.origin);
      if(target.origin!==location.origin&&target.origin!=='https://checkout.stripe.com'&&target.origin!=='https://app.prodbygenks.com')throw Error('Destinazione di pagamento non valida.');
      location.assign(target.href);
    }catch(e){setError(e instanceof Error?e.message:'Conferma non riuscita.');setBusy(false);}
  };
  return <dialog ref={dialog} className="commerce-checkout" onCancel={event=>{event.preventDefault();cancel();}}>
    {draft&&<form ref={form} onSubmit={event=>{event.preventDefault();void (quote?submit():review());}}>
      <button type="button" onClick={cancel} disabled={busy}>Torna alla richiesta</button>
      <h2>Controlla il tuo ordine</h2><p>{draft.summary}</p>
      <input type="hidden" name="name" value={draft.data.name||''}/>
      <input type="hidden" name="email" value={draft.data.email||''}/>
      <label>Telefono<input name="phone" type="tel" required minLength={6} maxLength={40} defaultValue={draft.data.phone||''}/></label>
      {(draft.kind==='remote-project'||draft.data.bundleId==='pk-masters')&&<>
        <label>Link SwissTransfer<input name="fileUrl" type="url" required placeholder="https://www.swisstransfer.com/…" defaultValue={draft.data.fileUrl||''} onChange={()=>setQuote(undefined)}/></label>
        <label><input name="filesThirtyDays" type="checkbox" required onChange={()=>setQuote(undefined)}/>Il link scade tra 30 giorni.</label>
      </>}
      <fieldset><legend>Pagamento</legend>
        <label><input type="radio" checked={payment==='card'} onChange={()=>{setPayment('card');setQuote(undefined);}}/>Carta o Apple Pay</label>
        <label><input type="radio" checked={payment==='cash'} onChange={()=>{setPayment('cash');setQuote(undefined);}}/>Contanti in studio</label>
      </fieldset>
      {(draft.kind==='booking')&&payment==='cash'&&<p>L’orario viene riservato subito. Versa 20 € in contanti al tuo arrivo in studio.</p>}
      {draft.kind==='bundle'&&<p>Le ore incluse nei pacchetti si organizzano con GENKS. L’acconto si applica quando viene scelto un appuntamento.</p>}
      <label><input type="checkbox" required/>Ho letto le <a href="https://app.prodbygenks.com/legal/terms" target="_blank" rel="noreferrer">condizioni di vendita</a> e l’<a href="https://app.prodbygenks.com/legal/privacy" target="_blank" rel="noreferrer">informativa privacy</a>.</label>
      <label><input type="checkbox" checked={early} onChange={event=>{setEarly(event.target.checked);setQuote(undefined);}}/>Richiedo l’avvio entro 14 giorni e ho letto le condizioni sull’avvio anticipato e sul recesso.</label>
      {(draft.kind==='custom-beat'||['pk-beat-voice','pk-turnkey','pk-ep'].includes(draft.data.bundleId))&&<label><input type="checkbox" required/>Confermo lo split 50/50 per le produzioni GENKS. Per il 100% dei diritti richiederò un preventivo.</label>}
      {quote&&<section aria-label="Riepilogo prezzi">{quote.parts.flatMap(part=>part.lines).map((line,i)=><p key={i}>{line.name}<strong>{euro(line.amount)}</strong></p>)}<p>Totale<strong>{euro(quote.total)}</strong></p><p>{quote.cashNow ? 'Acconto in contanti all’arrivo' : 'Da versare ora'}<strong>{euro(quote.cardNow+quote.cashNow)}</strong></p><p>Saldo ancora da pagare<strong>{euro(quote.balance)}</strong></p></section>}
      {error&&<p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy?'Verifica in corso…':quote?(payment==='card'?'Procedi al pagamento':'Conferma ordine in contanti'):'Calcola il riepilogo'}</button>
    </form>}
  </dialog>;
}
