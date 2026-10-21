import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export const metadata={title:"Recessi e rimborsi"};
export default async function WithdrawalsPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
 await requireAdmin();
 const q=await searchParams; const page=Math.min(100000,Math.max(1,Number.parseInt(q.page??"1",10)||1));
 const {data,error,count}=await createSupabaseAdminClient().from("withdrawal_requests").select("id,name,email,reference,statement,received_at,status",{count:"exact"}).order("received_at",{ascending:false}).range((page-1)*5,page*5-1);
 if(error)throw new Error("Impossibile leggere le dichiarazioni.");
 return <><header className="admin-heading"><h1>Recessi e rimborsi</h1><p>La data di ricezione vale per la comunicazione: l’esercizio del diritto non richiede approvazione. Verifica contratto e prestazioni svolte prima di determinare l’importo. Il rimborso di un pagamento con carta si esegue sul pagamento originale in Stripe; questa schermata non trasferisce denaro.</p></header>{!data?.length&&<p>Nessuna dichiarazione ricevuta.</p>}{data?.map(x=><section key={x.id} className="admin-form-card"><h2>{x.reference}</h2><p>{x.name} · <a href={`mailto:${x.email}`}>{x.email}</a></p><p>{new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",dateStyle:"long",timeStyle:"short"}).format(new Date(x.received_at))} · {x.status}</p><p style={{whiteSpace:"pre-wrap"}}>{x.statement}</p></section>)}<p>Pagina {page} · {count??0} dichiarazioni</p><nav>{page>1&&<a href={`?page=${page-1}`}>Precedenti</a>} {page*5<(count??0)&&<a href={`?page=${page+1}`}>Successive</a>}</nav></>;
}
