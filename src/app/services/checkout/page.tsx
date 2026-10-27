import {redirect} from 'next/navigation';
import {validateQuoteCode} from '@/lib/chatbot/checkout';
import {quotePreventivo} from '@/lib/chatbot/checkout';
import {PreventivoCheckout} from '@/components/services/preventivo-checkout';
import Link from 'next/link';
import {getPublicDiscounts} from "@/lib/public-discounts-server";
import {getContactContext} from '@/lib/customer-contact-server';
import {ServiceCartV8} from '@/components/services/service-cart-v8';
export const metadata={title:'Carrello e pagamento servizi',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{direct?:string;preventivo?:string}>}){const query=await searchParams;if(query.preventivo){let project=false;try{project=!!validateQuoteCode(query.preventivo).progetto;}catch{}if(project)redirect('/services/album?preventivo='+encodeURIComponent(query.preventivo));let quote;try{quote=quotePreventivo(query.preventivo);}catch{return <div className="portal-shell service-portal"><section className="premium-form"><h1>Preventivo non valido</h1><Link href="/services">Scegli un servizio →</Link></section></div>;}return <div className="portal-shell service-portal"><PreventivoCheckout code={query.preventivo} initial={quote} contact={await getContactContext()}/></div>;}return <div className="portal-shell service-portal"><ServiceCartV8 direct={query.direct==="1"} discounts={await getPublicDiscounts()} contact={await getContactContext()}/></div>;}
