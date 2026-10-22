import { getPublicDiscounts } from "@/lib/public-discounts-server";
import { discountPrice } from "@/lib/public-discounts";
import { italianLabel } from "@/lib/italian";
import "server-only";
import { cache } from "react";
import { mockBeats } from "@/data/mock/beats";
import { mockLicenses } from "@/data/mock/licenses";
import { hasSupabase } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { offerReadiness } from "@/lib/commerce/sale-readiness";
import type { Beat, License } from "@/types/domain";

export interface BeatRepository {
  listPublished(): Promise<Beat[]>;
  getBySlug(slug: string): Promise<Beat | null>;
}

export const beatRepository: BeatRepository = {
  listPublished: cache(async () => {
    if (hasSupabase) {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("beats")
        .select("id,slug,title,bpm,musical_key,genre,mood,description,featured,status,cover_path,preview_path,beat_license_prices(active,price_override_cents,license_types(code,price_cents,active,contract_text,included_assets,is_exclusive))")
        .eq("status", "published")
        .order("sort_order")
        .order("published_at", { ascending: false });
      if (data) return prepareCatalog(data);
      throw new Error("Il catalogo non è disponibile. Riprova tra poco.");
    }
    return mockBeats.filter((beat) => beat.status === "published");
  }),
  getBySlug: cache(async (slug: string) => {
    if (hasSupabase) {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("beats")
        .select("id,slug,title,bpm,musical_key,genre,mood,description,featured,status,cover_path,preview_path,beat_license_prices(active,price_override_cents,license_types(code,price_cents,active,contract_text,included_assets,is_exclusive))")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      return data ? (await prepareCatalog([data]))[0] : null;
    }
    return (
      mockBeats.find(
        (beat) => beat.slug === slug && beat.status === "published",
      ) ?? null
    );
  }),
};

export const getLicenses = cache(async (): Promise<License[]> => {
  if (hasSupabase) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("license_types")
      .select("code,name,price_cents,currency,included_assets,short_description,is_exclusive,contract_text")
      .eq("active", true)
      .order("display_order");
    if (data) { const discounts=await getPublicDiscounts();
      return data.map((item) => ({
        id: item.code as License["id"],
        isExclusive: item.is_exclusive,
        contractText: item.contract_text || undefined,
        name: italianLabel(item.name),
        priceCents: discountPrice(item.price_cents,[`license:${item.code}`,"beats"],discounts),
        currency: "EUR",
        format: (item.included_assets ?? []).map((asset: string) => italianLabel(asset).toUpperCase()).join(" + "),
        features: [italianLabel(item.short_description), ...(item.included_assets ?? []).map((asset: string) => asset === "stems" ? "Tracce separate incluse" : `${italianLabel(asset).toUpperCase()} incluso`)].filter(Boolean),
        isDemo: false,
      })); }
    throw new Error("Le licenze non sono disponibili. Riprova tra poco.");
  }
  return mockLicenses.map(license => ({ ...license, name: italianLabel(license.name), features: license.features.map(italianLabel), format: license.format.replace("STEMS", "TRACCE SEPARATE") }));
});

type DbBeat = Record<string, unknown>;
async function prepareCatalog(rows: DbBeat[]): Promise<Beat[]> {
  const kinds = new Map<string, string[]>();
  // Read only coarse availability on the server; never send private asset paths.
  // Chunk both IDs and result rows, so larger catalogues do not lose metadata.
  if (process.env.SUPABASE_SECRET_KEY) {
    const db = createSupabaseAdminClient();
    for (let start = 0; start < rows.length; start += 100) {
      const ids = rows.slice(start, start + 100).map(row => String(row.id));
      for (let offset = 0;; offset += 500) {
        const result = await db.from("beat_assets").select("id,beat_id,kind").eq("bucket", "beat-assets").in("beat_id", ids).order("id").range(offset, offset + 499);
        if (result.error) throw new Error("Impossibile verificare la disponibilità dei beat.");
        for (const asset of result.data ?? []) kinds.set(asset.beat_id, [...(kinds.get(asset.beat_id) ?? []), asset.kind]);
        if (!result.data || result.data.length < 500) break;
      }
    }
  }
  const discounts=await getPublicDiscounts();
  return rows.map(row => {
    const beat = mapBeat(row);
    beat.licensePrices=Object.fromEntries(Object.entries(beat.licensePrices??{}).map(([code,base])=>[code,discountPrice(base as number,[`beat:${beat.id}`,`license:${code}`,"beats"],discounts)]));
    const prices = Array.isArray(row.beat_license_prices) ? row.beat_license_prices : [];
    beat.readyLicenseIds = prices.flatMap(entry => {
      const license = Array.isArray(entry.license_types) ? entry.license_types[0] : entry.license_types;
      if (!entry.active || !license?.active || license.is_exclusive) return [];
      const ready = offerReadiness({ contract: license.contract_text, includedAssets: license.included_assets, availableKinds: kinds.get(beat.id) ?? [], hasPreview: Boolean(row.preview_path) });
      return ready.ready ? [license.code as License["id"]] : [];
    });
    return beat;
  });
}
function mapBeat(row: DbBeat): Beat {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_GENKS_SUPABASE_URL;
  const localCovers: Record<string, string> = {
    "blue-hour": "/artwork/blue-hour.webp",
    "chrome-hearts": "/artwork/genks-orb.webp",
    afterimage: "/artwork/afterimage.webp",
    "no-signal": "/artwork/genks-orb.webp",
    "low-tide": "/artwork/afterimage.webp",
    "night-drive": "/artwork/blue-hour.webp",
  };
  const publicUrl = (bucket: string, path: unknown, fallback: string) =>
    path && url
      ? `${url}/storage/v1/object/public/${bucket}/${String(path)}`
      : fallback;
  const prices = Array.isArray(row.beat_license_prices)
    ? row.beat_license_prices.filter(entry => entry.active !== false && (Array.isArray(entry.license_types) ? entry.license_types[0]?.active : entry.license_types?.active) !== false)
    : [];
  return {
    id: String(row.id), slug: String(row.slug), title: String(row.title),
    cover: publicUrl("covers", row.cover_path, localCovers[String(row.slug)] ?? "/artwork/genks-orb.webp"),
    previewUrl: publicUrl("previews", row.preview_path, ""),
    bpm: Number(row.bpm), key: String(row.musical_key),
    genre: String(row.genre) as Beat["genre"], mood: String(row.mood) as Beat["mood"],
    description: italianLabel(String(row.description ?? "")), featured: Boolean(row.featured),
    status: "published",
    licenseIds: prices.map((price: unknown) => {
      const licenseTypes = (price as { license_types?: { code?: string } | { code?: string }[] }).license_types;
      return (Array.isArray(licenseTypes) ? licenseTypes[0]?.code : licenseTypes?.code) as Beat["licenseIds"][number];
    }).filter(Boolean),
    licensePrices: Object.fromEntries(prices.flatMap((price: unknown) => {
      const entry = price as { price_override_cents?: number | null; license_types?: { code?: string; price_cents?: number } | { code?: string; price_cents?: number }[] };
      const licenseType = Array.isArray(entry.license_types) ? entry.license_types[0] : entry.license_types;
      return licenseType?.code ? [[licenseType.code, entry.price_override_cents ?? licenseType.price_cents ?? 0]] : [];
    })),
    assets: [], isDemo: false,
  };
}
