import { italianLabel } from "@/lib/italian";
import { claimGuestPurchases } from "@/lib/claim-guest-purchases";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export default async function ProjectsPage() {
  const user=await claimGuestPurchases();const db=await createSupabaseServerClient();
  const {data,error}=await db.from("service_projects").select("id,reference,track_title,service,status,desired_deadline,agreed_deadline,delivery_url").eq("customer_id",user.id).order("created_at",{ascending:false});
  if(error)throw new Error("Impossibile leggere i progetti.");
  return <section className="portal-panel"><div className="panel-heading"><h2>Progetti</h2></div><div className="data-list">{data?.map(x=><article key={x.id}><div><strong>{x.track_title}</strong><small>{x.reference} · {italianLabel(x.service)}</small><small>Consegna concordata: {x.agreed_deadline||"Da concordare nel preventivo"}</small>{x.status==="delivered"&&x.delivery_url&&/^https:\/\//i.test(x.delivery_url)&&<a className="button button-secondary" href={x.delivery_url} target="_blank" rel="noopener noreferrer">Apri i file finali</a>}</div><span>{italianLabel(x.status)}</span></article>)}{!data?.length&&<p className="muted">Non hai ancora progetti di mix o master.</p>}</div></section>;
}
