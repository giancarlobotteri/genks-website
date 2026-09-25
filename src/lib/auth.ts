import "server-only";
import { redirect } from "next/navigation";
import { hasSupabase } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  if (!hasSupabase) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
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
