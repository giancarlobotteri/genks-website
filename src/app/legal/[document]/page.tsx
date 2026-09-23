import { notFound } from "next/navigation";
import { legalDocuments } from "@/data/legal";
export function generateStaticParams() { return Object.keys(legalDocuments).map((document) => ({ document })); }
export default async function LegalPage({ params }: { params: Promise<{ document: string }> }) { const { document } = await params; const content = legalDocuments[document as keyof typeof legalDocuments]; if (!content) notFound(); return <div className="portal-shell narrow-shell legal-copy"><span className="eyebrow">LEGAL</span><h1>{content.title}</h1><p>{content.body}</p></div>; }
