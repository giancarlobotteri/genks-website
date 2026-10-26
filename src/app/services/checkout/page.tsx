import {getPublicDiscounts} from "@/lib/public-discounts-server";
import {getContactContext} from '@/lib/customer-contact-server';
import {ServiceCartV8} from '@/components/services/service-cart-v8';
export const metadata={title:'Carrello e pagamento servizi',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{direct?:string}>}){const query=await searchParams;return <div className="portal-shell service-portal"><ServiceCartV8 direct={query.direct==="1"} discounts={await getPublicDiscounts()} contact={await getContactContext()}/></div>;}
