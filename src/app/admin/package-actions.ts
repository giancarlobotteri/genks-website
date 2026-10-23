"use server";
import {requireAdmin} from "@/lib/auth";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
export async function setPackageMinutes(form:FormData){await requireAdmin();const input=z.object({id:z.uuid(),minutes:z.coerce.number().int().min(0).max(300).multipleOf(15),expected:z.coerce.number().int().min(0).max(300)}).safeParse(Object.fromEntries(form));if(!input.success)redirect("/admin/projects?notice=package_error");const r=await createSupabaseAdminClient().rpc("set_package_minutes_v7",{p_id:input.data.id,p_minutes:input.data.minutes,p_expected:input.data.expected});revalidatePath("/admin/projects");revalidatePath("/account/projects");redirect(`/admin/projects?notice=${r.error?"package_error":"package_saved"}`);}
