import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Await this before reading the library: layouts and pages can render in parallel.
// Only a server-verified, confirmed email may claim unassigned purchases.
export const claimGuestPurchases = cache(async () => {
  const user = await requireUser();
  if (!user.email || !user.email_confirmed_at) return user;
  const email = user.email.toLowerCase();
  const db = createSupabaseAdminClient();
  const results = await Promise.all([
    db.from("orders").update({ customer_id: user.id }).is("customer_id", null).eq("customer_email", email),
    db.from("entitlements").update({ customer_id: user.id }).is("customer_id", null).eq("customer_email", email),
    db.from("bookings").update({ customer_id: user.id }).is("customer_id", null).eq("email", email),
    db.from("service_projects").update({ customer_id: user.id }).is("customer_id", null).eq("email", email),
  ]);
  if (results.some(result => result.error)) throw new Error("Non è stato possibile aggiornare la raccolta. Riprova tra poco.");
  return user;
});
