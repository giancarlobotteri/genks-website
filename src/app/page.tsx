import type { Metadata } from "next";
import { BEATS_ENABLED } from "@/config/features";
import BeatHome from "@/components/home/beat-home";
import { ServiceHome } from "@/components/home/service-home";
export const metadata: Metadata = { alternates: { canonical: "/" } };
export default async function Home({searchParams}:{searchParams:Promise<{discoveryPreview?:string}>}) { const q=await searchParams;return BEATS_ENABLED ? <BeatHome /> : <ServiceHome discoveryPreview={process.env.NODE_ENV==='development'&&q.discoveryPreview==='1'}/>; }
