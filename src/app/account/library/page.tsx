import { AccountListPagination, accountPage, accountSort, type AccountListQuery } from "@/components/services/account-list-tools";
import { paginate } from "@/lib/pagination";
import Link from "next/link";
import { italianLabel } from "@/lib/italian";
import { claimGuestPurchases } from "@/lib/claim-guest-purchases";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowedDownloadKinds } from "@/lib/commerce/download-access";
export default async function LibraryPage({searchParams}:{searchParams:Promise<AccountListQuery>}) {
  const q=await searchParams;const sort=accountSort(q.sort);
  const user=await claimGuestPurchases();const db=createSupabaseAdminClient();
  const {data,error}=await db.from("entitlements").select("id,customer_id,beat_id,license_type_id,order_item_id,revoked_at,granted_at,order_items(unit_price_cents,id,order_id,beat_id,license_type_id,beat_title_snapshot,license_name_snapshot,license_terms_snapshot,orders(id,customer_id,status,paid_at,refunded_at))").eq("customer_id",user.id).is("revoked_at",null).order("granted_at",{ascending:false}).range(0,499);
  if(error)throw new Error("Impossibile leggere la raccolta. Riprova tra poco.");
  const all=[...(data??[])];
  if(data?.length===500)for(let offset=500;;offset+=500){const chunk=await db.from("entitlements").select("id,customer_id,beat_id,license_type_id,order_item_id,revoked_at,granted_at,order_items(unit_price_cents,id,order_id,beat_id,license_type_id,beat_title_snapshot,license_name_snapshot,license_terms_snapshot,orders(id,customer_id,status,paid_at,refunded_at))").eq("customer_id",user.id).is("revoked_at",null).order("granted_at",{ascending:false}).range(offset,offset+499);if(chunk.error)throw new Error("Impossibile leggere tutte le licenze.");all.push(...chunk.data??[]);if(!chunk.data||chunk.data.length<500)break;}
  const cards=all.flatMap(grant=>{
    const item=Array.isArray(grant.order_items)?grant.order_items[0]:grant.order_items;
    const order=item?(Array.isArray(item.orders)?item.orders[0]:item.orders):null;
    const kinds=item&&order?allowedDownloadKinds(grant,item,order,user.id):[];
    return item&&kinds.length?[{grant,item,kinds}]:[];
  });
  cards.sort((a,b)=>{const diff=sort.startsWith("price")?(a.item.unit_price_cents-b.item.unit_price_cents):a.grant.granted_at.localeCompare(b.grant.granted_at);return sort.endsWith("asc")?diff:-diff;});
  const list=paginate(cards,accountPage(q.page));
  return <section className="portal-panel"><div className="panel-heading"><h2>Raccolta</h2><span>{cards.length} licenze</span></div><form className="account-list-tools" action="/account/library"><label>Ordina la raccolta<select name="sort" defaultValue={sort}><option value="date_desc">Acquisti più recenti</option><option value="date_asc">Acquisti meno recenti</option><option value="price_asc">Prezzo crescente</option><option value="price_desc">Prezzo decrescente</option></select></label><button className="button button-primary">Ordina</button></form>{!cards.length?<div className="empty-state"><h3>Non ci sono ancora beat disponibili.</h3><p>I tuoi file compariranno dopo la conferma del pagamento.</p><Link className="button button-primary" href="/beats">Esplora i beat</Link></div>:<div className="library-grid">{list.items.map(({grant,item,kinds})=><article className="library-card" key={grant.id}><span className="eyebrow">LICENZA ACQUISTATA</span><h3>{item.beat_title_snapshot}</h3><p>{italianLabel(item.license_name_snapshot)}</p><div className="library-downloads">{kinds.map(kind=><a key={kind} className="button button-secondary" href={`/api/downloads/${grant.id}?kind=${kind}`}>Scarica {kind==="stems"?"tracce separate":kind.toUpperCase()}</a>)}<a className="text-link" href={`/api/downloads/${grant.id}?document=license`}>Scarica il contratto acquistato</a></div></article>)}</div>}<AccountListPagination page={list.page} total={list.total} path="/account/library" sort={sort} status=""/></section>;
}

