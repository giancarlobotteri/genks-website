import { CashServiceForm } from "@/components/admin/cash-service-form";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { AdminPagination, pageNumber } from "@/components/admin/pagination";
import { OperationNotice } from "@/components/admin/operation-notice";
import { ServiceQuoteForm } from "@/components/admin/service-quote-form";
import { PaymentStatus } from "@/components/admin/payment-status";
import { italianLabel } from "@/lib/italian";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canChangeServiceStatus } from "@/lib/service-workflow";
import { requestProjectPayment, updateProjectStatus, deliverProject } from "../actions";
const states=[["requested","Nuova richiesta"],["quoted","Preventivo concordato"],["awaiting_payment","In attesa di pagamento"],["paid","Pagato"],["in_progress","Prenotato / in lavorazione"],["review","In revisione"],["delivered","Consegnato"],["cancelled","Annullato"]];
export default async function AdminProjects({searchParams}:{searchParams:Promise<{page?:string;status?:string;notice?:string}>}) {
  await requireAdmin();
  const q=await searchParams;const db=createSupabaseAdminClient();const status=states.some(([v])=>v===q.status)?q.status!:"";
  const counter=db.from("service_projects").select("id",{count:"exact",head:true});if(status)counter.eq("status",status);
  const {count,error:countError}=await counter;if(countError)throw new Error("Impossibile caricare i progetti.");
  const page=Math.min(pageNumber(q.page),Math.max(1,Math.ceil((count??0)/5)));
  const request=db.from("service_projects").select("id,reference,artist_name,name,email,phone,track_title,service,status,desired_deadline,agreed_deadline,delivery_url,description,notes,reference_links,track_count,service_quotes(*),payments(amount_cents,refunded_cents,status,livemode,review_reason)").order("created_at",{ascending:false}).order("id");if(status)request.eq("status",status);
  const {data,error}=await request.range((page-1)*5,page*5-1);if(error)throw new Error("Impossibile caricare i progetti.");
  return <><header className="admin-heading"><span className="eyebrow">GENKS MIX & MASTER</span><h1>Mix & Master</h1><p>Nuove prenotazioni automatiche: mix 100 €, master 40 €, bundle 120 € per brano. Ricevi l’avviso su Gmail. Organizza invio file, revisioni e consegna prima di iniziare; registra i contanti soltanto dopo averli ricevuti.</p></header><OperationNotice code={q.notice}/>
    <nav className="admin-filter-tabs" aria-label="Filtra progetti"><Link href="/admin/projects">Tutti</Link>{states.map(([value,label])=><Link key={value} href={`/admin/projects?status=${value}`} aria-current={status===value?"page":undefined}>{label}</Link>)}</nav>
    <div className="admin-cards">{data?.map(x=><article key={x.id}><div><span className="eyebrow">{x.reference} · {italianLabel(x.service)}</span><h2>{x.track_title}</h2><p>{x.artist_name||x.name} · {x.email}</p><span className="admin-status">{states.find(([value])=>value===x.status)?.[1]}</span><p>{x.description}</p><p>{x.track_count} tracce · {x.phone||"Telefono non indicato"}</p><p>Scadenza desiderata: {x.desired_deadline||"Non indicata"}<br/>Scadenza concordata: <strong>{x.agreed_deadline||"Da concordare"}</strong></p><p>{x.notes||"Nessuna nota aggiunta."}</p>
      {(x.reference_links??[]).filter((url:string)=>/^https?:\/\//i.test(url)).map((url:string)=><p key={url}><a href={url} target="_blank" rel="noopener noreferrer">Apri il riferimento</a></p>)}<PaymentStatus payments={x.payments??[]}/>
      {x.delivery_url&&<a href={x.delivery_url} target="_blank" rel="noopener noreferrer">Apri la consegna</a>}</div>
      <div className="admin-card-actions"><form action={updateProjectStatus}><input name="id" type="hidden" value={x.id}/><label>Stato del progetto<select name="status" defaultValue={x.status}>{states.filter(([value])=>value!=="delivered"&&canChangeServiceStatus("project",x.status,value)||value===x.status).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button className="button button-secondary">Aggiorna stato</button></form>
      <CashServiceForm id={x.id} type="project" status={x.status}/>
      {["requested","quoted","awaiting_payment"].includes(x.status)&&<ServiceQuoteForm id={x.id} type="project" quotes={x.service_quotes??[]} action={requestProjectPayment}/>}
      {["review","delivered"].includes(x.status)&&<form action={deliverProject} className="premium-form"><input name="id" type="hidden" value={x.id}/><label>Collegamento privato ai file finali<input name="url" type="url" required defaultValue={x.delivery_url??""} placeholder="https://"/></label><p className="fine-print">Usa una cartella riservata al cliente. Il link sarà salvato nel suo progetto e comunicato via email.</p><button className="button button-primary">Registra e invia consegna</button></form>}</div>
    </article>)}</div>{!data?.length&&<div className="empty-state"><h3>Nessun progetto per questa selezione.</h3></div>}<AdminPagination page={page} total={count??0} path="/admin/projects" params={{status}}/>
  </>;
}
