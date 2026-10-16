import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBusinessSales } from "@/lib/admin-sales";
import { businessSummary } from "@/lib/business-sales";
import { formatPrice } from "@/lib/format";
import { OperationalHealth } from "@/components/admin/operational-health";
import { OperationNotice } from "@/components/admin/operation-notice";
export default async function AdminDashboard({searchParams}:{searchParams:Promise<{notice?:string}>}) {
  const q=await searchParams;const db=createSupabaseAdminClient();
  const expired=await db.rpc("expire_booking_holds");if(expired.error)throw new Error("Impossibile aggiornare il calendario.");
  const [ledger,bookings,projects,exclusive]=await Promise.all([getBusinessSales(),db.from("bookings").select("id",{count:"exact",head:true}).eq("status","pending"),db.from("service_projects").select("id",{count:"exact",head:true}).not("status","in",'("delivered","cancelled")'),db.from("exclusive_requests").select("id",{count:"exact",head:true}).eq("status","requested")]);
  if(bookings.error||projects.error||exclusive.error)throw new Error("Impossibile caricare la panoramica.");
  const stats=businessSummary(ledger.sales,ledger.refunds,ledger.costs);
  return <><header className="admin-heading"><span className="eyebrow">IL TUO STUDIO, SOTTO CONTROLLO</span><h1>Panoramica</h1><p>Incassi reali, richieste e controlli operativi. I pagamenti di prova sono consultabili separatamente nella sezione Vendite.</p></header><OperationNotice code={q.notice}/><div className="metric-grid"><article><span>Incassi reali totali</span><strong>{formatPrice(stats.lifetime.gross)}</strong></article><article><span>Incassi di questo mese</span><strong>{formatPrice(stats.month.gross)}</strong></article><article><span>Pagamenti reali confermati</span><strong>{stats.lifetime.count}</strong></article><article><span>Sessioni da valutare</span><strong>{bookings.count??0}</strong></article><article><span>Progetti aperti</span><strong>{projects.count??0}</strong></article><article><span>Richieste di esclusiva</span><strong>{exclusive.count??0}</strong></article></div><OperationalHealth/><div className="admin-quick-links">{[["/admin/beats","Pubblica un beat","Copertina, anteprima e file della licenza."],["/admin/bookings","Organizza lo studio","Sessioni, preventivi e periodi non disponibili."],["/admin/projects","Segui i progetti","Preventivi, revisioni, scadenze e consegne."],["/admin/analytics","Controlla le vendite","Incassi, rimborsi, commissioni e costi."],["/admin/settings","Controlla i collegamenti","Pagamenti, email e calendario."]].map(([href,title,copy])=><Link key={href} href={href} className="admin-form-card"><span>↗</span><h2>{title}</h2><p>{copy}</p></Link>)}</div></>;
}
