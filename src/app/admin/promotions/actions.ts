"use server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
export async function savePublicDiscount(form:FormData){
 const user=await requireAdmin();
 const parsed=z.object({target:z.string().max(100),kind:z.enum(["percent","fixed"]),amount:z.coerce.number().positive().max(10000),label:z.string().trim().min(1).max(80),active:z.enum(["true","false"])}).safeParse(Object.fromEntries(form));
 if(!parsed.success||parsed.data.kind==="percent"&&(!Number.isInteger(parsed.data.amount)||parsed.data.amount>99))redirect("/admin/promotions?notice=invalid");
 const data=parsed.data,db=createSupabaseAdminClient();
 const result=await db.rpc("set_public_discount",{p_target:data.target,p_kind:data.kind,p_amount:data.kind==="fixed"?Math.round(data.amount*100):data.amount,p_label:data.label,p_active:data.active==="true"});
 if(result.error)throw new Error("Sconto non salvato. Controlla i valori e riprova.");
 await db.from("admin_audit_log").insert({admin_id:user.id,action:"set_public_discount",entity_type:"pricing",entity_id:data.target,payload:data});
 revalidatePath("/","layout");redirect("/admin/promotions?notice=saved");
}
