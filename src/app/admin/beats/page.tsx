import { italianLabel } from "@/lib/italian";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AssetUploader, BeatCreateForm, type ExistingAsset } from "@/components/admin/asset-uploader";

type AdminBeat = { id: string; title: string; slug: string; bpm: number; musical_key: string; genre: string; status: string; featured: boolean; beat_assets: ExistingAsset[] };

export default async function BeatsAdmin() {
  const db = createSupabaseAdminClient();
  const { data } = await db.from("beats").select("id,title,slug,bpm,musical_key,genre,status,featured,updated_at,beat_assets(kind,filename)").order("updated_at", { ascending: false });
  const beats = (data ?? []) as AdminBeat[];
  return <>
    <header className="admin-heading"><span className="eyebrow">GESTIONE CATALOGO</span><h1>Beat</h1><p>Inserisci dettagli, impostazioni di pubblicazione e file in un unico percorso. Puoi sostituire singolarmente i file già caricati qui sotto.</p></header>
    <details className="admin-form-card beat-create-panel" open><summary>+ Crea un nuovo beat completo</summary><BeatCreateForm /></details>
    {beats.length ? <section className="asset-edit-list"><header><span className="eyebrow">MODIFICHE</span><h2>File dei beat già caricati</h2><p>Apri il beat da modificare. La sostituzione di un formato rimuove il file precedente dalla consegna.</p></header>{beats.map((beat) => <details className="admin-form-card" key={beat.id}><summary><span><strong>{beat.title}</strong><small>/{beat.slug} · {italianLabel(beat.status)}</small></span><span>MODIFICA FILE</span></summary><AssetUploader beatId={beat.id} existingAssets={beat.beat_assets ?? []} /></details>)}</section> : null}
    <div className="admin-table"><div className="admin-table-row head"><span>Beat</span><span>Dettagli</span><span>Stato</span></div>{beats.map((beat) => <div className="admin-table-row" key={beat.id}><span><strong>{beat.title}</strong><small>/{beat.slug}</small></span><span>{beat.bpm} BPM · {beat.musical_key} · {beat.genre}</span><span>{italianLabel(beat.status)}{beat.featured ? " · in evidenza" : ""}</span></div>)}</div>
  </>;
}
