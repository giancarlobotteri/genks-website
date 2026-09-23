import "server-only";
import { mockBeats } from "@/data/mock/beats";
import { mockLicenses } from "@/data/mock/licenses";
import { hasSupabase } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Beat, License } from "@/types/domain";

export interface BeatRepository {
  listPublished(): Promise<Beat[]>;
  getBySlug(slug: string): Promise<Beat | null>;
}

export const beatRepository: BeatRepository = {
  async listPublished() {
    if (hasSupabase) {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("beats")
        .select("id,slug,title,bpm,musical_key,genre,mood,description,featured,status,cover_path,preview_path,beat_license_prices(license_types(code))")
        .eq("status", "published")
        .order("sort_order")
        .order("published_at", { ascending: false });
      if (data?.length) return data.map(mapBeat);
    }
    return mockBeats.filter((beat) => beat.status === "published");
  },
  async getBySlug(slug) {
    if (hasSupabase) {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("beats")
        .select("id,slug,title,bpm,musical_key,genre,mood,description,featured,status,cover_path,preview_path,beat_license_prices(license_types(code))")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (data) return mapBeat(data);
    }
    return (
      mockBeats.find(
        (beat) => beat.slug === slug && beat.status === "published",
      ) ?? null
    );
  },
};

export async function getLicenses(): Promise<License[]> {
  if (hasSupabase) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("license_types")
      .select("code,name,price_cents,currency,included_assets,short_description,is_exclusive")
      .eq("active", true)
      .order("display_order");
    if (data?.length)
      return data.map((item) => ({
        id: item.code as License["id"],
        name: item.name,
        priceCents: item.price_cents,
        currency: "EUR",
        format: (item.included_assets ?? []).join(" + ").toUpperCase(),
        features: [item.short_description, ...(item.included_assets ?? []).map((asset: string) => `${asset.toUpperCase()} included`)].filter(Boolean),
        isDemo: false,
      }));
  }
  return mockLicenses;
}

type DbBeat = Record<string, unknown>;
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
    ? row.beat_license_prices
    : [];
  return {
    id: String(row.id), slug: String(row.slug), title: String(row.title),
    cover: publicUrl("covers", row.cover_path, localCovers[String(row.slug)] ?? "/artwork/genks-orb.webp"),
    previewUrl: publicUrl("previews", row.preview_path, ""),
    bpm: Number(row.bpm), key: String(row.musical_key),
    genre: String(row.genre) as Beat["genre"], mood: String(row.mood) as Beat["mood"],
    description: String(row.description ?? ""), featured: Boolean(row.featured),
    status: "published",
    licenseIds: prices.map((price: unknown) => {
      const licenseTypes = (price as { license_types?: { code?: string } | { code?: string }[] }).license_types;
      return (Array.isArray(licenseTypes) ? licenseTypes[0]?.code : licenseTypes?.code) as Beat["licenseIds"][number];
    }).filter(Boolean),
    assets: [], isDemo: false,
  };
}
