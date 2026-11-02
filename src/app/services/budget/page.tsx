import type {Metadata} from 'next';
import Link from 'next/link';
import {HomeDiscovery} from '@/components/home/home-discovery';
import {getPublicDiscounts} from '@/lib/public-discounts-server';
export const metadata:Metadata={title:'Trova per budget | GENKS',alternates:{canonical:'/services/budget'}};
export default async function BudgetPage(){return <div className="portal-shell service-portal"><Link href="/">← Torna alla home</Link><h1>Trova il tuo servizio per budget</h1><HomeDiscovery discounts={await getPublicDiscounts()} view="budget"/></div>;}
