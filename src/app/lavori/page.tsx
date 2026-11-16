import { audioComparisons } from "@/data/home-content";
import Link from "next/link";
import { HomeProof } from "@/components/home/home-proof";
export const metadata = { title: "Lavori" };
export default function WorksPage() { return <div className="portal-shell service-portal"><h1>Lavori</h1><HomeProof />{!audioComparisons.length && <p>Qui troverai esempi di lavorazione con ascolto prima e dopo.</p>}<Link className="button button-primary" href="/services">Scegli il servizio</Link></div>; }
