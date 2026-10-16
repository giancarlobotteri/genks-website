import { italianLabel } from "@/lib/italian";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { beatRepository, getLicenses } from "@/lib/repositories/beats";
import { formatPrice } from "@/lib/format";
import Link from "next/link";
import { canBuyLicense } from "@/lib/catalog-availability";
import { PlayButton } from "@/components/beats/play-button";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const beat = await beatRepository.getBySlug(slug);
  if (!beat) return { title: "Beat non trovato" };
  return { title: `${beat.title} — ${beat.bpm} BPM ${beat.key}`, description: beat.description || `${beat.title}: beat ${italianLabel(beat.genre)} GENKS, ${beat.bpm} BPM, ${beat.key}. Ascolta e confronta le licenze disponibili.`, robots: { index: Boolean(beat.readyLicenseIds?.length), follow: true }, alternates: { canonical: `/beats/${beat.slug}` }, openGraph: { title: `${beat.title} by GENKS`, description: beat.description, images: [beat.cover] }, twitter: { card: "summary_large_image", title: `${beat.title} by GENKS`, description: beat.description, images: [beat.cover] } };
}

export default async function BeatDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [beat, licenses] = await Promise.all([beatRepository.getBySlug(slug), getLicenses()]);
  if (!beat) notFound();
  return <div className="portal-shell"><Link className="text-link" href="/beats">← Tutti i beat</Link><div className="beat-detail"><div className="beat-detail-art"><Image src={beat.cover} alt={`Copertina di ${beat.title}`} fill sizes="(max-width: 800px) 90vw, 46vw" /></div><div><span className="eyebrow">GENKS BEAT</span><h1>{beat.title}</h1>{beat.description && <p className="muted">{beat.description}</p>}<div className="beat-detail-meta"><span>{beat.bpm} BPM</span><span>{beat.key}</span><span>{italianLabel(beat.genre)}</span><span>{italianLabel(beat.mood)}</span></div><div className="beat-detail-listen"><PlayButton beat={beat} queue={[beat]} /><span>{beat.previewUrl ? "Ascolta l’anteprima prima di scegliere." : "Anteprima in preparazione."}</span></div><h2>Licenze</h2><div className="data-list">{licenses.filter(license => beat.licenseIds.includes(license.id)).map(license => <article key={license.id}><div><strong>{license.name}</strong><small>{license.format}</small><small>{formatPrice(beat.licensePrices?.[license.id] ?? license.priceCents)}</small></div>{license.isExclusive || license.id === "exclusive" ? <Link href={`/services/exclusive?beat=${beat.id}`}>Richiedi l’esclusiva</Link> : canBuyLicense(beat, license) ? <Link href={`/checkout/${beat.id}/${license.id}`}>Acquista →</Link> : <span className="beat-preparing">In preparazione</span>}</article>)}</div><Link className="text-link" href="/guida#licenze">Confronta i formati e scopri come acquistare →</Link></div></div></div>;
}
