import { notFound } from "next/navigation";
import { legalDocuments } from "@/data/legal";
import type { Metadata } from "next";
export async function generateMetadata({params}:{params:Promise<{document:string}>}):Promise<Metadata> { const {document}=await params;const content=legalDocuments[document as keyof typeof legalDocuments];return {title:content?.title??"Informazioni legali",robots:{index:Boolean(content&&!content.body.includes("BOZZA DA COMPLETARE")),follow:true}}; }
export function generateStaticParams() { return Object.keys(legalDocuments).map((document) => ({ document })); }
export default async function LegalPage({ params }: { params: Promise<{ document: string }> }) { const { document } = await params; const content = legalDocuments[document as keyof typeof legalDocuments]; if (!content) notFound(); return <div className="portal-shell narrow-shell legal-copy"><span className="eyebrow">INFORMAZIONI LEGALI</span><h1>{content.title}</h1>{["terms","refunds"].includes(document) && <p><a className="button button-secondary" href="/recesso">Recedere dal contratto qui</a></p>}<div style={{whiteSpace:"pre-wrap",lineHeight:1.8}}>{content.body}</div></div>; }
