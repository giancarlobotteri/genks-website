import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AssetUploader, BeatCreateForm, type ExistingAsset } from "@/components/admin/asset-uploader";

type AdminBeat = { id: string; title: string; slug: string; bpm: number; musical_key: string; genre: string; status: string; featured: boolean; beat_assets: ExistingAsset[] };

export default async function BeatsAdmin() {
  const db = createSupabaseAdminClient();
  const { data } = await db.from("beats").select("id,title,slug,bpm,musical_key,genre,status,featured,updated_at,beat_assets(kind,filename)").order("updated_at", { ascending: false });
  const beats = (data ?? []) as AdminBeat[];
  return <>
    <header className="admin-heading"><span className="eyebrow">CATALOG CONTROL</span><h1>Beats</h1><p>Create details, publishing settings and every file in one workflow. Existing uploads can be replaced individually below.</p></header>
    <details className="admin-form-card beat-create-panel" open><summary>+ Create a complete new beat</summary><BeatCreateForm /></details>
    {beats.length ? <section className="asset-edit-list"><header><span className="eyebrow">CORRECTIONS</span><h2>Existing beat uploads</h2><p>Open only the beat you need to correct. Replacing a format removes the previous file from delivery.</p></header>{beats.map((beat) => <details className="admin-form-card" key={beat.id}><summary><span><strong>{beat.title}</strong><small>/{beat.slug} · {beat.status}</small></span><span>EDIT UPLOADS</span></summary><AssetUploader beatId={beat.id} existingAssets={beat.beat_assets ?? []} /></details>)}</section> : null}
    <div className="admin-table"><div className="admin-table-row head"><span>Beat</span><span>Details</span><span>Status</span></div>{beats.map((beat) => <div className="admin-table-row" key={beat.id}><span><strong>{beat.title}</strong><small>/{beat.slug}</small></span><span>{beat.bpm} BPM · {beat.musical_key} · {beat.genre}</span><span>{beat.status}{beat.featured ? " · featured" : ""}</span></div>)}</div>
  </>;
}
