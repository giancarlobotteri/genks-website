"use client";
import {useState,useTransition} from 'react';
import {removeBooking} from '@/app/admin/bookings/remove-action';
export function RemoveBooking({id,reference,restore=false}:{id:string;reference:string;restore?:boolean}){
 const [confirm,setConfirm]=useState(false);const [pending,startTransition]=useTransition();
 if(!confirm)return <button type="button" className="button button-secondary" onClick={()=>setConfirm(true)}>{restore?'Ripristina nella lista':'Elimina prenotazione'}</button>;
 return <form className="admin-delete-confirm" action={form=>startTransition(()=>removeBooking(form))}>
  <input type="hidden" name="id" value={id}/><input type="hidden" name="restore" value={restore?'1':'0'}/><input type="hidden" name="confirmed" value="on"/>
  <p>{restore?`Ripristinare ${reference} nella lista? Resterà annullata: l’orario non viene riservato di nuovo.`:`Eliminare ${reference}? La sessione viene annullata, l’orario liberato e la scheda spostata in “Eliminate”. Gli eventuali pagamenti restano registrati: nessun rimborso automatico.`}</p>
  <button type="submit" className="button button-secondary" disabled={pending}>{pending?'Salvataggio…':restore?'Conferma ripristino':'Sì, elimina prenotazione'}</button>
  <button type="button" className="button button-secondary" disabled={pending} onClick={()=>setConfirm(false)}>Annulla</button>
 </form>;
}
