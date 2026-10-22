import Link from "next/link";
import { genksBiography } from "@/data/home-content";
export const metadata = { title: "Chi sono" };
export default function AboutPage() { return <div className="portal-shell service-portal"><h1>CHI È GENKS</h1><p>{genksBiography}</p><Link className="button button-primary" href="/services/project">Scegli il tuo mix</Link></div>; }
