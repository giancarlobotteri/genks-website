import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBusinessSales } from "@/lib/admin-sales";
import { formatPrice } from "@/lib/format";
import { italianLabel } from "@/lib/italian";
import { paginate } from "@/lib/pagination";
import { AdminPagination, pageNumber } from "@/components/admin/pagination";

export const dynamic="force-dynamic";
export default async function AdminSearch({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}) {
  await requireAdmin();
  const params=await searchParams;const q=(params.q??"").trim().slice(0,100);
  const safe=q.replace(/[^a-zA-Z0-9@._ -]/g,"");
  const db=createSupabaseAdminClient();
  const rows:Array<{id:string;type:string;reference:string;customer:string;email:string;status:string;amount:number|null;detail:string}>=[];
  if(safe.length>=3){
    const [bookings,projects,orders,live,test]=await Promise.all([
      db.from("bookings").select("id,reference,name,email,status,starts_at,ends_at,price_cents,phone,notes").ilike("reference",`%${safe}%`).limit(25),
      db.from("service_projects").select("id,reference,name,email,status,price_cents,track_title,service,description").ilike("reference",`%${safe}%`).limit(25),
      db.from("orders").select("id,order_number,customer_name,customer_email,status,total_cents,created_at").ilike("order_number",`%${safe}%`).limit(25),
      getBusinessSales(true,true),getBusinessSales(false,true),
    ]);
    if(bookings.error||projects.error||orders.error)throw new Error("Ricerca temporaneamente non disponibile.");
    for(const b of bookings.data??[])rows.push({id:b.id,type:"Prenotazione studio",reference:b.reference,customer:b.name,email:b.email,status:italianLabel(b.status),amount:b.price_cents,detail:`${new Date(b.starts_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})} → ${new Date(b.ends_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})} · ${b.phone??""} · ${b.notes??""}`});
    for(const p of projects.data??[])rows.push({id:p.id,type:"Progetto",reference:p.reference,customer:p.name,email:p.email,status:italianLabel(p.status),amount:p.price_cents,detail:`${p.track_title} · ${italianLabel(p.service)} · ${p.description}`});
    for(const o of orders.data??[])rows.push({id:o.id,type:"Ordine",reference:o.order_number,customer:o.customer_name??"Cliente",email:o.customer_email,status:italianLabel(o.status),amount:o.total_cents,detail:new Date(o.created_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})});
    const needle=safe.toLowerCase();
    for(const s of [...live.sales,...test.sales].filter(s=>[s.id,s.providerId,s.reference].some(v=>v.toLowerCase().includes(needle))))rows.push({id:s.id,type:s.live?"Pagamento reale":"Pagamento sandbox",reference:s.reference,customer:s.customer,email:s.email,status:s.disputed?"Contestato":s.review?"Da verificare":s.refunded===s.amount?"Rimborsato":"Pagato",amount:s.amount,detail:`${s.providerId} · ${new Date(s.paidAt).toLocaleString("it-IT",{timeZone:"Europe/Rome"})} · Rimborsi ${formatPrice(s.refunded)} · Commissioni ${s.fee===null?"In aggiornamento":formatPrice(s.fee)} · ${s.items.join(" · ")}${s.review?` · ${s.review}`:""}`});
  }
  const list=paginate(rows,pageNumber(params.page));
  return <><header className="admin-heading"><span className="eyebrow">GENKS · RICERCA RISERVATA</span><h1>Trova una richiesta.</h1><p>Cerca un riferimento BKG, PRJ, numero d’ordine, ID pagamento Stripe pi_ o identificativo interno. La ricerca comprende anche l’archivio precedente all’avvio.</p></header>
    <form className="admin-inline-actions" action="/admin/search"><label>Numero prenotazione o pagamento<input name="q" defaultValue={q} minLength={3} maxLength={100} required placeholder="BKG-… / PRJ-… / pi_…"/></label><button className="button button-primary">Cerca</button></form>
    <div className="admin-cards">{list.items.map((r,i)=><article key={`${r.type}-${r.id}-${i}`}><div><span className="eyebrow">{r.type}</span><h2>{r.reference}</h2><span className="admin-status">{r.status}</span><p>{r.customer}</p><p>{r.email}</p><p>{r.amount===null?"Importo da concordare":formatPrice(r.amount)}</p><p style={{overflowWrap:"anywhere"}}>{r.detail}</p><small>ID: {r.id}</small></div></article>)}</div>
    {q&&safe.length>=3&&!rows.length&&<div className="empty-state">Nessun risultato. Controlla il riferimento e riprova.</div>}
    <AdminPagination path="/admin/search" page={list.page} total={list.total} params={{q}}/>
  </>;
}

