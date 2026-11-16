import Link from "next/link";
import Image from "next/image";
import { genksBiography, studioPortrait } from "@/data/home-content";
export const metadata = { title: "Chi sono" };
export default function AboutPage() { return <div className="portal-shell service-portal"><h1>Chi è GENKS</h1><section className="portal-panel" aria-label="Biografia e studio">{studioPortrait && <Image src={studioPortrait} alt="GENKS in studio" width={640} height={480}/>}<p>{genksBiography}</p></section><Link className="button button-primary" href="/services/project">Scegli il tuo mix</Link></div>; }
