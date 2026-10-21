import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const operationsStart = cache(async () => {
  const { data, error } = await createSupabaseAdminClient().from("site_settings").select("value").eq("key", "operations_start").maybeSingle();
  if (error) throw new Error("Impossibile verificare il periodo di attività.");
  const value = data?.value as { started_at?: string } | undefined;
  return value?.started_at && Number.isFinite(Date.parse(value.started_at)) ? value.started_at : "1970-01-01T00:00:00.000Z";
});

