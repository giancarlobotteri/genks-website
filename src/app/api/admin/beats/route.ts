import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  title: z.string().trim().min(1).max(160), slug: z.string().trim().regex(/^[a-z0-9-]+$/), bpm: z.coerce.number().int().min(30).max(300),
  musicalKey: z.string().trim().min(1).max(20), genre: z.string().trim().min(1).max(60), mood: z.string().trim().min(1).max(60),
  tags: z.string().trim().max(500).default(""), description: z.string().trim().max(3000).default(""), status: z.enum(["draft", "published"]),
  featured: z.boolean().default(false), sortOrder: z.coerce.number().int().min(0).max(10000), publicationDate: z.string().trim().max(10).default(""),
});

export async function POST(request: Request) {
  const user = await requireAdmin();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the beat details and try again." }, { status: 400 });
  const input = parsed.data;
  const db = createSupabaseAdminClient();
  const { data: beat, error } = await db.from("beats").insert({
    title: input.title, slug: input.slug, bpm: input.bpm, musical_key: input.musicalKey, genre: input.genre, mood: input.mood,
    tags: input.tags.split(",").map((tag) => tag.trim()).filter(Boolean), description: input.description, status: input.status, featured: input.featured,
    sort_order: input.sortOrder, published_at: input.status === "published" ? (input.publicationDate ? new Date(`${input.publicationDate}T12:00:00Z`).toISOString() : new Date().toISOString()) : null,
  }).select("id").single();
  if (error || !beat) return Response.json({ error: error?.message || "Beat creation failed." }, { status: 500 });
  const { data: licenses } = await db.from("license_types").select("id").eq("active", true);
  if (licenses?.length) await db.from("beat_license_prices").insert(licenses.map((license) => ({ beat_id: beat.id, license_type_id: license.id })));
  await db.from("admin_audit_log").insert({ admin_id: user.id, action: "create", entity_type: "beat", entity_id: beat.id, payload: { title: input.title } });
  return Response.json({ id: beat.id });
}
