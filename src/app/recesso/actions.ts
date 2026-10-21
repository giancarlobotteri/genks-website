"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { allowPublicRequest } from "@/lib/security/request-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { flushNotifications } from "@/lib/notifications";
export async function submitWithdrawal(form:FormData) {
 if (!await allowPublicRequest("service")) redirect("/recesso?error=limit");
 if(form.get("website"))redirect("/recesso?error=invalid");
 const parsed=z.object({name:z.string().trim().min(2).max(120),email:z.email().max(254),reference:z.string().trim().min(3).max(100),statement:z.string().trim().min(10).max(4000),confirm:z.literal("on")}).safeParse(Object.fromEntries(form));
 if(!parsed.success)redirect("/recesso?error=invalid");
 const {data,error}=await createSupabaseAdminClient().rpc("submit_withdrawal",{p_name:parsed.data.name,p_email:parsed.data.email,p_reference:parsed.data.reference,p_statement:parsed.data.statement});
 if(error||!data)redirect("/recesso?error=save");
 try{await flushNotifications({prefix:`withdrawal-${data}`});}catch{console.error("Withdrawal recorded; receipt delivery pending retry.");}
 redirect("/recesso?success=received");
}
