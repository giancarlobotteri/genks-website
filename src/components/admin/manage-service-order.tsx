"use client";
import {useState,useTransition} from 'react';
import {manageServiceOrder} from '@/app/admin/payments/manage-action';
export function ManageServiceOrder({id,reference,paid,restore=false}:{id:string;reference:string;paid:boolean;restore?:boolean}){
 const [confirm,setConfirm]=useState(false);const [pending,start]=useTransition();
 const label=restore?'Ripristina nella lista':paid?'Archivia ordine incassato':'Annulla ed elimina dalla lista';
 if(!confirm)return <button type="button" className="button button-secondary" onClick={()=>setConfirm(true)}>{label}</button>;
 return <form className="admin-delete-confirm" action={form=>start(()=>manageServiceOrder(form))}><input name="id" type="hidden" value={id}/><input name="mode" type="hidden" value={restore?'restore':'archive'}/><input name="confirmed" type="hidden" value="on"/><p>{restore?`Ripristinare ${reference} nella lista? Gli appuntamenti annullati non vengono prenotati di nuovo.`:paid?`Archiviare ${reference}? Incassi e appuntamenti confermati restano conservati. Nessun rimborso automatico.`:`Annullare ${reference}? I link di pagamento attivi vengono disabilitati, gli orari riservati liberati e l’ordine spostato in Archiviate.`}</p><button type="submit" disabled={pending} className="button button-secondary">{pending?'Salvataggio…':'Conferma'}</button><button type="button" disabled={pending} className="button button-secondary" onClick={()=>setConfirm(false)}>Indietro</button></form>;
}
