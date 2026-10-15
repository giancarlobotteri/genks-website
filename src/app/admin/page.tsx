import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSalesOrders } from "@/lib/admin-sales";
import { salesSummary } from "@/lib/sales";
import { formatPrice } from "@/lib/format";
export default async function AdminDashboard() {
  const db=createSupabaseAdminClient();
  const [orders,bookings,projects,exclusive]=await Promise.all([getSalesOrders(),db.from("bookings").select("id",{count:"exact",head:true}).eq("status","pending"),db.from("service_projects").select("id",{count:"exact",head:true}).not("status","in",'("delivered","cancelled")'),db.from("exclusive_requests").select("id",{count:"exact",head:true}).eq("status","requested")]);
  if(bookings.error||projects.error||exclusive.error)throw new Error("Impossibile caricare la panoramica.");
  const stats=salesSummary(orders);
  return <><header className="admin-heading"><span className="eyebrow">IL TUO STUDIO, SOTTO CONTROLLO</span><h1>Panoramica</h1><p>Nuove richieste, lavoro da organizzare e andamento del negozio. Tutti i dati arrivano dalle attività registrate sul sito.</p></header><div className="metric-grid"><article><span>Incassi beat totali</span><strong>{formatPrice(stats.lifetime)}</strong></article><article><span>Questo mese</span><strong>{formatPrice(stats.month)}</strong></article><article><span>Ordini pagati</span><strong>{stats.paid.length}</strong></article><article><span>Sessioni da valutare</span><strong>{bookings.count??0}</strong></article><article><span>Progetti aperti</span><strong>{projects.count??0}</strong></article><article><span>Richieste di esclusiva</span><strong>{exclusive.count??0}</strong></article></div><div className="admin-quick-links">{[["/admin/beats","Pubblica un beat","Copertina, anteprima e file della licenza."],["/admin/bookings","Organizza lo studio","Gestisci e conferma le nuove sessioni."],["/admin/projects","Segui i progetti","Richieste di mix e master, preventivi e scadenze."],["/admin/analytics","Controlla le vendite","Incassi, grafici e registro degli ordini."],["/admin/settings","Collega il calendario","Aggiungi l’agenda GENKS a Google Calendar."]].map(([href,title,copy])=><Link key={href} href={href} className="admin-form-card"><span>↗</span><h2>{title}</h2><p>{copy}</p></Link>)}</div></>;
}
