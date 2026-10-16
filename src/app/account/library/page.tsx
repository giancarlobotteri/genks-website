import Link from "next/link";
import { italianLabel } from "@/lib/italian";
import { claimGuestPurchases } from "@/lib/claim-guest-purchases";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowedDownloadKinds } from "@/lib/commerce/download-access";
export default async function LibraryPage() {
  const user=await claimGuestPurchases();const db=createSupabaseAdminClient();
  const {data,error}=await db.from("entitlements").select("id,customer_id,beat_id,license_type_id,order_item_id,revoked_at,order_items(id,order_id,beat_id,license_type_id,beat_title_snapshot,license_name_snapshot,license_terms_snapshot,orders(id,customer_id,status,paid_at,refunded_at))").eq("customer_id",user.id).is("revoked_at",null).order("granted_at",{ascending:false});
  if(error)throw new Error("Impossibile leggere la raccolta. Riprova tra poco.");
  const cards=(data??[]).flatMap(grant=>{
    const item=Array.isArray(grant.order_items)?grant.order_items[0]:grant.order_items;
    const order=item?(Array.isArray(item.orders)?item.orders[0]:item.orders):null;
    const kinds=item&&order?allowedDownloadKinds(grant,item,order,user.id):[];
    return item&&kinds.length?[{grant,item,kinds}]:[];
  });
  return <section className="portal-panel"><div className="panel-heading"><h2>Raccolta</h2><span>{cards.length} licenze</span></div>{!cards.length?<div className="empty-state"><h3>Non ci sono ancora beat disponibili.</h3><p>I tuoi file compariranno dopo la conferma del pagamento.</p><Link className="button button-primary" href="/beats">Esplora i beat</Link></div>:<div className="library-grid">{cards.map(({grant,item,kinds})=><article className="library-card" key={grant.id}><span className="eyebrow">LICENZA ACQUISTATA</span><h3>{item.beat_title_snapshot}</h3><p>{italianLabel(item.license_name_snapshot)}</p><div className="library-downloads">{kinds.map(kind=><a key={kind} className="button button-secondary" href={`/api/downloads/${grant.id}?kind=${kind}`}>Scarica {kind==="stems"?"tracce separate":kind.toUpperCase()}</a>)}<a className="text-link" href={`/api/downloads/${grant.id}?document=license`}>Scarica il contratto acquistato</a></div></article>)}</div>}</section>;
}
