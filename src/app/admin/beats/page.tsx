import { requireAdmin } from "@/lib/auth";
import { AdminPagination, pageNumber } from "@/components/admin/pagination";
import { updateBeatDetails } from "../actions";
import { catalogGenres, catalogMoods, catalogKeys } from "@/data/catalog-options";
import { italianLabel } from "@/lib/italian";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AssetUploader, BeatCreateForm, type ExistingAsset } from "@/components/admin/asset-uploader";

type AdminBeat = { id: string; title: string; slug: string; bpm: number; musical_key: string; genre: string; mood:string; description:string; status: string; featured: boolean; beat_assets: ExistingAsset[] };

export default async function BeatsAdmin({ searchParams }: { searchParams: Promise<{page?:string}> }) {
  await requireAdmin();
  const query = await searchParams;
  const db = createSupabaseAdminClient();
  const { count } = await db.from("beats").select("id", {count:"exact",head:true});
  const page = Math.min(pageNumber(query.page), Math.max(1, Math.ceil((count ?? 0)/5)));
  const { data, error } = await db.from("beats").select("id,title,slug,bpm,musical_key,genre,mood,description,status,featured,updated_at,beat_assets(kind,filename)").order("updated_at", { ascending: false }).order("id").range((page-1)*5,page*5-1);
  if(error) throw new Error("Impossibile caricare i beat.");
  const beats = (data ?? []) as AdminBeat[];
  return <>
    <header className="admin-heading"><span className="eyebrow">GESTIONE CATALOGO</span><h1>Beat</h1><p>Inserisci dettagli, impostazioni di pubblicazione e file in un unico percorso. Puoi sostituire singolarmente i file già caricati qui sotto.</p></header>
    <details className="admin-form-card beat-create-panel" ><summary>+ Crea un nuovo beat completo</summary><BeatCreateForm /></details>
    {beats.length ? <section className="asset-edit-list"><header><span className="eyebrow">MODIFICHE</span><h2>Beat già caricati</h2><p>Apri il beat da modificare. La sostituzione di un formato rimuove il file precedente dalla consegna.</p></header>{beats.map((beat) => <details className="admin-form-card" key={beat.id}><summary><span><strong>{beat.title}</strong><small>{beat.bpm} BPM · {beat.musical_key} · {beat.genre} · {italianLabel(beat.status)}</small></span><span>DETTAGLI E FILE</span></summary><form action={updateBeatDetails} className="premium-form form-grid"><input name="id" type="hidden" value={beat.id}/><label>Titolo<input name="title" defaultValue={beat.title} required/></label><label>Indirizzo del beat<input name="slug" defaultValue={beat.slug} pattern="[a-z0-9-]+" required/></label><label>BPM<input name="bpm" type="number" min="30" max="300" defaultValue={beat.bpm} required/></label><label>Tonalità<select name="musicalKey" defaultValue={beat.musical_key}>{[...new Set([beat.musical_key,...catalogKeys])].map(key=><option key={key}>{key}</option>)}</select></label><label>Genere<select name="genre" defaultValue={beat.genre}>{[...new Set([beat.genre,...catalogGenres])].map(genre=><option key={genre}>{genre}</option>)}</select></label><label>Atmosfera<select name="mood" defaultValue={beat.mood}>{[...new Set([beat.mood,...catalogMoods])].map(mood=><option key={mood}>{mood}</option>)}</select></label><label>Stato<select name="status" defaultValue={beat.status}><option value="draft">Bozza</option><option value="published">Pubblicato</option><option value="archived">Archiviato</option><option value="exclusive_sold">Esclusiva venduta</option></select></label><label className="checkbox"><input type="checkbox" name="featured" defaultChecked={beat.featured}/>In evidenza</label><label className="full">Descrizione <small>facoltativa</small><textarea name="description" defaultValue={beat.description??""}/></label><button className="button button-primary full">Salva dettagli</button></form><AssetUploader beatId={beat.id} existingAssets={beat.beat_assets ?? []} /></details>)}</section> : null}
    <AdminPagination page={page} total={count ?? 0} path="/admin/beats" />
  </>;
}
