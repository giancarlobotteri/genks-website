import Link from 'next/link';
import {ProductionProjectBuilder} from '@/components/services/production-project-builder';
import {getPublicDiscounts} from '@/lib/public-discounts-server';
import {validateQuoteCode} from '@/lib/chatbot/checkout';
export const metadata={title:'EP e Album Pack su misura'};
export default async function Page({searchParams}:{searchParams:Promise<{preventivo?:string}>}){
 const q=await searchParams;let initial;
 if(q.preventivo)try{initial=validateQuoteCode(q.preventivo).progetto;if(!initial)throw Error('invalid_project');}catch{return <div className="portal-shell service-portal"><h1>Preventivo non valido</h1><Link href="/services/album">Configura un nuovo progetto</Link></div>;}
 return <div className="portal-shell service-portal"><ProductionProjectBuilder initial={initial} discounts={await getPublicDiscounts()}/></div>;
}
