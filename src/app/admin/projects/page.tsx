import {AdminFields,AdminOrderBreakdown} from "@/components/admin/admin-fields";
import {StudioPackageCredit} from "@/components/services/studio-package-credit";
import { ProjectSongs } from "@/components/services/project-songs";
import { operationsStart } from "@/lib/operations-start";
import { ProjectContract } from "@/components/admin/project-contract";
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
  await requireAdmin(); const start=await operationsStart();
  const q=await searchParams;const db=createSupabaseAdminClient();const status=states.some(([v])=>v===q.status)?q.status!:"";
  const counter=db.from("service_projects").select("id",{count:"exact",head:true}).gte("created_at",start).is("archived_at",null);if(status)counter.eq("status",status);
  const {count,error:countError}=await counter;if(countError)throw new Error("Impossibile caricare i progetti.");
  const page=Math.min(pageNumber(q.page),Math.max(1,Math.ceil((count??0)/5)));
  const request=db.from("service_projects").select("commerce_snapshot,songs,id,reference,artist_name,name,email,phone,track_title,service,status,desired_deadline,agreed_deadline,delivery_url,description,notes,reference_links,track_count,service_quotes(*),payments(amount_cents,refunded_cents,status,livemode,review_reason)").gte("created_at",start).is("archived_at",null).order("created_at",{ascending:false}).order("id");if(status)request.eq("status",status);
  const {data,error}=await request.range((page-1)*5,page*5-1);if(error)throw new Error("Impossibile caricare i progetti.");
  return <><header className="admin-heading"><span className="eyebrow">GENKS MIX & MASTER</span><h1>Mix & Master</h1><p>Richieste, file e consegne in un unico spazio. Apri un progetto per vedere i brani e gestire la lavorazione.</p><div className="admin-overview-strip"><span>Prima versione: 7 giorni lavorativi dall’avvio consentito</span><span>Una revisione inclusa</span><span>Incassi separati dalla lavorazione</span></div></header><OperationNotice code={q.notice}/><a className="button button-primary" href="/admin/payments">Gestisci anticipi, saldi e nuovi ordini</a>
    <nav className="admin-filter-tabs" aria-label="Filtra progetti"><Link href="/admin/projects">Tutti</Link>{states.map(([value,label])=><Link key={value} href={`/admin/projects?status=${value}`} aria-current={status===value?"page":undefined}>{label}</Link>)}</nav>
    <div className="admin-cards">{data?.map(x=><article key={x.id} className="admin-record"><div><span className="eyebrow">{x.reference} · {italianLabel(x.service)}</span><h2>{x.track_title}</h2><AdminFields fields={[{label:"Artista",value:x.artist_name||x.name},{label:"Email",value:<a href={`mailto:${x.email}`}>{x.email}</a>},{label:"Telefono",value:x.phone},{label:"Consegna concordata",value:x.agreed_deadline||"Da concordare"}]}/><span className="admin-status">{states.find(([value])=>value===x.status)?.[1]}</span><AdminOrderBreakdown snapshot={x.commerce_snapshot}/><details className="admin-record-notes"><summary>Note, richiesta originale e scadenze</summary><AdminFields fields={[{label:"Scadenza richiesta",value:x.desired_deadline||"Non indicata"},{label:"Tracce dichiarate",value:x.track_count}]}/><p className="admin-note">{x.description}</p>{x.notes!==x.description&&<p className="admin-note">{x.notes||"Nessuna nota aggiunta."}</p>}</details>
      {(x.reference_links??[]).filter((url:string)=>/^https?:\/\//i.test(url)).map((url:string)=><p key={url}><a href={url} target="_blank" rel="noopener noreferrer">Apri il riferimento</a></p>)}<PaymentStatus payments={x.payments??[]}/>
      {x.delivery_url&&<a href={x.delivery_url} target="_blank" rel="noopener noreferrer">Apri la consegna</a>}</div>
      <details className="admin-card-actions"><summary>Gestisci lavorazione, documenti e consegna</summary><form action={updateProjectStatus}><input name="id" type="hidden" value={x.id}/><label>Stato del progetto<select name="status" defaultValue={x.status}>{states.filter(([value])=>value!=="delivered"&&canChangeServiceStatus("project",x.status,value)||value===x.status).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button className="button button-secondary">Aggiorna stato</button></form>
      <StudioPackageCredit id={x.id} admin/><ProjectSongs songs={x.songs}/><ProjectContract id={x.id} studioOnly={x.service==="studio_package"}/>{!(x.commerce_snapshot as {version?:string})?.version&&<CashServiceForm id={x.id} type="project" status={x.status}/>}
      {!(x.commerce_snapshot as {version?:string})?.version&&["requested","quoted","awaiting_payment"].includes(x.status)&&<ServiceQuoteForm id={x.id} type="project" quotes={x.service_quotes??[]} action={requestProjectPayment}/>}
      {["review","delivered"].includes(x.status)&&<form action={deliverProject} className="premium-form"><input name="id" type="hidden" value={x.id}/><a className="button button-secondary" href="https://www.swisstransfer.com/it" target="_blank" rel="noopener noreferrer">Carica i file finali su SwissTransfer ↗</a><label>Collegamento privato ai file finali<input name="url" type="url" required defaultValue={x.delivery_url??""} placeholder="https://"/></label><p className="fine-print">Usa una cartella riservata al cliente. Il link sarà salvato nel suo progetto e comunicato via email.</p><button className="button button-primary">Registra e invia consegna</button></form>}</details>
    </article>)}</div>{!data?.length&&<div className="empty-state"><h3>Nessun progetto per questa selezione.</h3></div>}<AdminPagination page={page} total={count??0} path="/admin/projects" params={{status}}/>
  </>;
}
