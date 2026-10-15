import "server-only";
import { redirect } from "next/navigation";
import { hasSupabase } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getCurrentUser() {
  if (!hasSupabase) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if(error || !data.user) return null;
  // A profile can be cleared during an owner-authorized reset while the login remains valid.
  // Recreate only a blank customer profile, and never overwrite an existing role.
  const db=createSupabaseAdminClient();
  const {data:profile,error:profileError}=await db.from("profiles").select("id").eq("id",data.user.id).maybeSingle();
  if(profileError)throw new Error("Verifica dell’account temporaneamente non disponibile.");
  if(!profile){
    const {error:restoreError}=await db.from("profiles").upsert({id:data.user.id,role:"customer"},{onConflict:"id",ignoreDuplicates:true});
    if(restoreError)throw new Error("Non è stato possibile ripristinare il profilo cliente.");
  }
  return data.user;
}

export async function requireUser(next = "/account/library") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-access");
  const adminEmail = (process.env.GENKS_ADMIN_EMAIL || "prod.genks@gmail.com").trim().toLowerCase();
  if (user.email?.toLowerCase() !== adminEmail) redirect("/admin-access?denied=1");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (data?.role !== "admin") redirect("/admin-access?setup=1");
  return user;
}
