import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stripeTestMode } from "@/lib/preview-mode";
import { legalDocuments } from "@/data/legal";

export async function assertLiveCommerceReady() {
  if (stripeTestMode()) return;
  const { data, error } = await createSupabaseAdminClient().from("site_settings").select("value").eq("key", "launch").single();
  if (error || !data?.value?.legal_ready || !data.value.seller_ready || Object.values(legalDocuments).some(document=>document.body.includes("BOZZA DA COMPLETARE")))
    throw new Error("I pagamenti sono in preparazione. Contatta GENKS per informazioni.");
}
