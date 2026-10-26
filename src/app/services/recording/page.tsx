import {getPublicDiscounts} from "@/lib/public-discounts-server";
import {OrderBuilderV8} from "@/components/services/order-builder-v8";
export const metadata={title:"Registrazione in studio GENKS"};
export default async function Page({searchParams}:{searchParams:Promise<{duration?:string}>}){const q=await searchParams;const h=Number(q.duration??1);return <div className="portal-shell service-portal"><OrderBuilderV8 discounts={await getPublicDiscounts()} kind="recording" hours={Number.isFinite(h)&&h>=.25&&h<=8&&h*4===Math.round(h*4)?h:1}/></div>;}
