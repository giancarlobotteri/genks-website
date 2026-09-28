import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { hasStripe, hasSupabase } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { privatePreview, previewRecipientAllowed, stripeTestMode } from "@/lib/preview-mode";

const schema = z.object({
  beatId: z.uuid().optional(),
  licenseCode: z.string().min(1).max(50).optional(),
  items: z.array(z.object({ beatId: z.uuid(), licenseCode: z.string().min(1).max(50) })).min(1).max(20).optional(),
  email: z.email(),
  name: z.string().trim().min(2).max(120),
  promoCode: z.string().trim().toUpperCase().max(40).optional(),
}).refine((value) => value.items?.length || (value.beatId && value.licenseCode), { message: "Choose at least one beat license." });

export async function POST(request: Request) {
  if (!hasSupabase || !hasStripe)
    return Response.json({ error: "Checkout is not configured yet." }, { status: 503 });
  if (privatePreview && !stripeTestMode())
    return Response.json({ error: "Only Stripe test payments are allowed in the private preview." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Check your purchase details." }, { status: 400 });
  if (!previewRecipientAllowed(parsed.data.email))
    return Response.json({ error: "Use the owner email for private test purchases." }, { status: 403 });

  const db = createSupabaseAdminClient();
  const requestedItems = parsed.data.items ?? [{ beatId: parsed.data.beatId!, licenseCode: parsed.data.licenseCode! }];
  if (new Set(requestedItems.map((item) => item.beatId)).size !== requestedItems.length)
    return Response.json({ error: "Each beat can only appear once per order." }, { status: 400 });
  const offers = await Promise.all(requestedItems.map(async (requested) => {
    const { data } = await db
      .from("beat_license_prices")
      .select("price_override_cents,beats!inner(id,title,slug,status,prevent_lease_after_exclusive),license_types!inner(id,code,name,price_cents,currency,contract_text,included_assets,is_exclusive,active)")
      .eq("beat_id", requested.beatId)
      .eq("license_types.code", requested.licenseCode)
      .eq("active", true)
      .single();
    if (!data) return null;
    const beat = Array.isArray(data.beats) ? data.beats[0] : data.beats;
    const license = Array.isArray(data.license_types) ? data.license_types[0] : data.license_types;
    if (!beat || !license || !license.active || beat.status !== "published" || license.is_exclusive) return null;
    return { beat, license, amount: data.price_override_cents ?? license.price_cents };
  }));
  if (offers.some((offer) => !offer)) return Response.json({ error: "One or more selected licenses are unavailable." }, { status: 409 });
  const validOffers = offers.filter((offer): offer is NonNullable<typeof offer> => Boolean(offer));
  const currency = validOffers[0].license.currency;
  if (validOffers.some((offer) => offer.license.currency !== currency))
    return Response.json({ error: "All cart items must use the same currency." }, { status: 409 });

  const user = await getCurrentUser();
  const amount = validOffers.reduce((sum, offer) => sum + offer.amount, 0);
  const { data: order, error } = await db
    .from("orders")
    .insert({ customer_id: user?.id ?? null, customer_email: parsed.data.email.toLowerCase(), customer_name: parsed.data.name, subtotal_cents: amount, total_cents: amount, currency })
    .select("id,order_number")
    .single();
  if (error || !order) return Response.json({ error: "Could not create the order." }, { status: 500 });
  const { error: itemError } = await db.from("order_items").insert(validOffers.map(({ beat, license, amount: unitPrice }) => ({
    order_id: order.id, beat_id: beat.id, license_type_id: license.id,
    beat_title_snapshot: beat.title, beat_slug_snapshot: beat.slug,
    license_name_snapshot: license.name,
    license_terms_snapshot: { contractText: license.contract_text, includedAssets: license.included_assets },
    unit_price_cents: unitPrice,
  })));
  if (itemError) return Response.json({ error: "Could not create the order items." }, { status: 500 });

  let finalAmount = amount;
  if (parsed.data.promoCode) {
    const { data: discounted, error: promoError } = await db.rpc("apply_promo_to_order", {
      p_order_id: order.id, p_code: parsed.data.promoCode,
    });
    if (promoError || !discounted?.[0]) {
      await db.from("orders").update({ status: "failed" }).eq("id", order.id);
      return Response.json({ error: "This promotion is invalid, expired or unavailable for these licenses." }, { status: 409 });
    }
    finalAmount = discounted[0].total_cents;
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const stripe = getStripe();
  let session;
  try {
  session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: parsed.data.promoCode ? [{ quantity: 1, price_data: { currency: currency.toLowerCase(), unit_amount: finalAmount, product_data: { name: `GENKS · ${validOffers.length} beat license${validOffers.length === 1 ? "" : "s"}`, description: `Promotion ${parsed.data.promoCode} applied` } } }] : validOffers.map(({ beat, license, amount: unitPrice }) => ({ quantity: 1, price_data: { currency: currency.toLowerCase(), unit_amount: unitPrice, product_data: { name: `${beat.title} — ${license.name}`, description: "GENKS beat license" } } })),
    success_url: `${origin}/checkout/success?order=${order.id}`,
    cancel_url: requestedItems.length === 1 ? `${origin}/checkout/${validOffers[0].beat.id}/${validOffers[0].license.code}?cancelled=1` : `${origin}/beats?checkout=cancelled`,
    metadata: { order_id: order.id, customer_id: user?.id ?? "guest", item_count: String(validOffers.length) },
    customer_email: parsed.data.email,
    // Stripe selects eligible methods configured on the account, including wallets
    // and bank transfer where the merchant and customer are supported.
  }, { idempotencyKey: `order_${order.id}` });
  } catch {
    await db.from("orders").update({ status: "failed" }).eq("id", order.id);
    return Response.json({ error: "Could not open Stripe Checkout. Please try again." }, { status: 502 });
  }
  await db.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
  return Response.json({ url: session.url });
}
