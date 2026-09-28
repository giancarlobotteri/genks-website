"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { privatePreview } from "@/lib/preview-mode";

function safeNext(value: FormDataEntryValue | null, fallback: string) {
  const next = String(value || fallback);
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
}

function previewEmailAllowed(email: string) {
  return !privatePreview || email.toLowerCase() === (process.env.GENKS_ADMIN_EMAIL || "prod.genks@gmail.com").trim().toLowerCase();
}

export async function sendMagicLink(formData: FormData) {
  const email = z.email().parse(formData.get("email"));
  const next = safeNext(formData.get("next"), "/account/library");
  if (!previewEmailAllowed(email)) redirect("/admin-access?denied=1");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  redirect(error ? "/login?error=1" : "/login?sent=1");
}

export async function signInWithPassword(formData: FormData) {
  const credentials = z.object({
    email: z.email(),
    password: z.string().min(8),
  }).safeParse({ email: formData.get("email"), password: formData.get("password") });
  const next = safeNext(formData.get("next"), "/account/library");
  if (!credentials.success) redirect("/login?error=1");
  if (!previewEmailAllowed(credentials.data.email)) redirect("/admin-access?denied=1");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(credentials.data);
  redirect(error ? `/login?error=1&next=${encodeURIComponent(next)}` : next);
}

export async function signInAsAdmin(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const adminEmail = (process.env.GENKS_ADMIN_EMAIL || "prod.genks@gmail.com").trim().toLowerCase();
  if (email !== adminEmail || password.length < 8) redirect("/admin-access?error=1");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect("/admin-access?error=1");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/admin-access?setup=1");
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
