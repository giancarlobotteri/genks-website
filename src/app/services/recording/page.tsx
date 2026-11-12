import {getPublicDiscounts} from "@/lib/public-discounts-server";
import {RecordingJourney} from "@/components/services/recording-journey";
export const metadata={title:"Registrazione in studio GENKS"};
export default async function Page({searchParams}:{searchParams:Promise<{duration?:string;hours?:string;date?:string;start?:string}>}){const q=await searchParams;const h=Number(q.hours??q.duration??1);return <div className="portal-shell service-portal"><RecordingJourney discounts={await getPublicDiscounts()} initialDate={/^\d{4}-\d{2}-\d{2}$/.test(q.date??'')?(q.date??''):''} initialTime={/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(q.start??'')?(q.start??''):''} hours={Number.isFinite(h)&&h>=1&&h<=8&&h*2===Math.round(h*2)?h:1}/></div>;}
