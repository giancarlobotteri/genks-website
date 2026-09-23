"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = z.email().parse(formData.get("email"));
  const next = String(formData.get("next") || "/account/library");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  redirect(error ? "/login?error=1" : "/login?sent=1");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
