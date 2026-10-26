import {legalDocuments} from "@/data/legal";
import Link from "next/link";
export const metadata={title:"Anticipi, appuntamenti e cancellazioni"};
export default function Page(){return <section className="portal-shell service-portal"><h1>Appuntamenti, anticipi e cancellazioni</h1><div className="premium-form" style={{whiteSpace:"pre-wrap",lineHeight:1.8}}>{legalDocuments.booking.body}</div><Link href="/services/recording" className="button button-primary">Prenota lo studio</Link><Link href="/legal/refunds">Garanzia e recesso</Link></section>;}
