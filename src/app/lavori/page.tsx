import Link from "next/link";
import { HomeProof } from "@/components/home/home-proof";
export const metadata = { title: "Lavori" };
export default function WorksPage() { return <div className="portal-shell service-portal"><h1>Lavori</h1><HomeProof /><Link className="button button-primary" href="/services">Scegli il servizio</Link></div>; }
