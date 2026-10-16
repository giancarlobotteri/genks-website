import { italianLabel } from "@/lib/italian";
import { notFound } from "next/navigation";
import { hasStripe, hasSupabase } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/commerce/checkout-form";
import { formatPrice } from "@/lib/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { offerReadiness } from "@/lib/commerce/sale-readiness";

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{beatId:string;licenseCode:string}>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { beatId, licenseCode } = await params; const query = await searchParams;
  if (!hasSupabase) return <div className="portal-shell narrow-shell"><h1>Il pagamento deve essere configurato.</h1><p className="muted">Collega Supabase e Stripe tramite le variabili documentate nel file README.</p></div>;
  const db = await createSupabaseServerClient();
  const { data } = await db.from("beat_license_prices").select("price_override_cents,beats!inner(title,status,preview_path),license_types!inner(code,name,price_cents,short_description,is_exclusive,active,contract_text,included_assets)").eq("beat_id",beatId).eq("license_types.code",licenseCode).eq("license_types.active",true).eq("active",true).single();
  if (!data) notFound(); const beat=Array.isArray(data.beats)?data.beats[0]:data.beats; const license=Array.isArray(data.license_types)?data.license_types[0]:data.license_types;
  if (!beat || !license || beat.status !== "published") notFound(); const price=data.price_override_cents??license.price_cents;
  const {data:assets,error}=await createSupabaseAdminClient().from("beat_assets").select("kind").eq("beat_id",beatId).eq("bucket","beat-assets");
  const readiness=offerReadiness({contract:license.contract_text,includedAssets:license.included_assets,availableKinds:error?[]:(assets??[]).map(a=>a.kind),hasPreview:Boolean(beat.preview_path)});
  return <div className="portal-shell narrow-shell"><span className="eyebrow">ACQUISTO SICURO</span><h1>{beat.title}</h1><div className="checkout-summary"><div><strong>{italianLabel(license.name)}</strong><p>{italianLabel(license.short_description)}</p></div><strong>{formatPrice(price)}</strong></div>{query.cancelled&&<p className="notice">Pagamento annullato. Se hai già ricevuto una conferma di addebito, controlla la tua raccolta prima di riprovare.</p>}{!readiness.ready&&<p className="notice">Questa licenza è in preparazione e non è ancora acquistabile.</p>}{license.contract_text&&<details className="admin-form-card"><summary>Leggi il contratto della licenza</summary><p className="license-contract-copy">{license.contract_text}</p></details>}<CheckoutForm beatId={beatId} licenseCode={licenseCode} disabled={!hasStripe||license.is_exclusive||!readiness.ready}/><p className="fine-print">Stripe gestisce in sicurezza carte e Apple Pay. I file si sbloccano dopo la verifica del pagamento.</p></div>;
}
