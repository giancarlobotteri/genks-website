import { operationsStart } from "@/lib/operations-start";
import { AccountListTools, AccountListPagination, accountSort, accountPage, type AccountListQuery } from "@/components/services/account-list-tools";
import { italianLabel } from "@/lib/italian";
import { claimGuestPurchases } from "@/lib/claim-guest-purchases";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<AccountListQuery> }) {
  const q=await searchParams; const sort=accountSort(q.sort); const states=["pending", "paid", "refunded", "cancelled", "failed"]; const status=states.includes(q.status??"")?q.status!:""; const start=await operationsStart();
  const user = await claimGuestPurchases(); const db = await createSupabaseServerClient();
  let query=db.from("orders").select("id,order_number,status,total_cents,created_at,order_items(beat_title_snapshot,license_name_snapshot)",{count:"exact"}).eq("customer_id",user.id).gte("created_at",start);
  if(status)query=query.eq("status",status);
  let countQuery=db.from("orders").select("id",{count:"exact",head:true}).eq("customer_id",user.id).gte("created_at",start);
  if(status)countQuery=countQuery.eq("status",status); const counter=await countQuery;
  if(counter.error)throw new Error("Impossibile leggere il numero di risultati.");
  const total=counter.count??0; const page=Math.min(accountPage(q.page),Math.max(1,Math.ceil(total/5)));
  const {data,error}=await query.order(sort.startsWith("price")?"total_cents":"created_at",{ascending:sort.endsWith("asc"),nullsFirst:false}).order("id").range((page-1)*5,page*5-1);

  if(error)throw new Error("Impossibile leggere gli ordini.");
  return <section className="portal-panel"><div className="panel-heading"><h2>Ordini</h2></div><AccountListTools path="/account/orders" sort={sort} status={status} states={states}/><div className="data-list">{data?.map((order) => <article key={order.id}><div><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleDateString("it-IT")} · {italianLabel(order.status)}</small></div><span>{formatPrice(order.total_cents)}</span></article>)}{!data?.length && <p className="muted">Non hai ancora ordini.</p>}</div><AccountListPagination page={page} total={total} path="/account/orders" sort={sort} status={status}/></section>;
}

