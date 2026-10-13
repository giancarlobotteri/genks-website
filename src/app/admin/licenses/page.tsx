import { italianLabel } from "@/lib/italian";
import { Pencil, Plus } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createLicense, updateLicense } from "../actions";
import { formatPrice } from "@/lib/format";

type LicenseRow = { id:string; code:string; name:string; price_cents:number; included_assets:string[]; active:boolean; is_exclusive:boolean; display_order:number; streams_limit:number|null; short_description:string; full_description:string; monetization_permissions:string|null; music_video_permissions:string|null; performances:string|null; radio:string|null; distribution_restrictions:string|null; content_id_policy:string|null; contract_text:string|null };

export default async function LicensesAdmin() {
  const db=createSupabaseAdminClient();
  const {data}=await db.from("license_types").select("id,code,name,price_cents,included_assets,active,is_exclusive,display_order,streams_limit,short_description,full_description,monetization_permissions,music_video_permissions,performances,radio,distribution_restrictions,content_id_policy,contract_text").order("display_order");
  const licenses=(data??[]) as LicenseRow[];
  return <><header className="admin-heading"><span className="eyebrow">CATALOGO LICENZE ATTIVE</span><h1>Licenze</h1><p>Crea o modifica le licenze. Le modifiche salvate si applicano subito al negozio, al carrello e ai prezzi di acquisto.</p></header>
    <details className="admin-form-card"><summary><Plus size={17}/> Nuova licenza</summary><LicenseForm action={createLicense} submitLabel="CREA LICENZA" /></details>
    <section className="license-admin-list">{licenses.map((license)=><details className="admin-form-card license-edit-card" key={license.id}><summary><span><Pencil size={16}/><span><strong>{italianLabel(license.name)}</strong><small>{license.code} · {license.active?"ATTIVO":"NASCOSTO"}</small></span></span><span>{license.is_exclusive?"Contatti":formatPrice(license.price_cents)}</span></summary><LicenseForm action={updateLicense} license={license} submitLabel="SALVA E AGGIORNA IL SITO" /></details>)}</section>
  </>;
}

function LicenseForm({action,license,submitLabel}:{action:(formData:FormData)=>Promise<void>;license?:LicenseRow;submitLabel:string}) {
  return <form action={action} className="premium-form form-grid license-admin-form">{license?<input type="hidden" name="id" value={license.id}/>:null}
    <label>Codice<input name="code" defaultValue={license?.code} required/></label><label>Nome<input name="name" defaultValue={italianLabel(license?.name)} required/></label>
    <label>Prezzo in EUR<input name="price" type="number" min="0" step="0.01" defaultValue={license?license.price_cents/100:undefined} required/></label><label>Ordine di visualizzazione<input name="displayOrder" type="number" min="0" defaultValue={license?.display_order??0} required/></label>
    <label>File inclusi<input name="assets" defaultValue={license?.included_assets?.join(",")??"mp3,wav"} placeholder="mp3,wav,stems"/></label><label>Limite di ascolti<input name="streamsLimit" type="number" min="0" defaultValue={license?.streams_limit??undefined}/></label>
    <label className="full">Descrizione breve<textarea name="shortDescription" defaultValue={italianLabel(license?.short_description)}/></label><label className="full">Descrizione completa<textarea name="fullDescription" defaultValue={license?.full_description}/></label>
    <label>Monetizzazione<input name="monetization" defaultValue={license?.monetization_permissions??""}/></label><label>Video musicali<input name="musicVideo" defaultValue={license?.music_video_permissions??""}/></label>
    <label>Esibizioni<input name="performances" defaultValue={license?.performances??""}/></label><label>Radio<input name="radio" defaultValue={license?.radio??""}/></label>
    <label>Distribuzione<input name="distribution" defaultValue={license?.distribution_restrictions??""}/></label><label>Content ID<input name="contentId" defaultValue={license?.content_id_policy??""}/></label>
    <label className="full">Testo del contratto<textarea name="contractText" rows={8} defaultValue={license?.contract_text??""}/></label>
    <label className="checkbox"><input name="active" type="checkbox" defaultChecked={license?.active??true}/> Attiva sul sito</label><label className="checkbox"><input name="exclusive" type="checkbox" defaultChecked={license?.is_exclusive}/> Esclusiva tramite contatto diretto</label>
    <button className="button button-primary full">{submitLabel}</button>
  </form>;
}
