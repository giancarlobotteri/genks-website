import type { Metadata } from "next";
import { BEATS_ENABLED } from "@/config/features";
import BeatHome from "@/components/home/beat-home";
import { ServiceHome } from "@/components/home/service-home";
export const metadata: Metadata = { alternates: { canonical: "/" } };
export default function Home() { return BEATS_ENABLED ? <BeatHome /> : <ServiceHome />; }
