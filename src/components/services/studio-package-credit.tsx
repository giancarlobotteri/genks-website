import {requireAdmin,getCurrentUser} from "@/lib/auth";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {setPackageMinutes} from "@/app/admin/package-actions";
export async function StudioPackageCredit({id,admin=false}:{id:string;admin?:boolean}){
 const db=createSupabaseAdminClient();if(admin)await requireAdmin();else{const user=await getCurrentUser();if(!user)return null;const owner=await db.from("service_projects").select("id").eq("id",id).eq("customer_id",user.id).maybeSingle();if(!owner.data)return null;}
 const result=await db.from("studio_package_credits").select("minutes_included,minutes_used,validity_days").eq("project_id",id).maybeSingle();if(result.error)throw new Error("Ore del pacchetto non disponibili");if(!result.data)return null;const c=result.data;
 return <section className="studio-credit"><h3>Ore di studio incluse</h3><strong>{(c.minutes_included-c.minutes_used)/60} ore residue su {c.minutes_included/60}</strong><p>Le sessioni incluse si organizzano con GENKS senza pagare nuovamente queste ore.{c.validity_days?` Da usare entro ${c.validity_days} giorni dal pagamento.`:""}</p>{admin&&<form action={setPackageMinutes}><input type="hidden" name="id" value={id}/><input type="hidden" name="expected" value={c.minutes_used}/><label>Minuti complessivi già utilizzati<input type="number" name="minutes" defaultValue={c.minutes_used} min="0" max={c.minutes_included} step="15" required/></label><button className="button button-secondary">Aggiorna utilizzo ore</button></form>}</section>;
}
