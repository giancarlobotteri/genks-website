import Link from "next/link";
import styles from "./search.module.css";
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
  const rows:Array<{id:string;type:string;reference:string;customer:string;email:string;status:string;amount:number|null;fields:{label:string;value:string}[];notes?:string;target:string}>=[];
  if(safe.length>=3){
    const [bookings,projects,orders,live,test]=await Promise.all([
      db.from("bookings").select("id,reference,name,email,status,starts_at,ends_at,price_cents,phone,notes").ilike("reference",`%${safe}%`).limit(25),
      db.from("service_projects").select("id,reference,name,email,status,price_cents,track_title,service,description,commerce_snapshot").ilike("reference",`%${safe}%`).limit(25),
      db.from("orders").select("id,order_number,customer_name,customer_email,status,total_cents,created_at").ilike("order_number",`%${safe}%`).limit(25),
      getBusinessSales(true,true),getBusinessSales(false,true),
    ]);
    if(bookings.error||projects.error||orders.error)throw new Error("Ricerca temporaneamente non disponibile.");
    for(const b of bookings.data??[])rows.push({id:b.id,type:"Prenotazione studio",reference:b.reference,customer:b.name,email:b.email,status:italianLabel(b.status),amount:b.price_cents,fields:[{label:"Inizio",value:new Date(b.starts_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})},{label:"Fine",value:new Date(b.ends_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})},{label:"Telefono",value:b.phone||"Non indicato"}],notes:b.notes??undefined,target:"/admin/bookings"});
    for(const p of projects.data??[])rows.push({id:p.id,type:"Progetto",reference:p.reference,customer:p.name,email:p.email,status:italianLabel(p.status),amount:p.price_cents,fields:[{label:"Brano / ordine",value:p.track_title},{label:"Servizio",value:italianLabel(p.service)}],notes:p.description??undefined,target:p.commerce_snapshot?.version==="2026-10-26-commerce-v8"?"/admin/payments?code="+encodeURIComponent(p.reference):"/admin/projects"});
    for(const o of orders.data??[])rows.push({id:o.id,type:"Ordine",reference:o.order_number,customer:o.customer_name??"Cliente",email:o.customer_email,status:italianLabel(o.status),amount:o.total_cents,fields:[{label:"Creato il",value:new Date(o.created_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}],target:"/admin/orders"});
    const needle=safe.toLowerCase();
    for(const s of [...live.sales,...test.sales].filter(s=>[s.id,s.providerId,s.reference].some(v=>v.toLowerCase().includes(needle))))rows.push({id:s.id,type:s.live?"Pagamento reale":"Pagamento sandbox",reference:s.reference,customer:s.customer,email:s.email,status:s.disputed?"Contestato":s.review?"Da verificare":s.refunded===s.amount?"Rimborsato":"Pagato",amount:s.amount,fields:[{label:"Riferimento pagamento",value:s.providerId},{label:"Data incasso",value:new Date(s.paidAt).toLocaleString("it-IT",{timeZone:"Europe/Rome"})},{label:"Rimborsato",value:formatPrice(s.refunded)},{label:"Commissioni",value:s.fee===null?"In aggiornamento":formatPrice(s.fee)}],notes:[...s.items,...(s.review?[s.review]:[])].join("\n"),target:s.targetUrl});
  }
  const list=paginate(rows,pageNumber(params.page));
  return <div className={styles.page}><header className={styles.header}><span className="eyebrow">GENKS · RICERCA RISERVATA</span><h1>Trova una richiesta.</h1><p>Cerca un riferimento BKG, PRJ, numero d’ordine, ID pagamento Stripe pi_ o identificativo interno. La ricerca comprende anche l’archivio precedente all’avvio.</p></header>
    <form className={styles.search} action="/admin/search"><label>Numero prenotazione o pagamento<input name="q" defaultValue={q} minLength={3} maxLength={100} required placeholder="BKG-… / PRJ-… / pi_…"/></label><button className="button button-primary">Cerca</button></form>
    <div className={styles.results}>{list.items.map((r,i)=><article className={styles.card} key={`${r.type}-${r.id}-${i}`}><header><div><span className={styles.type}>{r.type}</span><h2>{r.reference}</h2><span className={styles.status}>{r.status}</span></div><strong className={styles.amount}>{r.amount===null?"Da concordare":formatPrice(r.amount)}</strong></header><section className={styles.contact}><div><span>Artista / cliente</span><strong>{r.customer}</strong></div><div><span>Email</span><a href={`mailto:${r.email}`}>{r.email}</a></div></section><dl className={styles.fields}>{r.fields.map((f,n)=><div key={n}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>{r.notes&&<details><summary>Dettagli del lavoro e note</summary><p>{r.notes}</p></details>}<footer><Link className="button button-secondary" href={r.target}>Apri la gestione →</Link><details><summary>Identificativo interno</summary><code>{r.id}</code></details></footer></article>)}</div>
    {q&&safe.length>=3&&!rows.length&&<div className="empty-state">Nessun risultato. Controlla il riferimento e riprova.</div>}
    <AdminPagination path="/admin/search" page={list.page} total={list.total} params={{q}}/>
  </div>;
}

