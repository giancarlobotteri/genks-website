import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stripeTestMode } from "@/lib/preview-mode";
import { legalDocuments } from "@/data/legal";

export async function assertLiveCommerceReady(scope: "all" | "services" = "all") {
  if (stripeTestMode()) return;
  const { data, error } = await createSupabaseAdminClient().from("site_settings").select("value").eq("key", "launch").single();
  const documents = scope === "services" ? [legalDocuments.privacy, legalDocuments.cookies, legalDocuments.terms, legalDocuments.refunds, legalDocuments.booking] : Object.values(legalDocuments);
  const legalReady = scope === "services" ? data?.value?.service_documents_ready : data?.value?.legal_ready;
  const sellerReady = scope === "services" ? data?.value?.service_seller_ready : data?.value?.seller_ready;
  if (error || legalReady !== true || sellerReady !== true || documents.some(document=>document.body.includes("BOZZA DA COMPLETARE")))
    throw new Error("I pagamenti sono in preparazione. Contatta GENKS per informazioni.");
}
