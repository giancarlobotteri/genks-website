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
  const user = await requireUser("/admin");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (data?.role !== "admin") redirect("/");
  return user;
}
