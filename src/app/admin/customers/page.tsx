import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminPagination, pageNumber } from "@/components/admin/pagination";
import { paginate } from "@/lib/pagination";
export default async function Customers({searchParams}:{searchParams:Promise<{page?:string}>}) {
  await requireAdmin();
  const q=await searchParams; const db=createSupabaseAdminClient();
  const customers=new Map<string,{email:string;name:string;artist:string;phone:string;created:string}>();
  for(const table of ["orders","bookings","service_projects"] as const){
    for(let offset=0;;offset+=500){
      const fields=table==="orders"?"customer_email,customer_name,created_at":"email,name,artist_name,phone,created_at";
      const {data,error}=await db.from(table).select(fields).order("created_at").order("id").range(offset,offset+499);
      if(error)throw new Error("Impossibile caricare i clienti.");
      for(const raw of data??[]){const row=raw as unknown as Record<string,string|null>; const email=(row.customer_email??row.email??"").toLowerCase();if(!email)continue;const previous=customers.get(email);customers.set(email,{email,name:row.customer_name??row.name??previous?.name??"Cliente",artist:row.artist_name??previous?.artist??"",phone:row.phone??previous?.phone??"",created:previous?.created??row.created_at!});}
      if(!data||data.length<500)break;
    }
  }
  const list=paginate([...customers.values()].sort((a,b)=>a.name.localeCompare(b.name)),pageNumber(q.page));
  return <><header className="admin-heading"><span className="eyebrow">RUBRICA GENKS</span><h1>Clienti</h1><p>Contatti degli acquisti e delle richieste ricevute, anche senza account.</p></header><div className="admin-customer-list">{list.items.map(c=><article className="admin-form-card" key={c.email}><h2>{c.name}</h2><dl><div><dt>Nome d’arte</dt><dd>{c.artist||"Non indicato"}</dd></div><div><dt>Email</dt><dd><a href={`mailto:${c.email}`}>{c.email}</a></dd></div><div><dt>Telefono</dt><dd>{c.phone||"Non indicato"}</dd></div><div><dt>Primo contatto</dt><dd>{new Date(c.created).toLocaleDateString("it-IT",{timeZone:"Europe/Rome"})}</dd></div></dl></article>)}</div>{!list.total&&<div className="empty-state"><h3>Ancora nessun cliente.</h3><p>I contatti arriveranno con i nuovi ordini e le richieste.</p></div>}<AdminPagination page={list.page} total={list.total} path="/admin/customers"/></>;
}
