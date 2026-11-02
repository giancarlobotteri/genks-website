import type {Metadata} from 'next';
import Link from 'next/link';
import {HomeDiscovery} from '@/components/home/home-discovery';
import {getPublicDiscounts} from '@/lib/public-discounts-server';
export const metadata:Metadata={title:'Consigli per te | GENKS',robots:{index:false,follow:false},alternates:{canonical:'/services/consigli'}};
export default async function SuggestionsPage(){return <div className="portal-shell service-portal"><Link href="/">← Torna alla home</Link><h1>Consigli per il tuo prossimo progetto</h1><HomeDiscovery discounts={await getPublicDiscounts()} view="suggestions"/></div>;}
