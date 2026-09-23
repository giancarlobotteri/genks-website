import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { beatRepository, getLicenses } from "@/lib/repositories/beats";
import { formatPrice } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const beat = await beatRepository.getBySlug(slug);
  if (!beat) return { title: "Beat not found" };
  return { title: `${beat.title} — ${beat.bpm} BPM ${beat.key}`, description: beat.description, openGraph: { title: `${beat.title} by GENKS`, description: beat.description, images: [beat.cover] }, twitter: { card: "summary_large_image", title: `${beat.title} by GENKS`, description: beat.description, images: [beat.cover] } };
}

export default async function BeatDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [beat, licenses] = await Promise.all([beatRepository.getBySlug(slug), getLicenses()]);
  if (!beat) notFound();
  return <div className="portal-shell"><div className="beat-detail"><div className="beat-detail-art"><Image src={beat.cover} alt={`${beat.title} cover`} fill sizes="(max-width: 800px) 90vw, 46vw" /></div><div><span className="eyebrow">GENKS BEAT</span><h1>{beat.title}</h1><p className="muted">{beat.description}</p><div className="beat-detail-meta"><span>{beat.bpm} BPM</span><span>{beat.key}</span><span>{beat.genre}</span><span>{beat.mood}</span></div><h2>Licenses</h2><div className="data-list">{licenses.filter((license) => beat.licenseIds.includes(license.id)).map((license) => <article key={license.id}><div><strong>{license.name}</strong><small>{license.format}</small></div>{license.id === "exclusive" ? <a href={`/services/exclusive?beat=${beat.id}`}>REQUEST</a> : <a href={beat.isDemo ? "/beats" : `/checkout/${beat.id}/${license.id}`}>{formatPrice(license.priceCents)}</a>}</article>)}</div></div></div></div>;
}
