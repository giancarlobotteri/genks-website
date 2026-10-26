import {getPublicDiscounts} from "@/lib/public-discounts-server";
import {OrderBuilderV8} from "@/components/services/order-builder-v8";
export const metadata={title:"Beat su misura GENKS"};
export default async function Page(){return <div className="portal-shell service-portal"><OrderBuilderV8 discounts={await getPublicDiscounts()} kind="custom"/></div>;}
