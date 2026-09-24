import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { hasStripe, hasSupabase } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { STRIPE_EU_BANK_TRANSFER_COUNTRY } from "@/lib/payments";

const schema = z.object({
  beatId: z.uuid(),
  licenseCode: z.string().min(1).max(50),
  email: z.email(),
  name: z.string().trim().min(2).max(120),
  paymentMethod: z.enum(["card", "bank_transfer"]).default("card"),
});

export async function POST(request: Request) {
  if (!hasSupabase || !hasStripe)
    return Response.json({ error: "Checkout is not configured yet." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Check your purchase details." }, { status: 400 });

  const db = createSupabaseAdminClient();
  const { data: offer } = await db
    .from("beat_license_prices")
    .select("price_override_cents,beats!inner(id,title,slug,status,prevent_lease_after_exclusive),license_types!inner(id,code,name,price_cents,currency,contract_text,included_assets,is_exclusive,active)")
    .eq("beat_id", parsed.data.beatId)
    .eq("license_types.code", parsed.data.licenseCode)
    .eq("active", true)
    .single();
  if (!offer) return Response.json({ error: "This license is unavailable." }, { status: 404 });
  const beat = Array.isArray(offer.beats) ? offer.beats[0] : offer.beats;
  const license = Array.isArray(offer.license_types) ? offer.license_types[0] : offer.license_types;
  if (!beat || !license || !license.active || beat.status !== "published" || license.is_exclusive)
    return Response.json({ error: "This license requires direct contact." }, { status: 409 });

  const user = await getCurrentUser();
  const amount = offer.price_override_cents ?? license.price_cents;
  const { data: order, error } = await db
    .from("orders")
    .insert({ customer_id: user?.id ?? null, customer_email: parsed.data.email.toLowerCase(), customer_name: parsed.data.name, subtotal_cents: amount, total_cents: amount, currency: license.currency })
    .select("id,order_number")
    .single();
  if (error || !order) return Response.json({ error: "Could not create the order." }, { status: 500 });
  const { data: item, error: itemError } = await db.from("order_items").insert({
    order_id: order.id, beat_id: beat.id, license_type_id: license.id,
    beat_title_snapshot: beat.title, beat_slug_snapshot: beat.slug,
    license_name_snapshot: license.name,
    license_terms_snapshot: { contractText: license.contract_text, includedAssets: license.included_assets },
    unit_price_cents: amount,
  }).select("id").single();
  if (itemError || !item) return Response.json({ error: "Could not create the order item." }, { status: 500 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const stripe = getStripe();
  const customer = parsed.data.paymentMethod === "bank_transfer"
    ? await stripe.customers.create({ name: parsed.data.name, email: parsed.data.email })
    : null;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: license.currency.toLowerCase(), unit_amount: amount, product_data: { name: `${beat.title} — ${license.name}`, description: "GENKS beat license" } } }],
    success_url: `${origin}/checkout/success?order=${order.id}`,
    cancel_url: `${origin}/checkout/${beat.id}/${license.code}?cancelled=1`,
    metadata: { order_id: order.id, order_item_id: item.id, customer_id: user?.id ?? "guest", payment_method: parsed.data.paymentMethod },
    ...(parsed.data.paymentMethod === "bank_transfer" ? {
      customer: customer?.id,
      payment_method_types: ["customer_balance" as const],
      payment_method_options: {
        customer_balance: {
          funding_type: "bank_transfer" as const,
          bank_transfer: {
            type: "eu_bank_transfer" as const,
            eu_bank_transfer: { country: STRIPE_EU_BANK_TRANSFER_COUNTRY },
          },
        },
      },
    } : {
      customer_email: parsed.data.email,
      payment_method_types: ["card" as const],
    }),
  }, { idempotencyKey: `order_${order.id}` });
  await db.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
  return Response.json({ url: session.url });
}
