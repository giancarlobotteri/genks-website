import {CheckoutContactFields} from "@/components/services/checkout-contact-fields";
import Link from "next/link";
import {redirect} from "next/navigation";
import {getContactContext} from "@/lib/customer-contact-server";
import {updateContact,removeContact} from "./actions";
export const dynamic="force-dynamic";
export const metadata={title:"I miei dati"};
export default async function ContactPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const context=await getContactContext();if(!context)redirect("/login?next=/account/details");
 if(context.available===false)return <section className="portal-panel"><h2>I miei dati</h2><p role="alert">I dati salvati sono temporaneamente non disponibili. Riprova tra poco.</p><Link href="/services">Vai ai servizi</Link></section>;
 const q=await searchParams;
 return <section className="portal-panel"><h2>I miei dati</h2><p>Salva i contatti che vuoi ritrovare nei prossimi acquisti. Sono visibili soltanto dopo l’accesso al tuo account.</p>
 {q.saved&&<p role="status" className="notice success">Dati salvati.</p>}{q.removed&&<p role="status" className="notice success">Dati rimossi dalla compilazione automatica. Ordini e prenotazioni restano disponibili.</p>}{q.error&&<p role="alert" className="notice error">Non è stato possibile aggiornare i dati. Riprova.</p>}
 <form key={JSON.stringify(context.saved)} action={updateContact} className="premium-form form-grid">
 <input type="hidden" name="saveContact" value="on"/>
 <CheckoutContactFields context={context} accountMode/>
 <button className="button button-primary" type="submit">Salva i miei dati</button></form>
 {context.saved&&<form action={removeContact}><input type="hidden" name="contactOwner" value={context.userId}/><p>La rimozione riguarda i contatti salvati per i prossimi acquisti. Non modifica i dati dei documenti e degli ordini precedenti.</p><button className="button button-secondary" type="submit">Rimuovi i dati salvati</button></form>}
 <p><Link href="/services">Torna ai servizi →</Link></p></section>;
}
