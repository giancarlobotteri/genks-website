import { notFound } from "next/navigation";
import { hasStripe, hasSupabase } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/commerce/checkout-form";
import { formatPrice } from "@/lib/format";

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{beatId:string;licenseCode:string}>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { beatId, licenseCode } = await params; const query = await searchParams;
  if (!hasSupabase) return <div className="portal-shell narrow-shell"><h1>Checkout setup required.</h1><p className="muted">Connect Supabase and Stripe using the variables documented in README.</p></div>;
  const db = await createSupabaseServerClient();
  const { data } = await db.from("beat_license_prices").select("price_override_cents,beats!inner(title,status),license_types!inner(code,name,price_cents,short_description,is_exclusive)").eq("beat_id",beatId).eq("license_types.code",licenseCode).eq("active",true).single();
  if (!data) notFound(); const beat=Array.isArray(data.beats)?data.beats[0]:data.beats; const license=Array.isArray(data.license_types)?data.license_types[0]:data.license_types;
  if (!beat || !license) notFound(); const price=data.price_override_cents??license.price_cents;
  return <div className="portal-shell narrow-shell"><span className="eyebrow">SECURE CHECKOUT</span><h1>{beat.title}</h1><div className="checkout-summary"><div><strong>{license.name}</strong><p>{license.short_description}</p></div><strong>{formatPrice(price)}</strong></div>{query.cancelled&&<p className="notice">Payment cancelled. Nothing was charged.</p>}<CheckoutForm beatId={beatId} licenseCode={licenseCode} disabled={!hasStripe||license.is_exclusive}/><p className="fine-print">Cards and Apple Pay are processed securely by Stripe. Files unlock only after a verified webhook confirms payment.</p></div>;
}
