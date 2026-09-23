import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, context: RouteContext<"/api/downloads/[entitlementId]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/account/library", request.url));
  const { entitlementId } = await context.params;
  const db = createSupabaseAdminClient();
  const { data: entitlement } = await db.from("entitlements").select("id,customer_id,beat_id,license_types(included_assets)").eq("id", entitlementId).eq("customer_id", user.id).is("revoked_at", null).single();
  if (!entitlement) return Response.json({ error: "File access denied." }, { status: 403 });
  const license = Array.isArray(entitlement.license_types) ? entitlement.license_types[0] : entitlement.license_types;
  const kinds = license?.included_assets ?? [];
  const { data: assets } = await db.from("beat_assets").select("id,bucket,storage_path,filename,kind").eq("beat_id", entitlement.beat_id).in("kind", kinds).order("kind");
  const asset = assets?.[0];
  if (!asset) return Response.json({ error: "No purchased files are available yet." }, { status: 404 });
  const { data, error } = await db.storage.from(asset.bucket).createSignedUrl(asset.storage_path, 60, { download: asset.filename });
  if (error || !data) return Response.json({ error: "Could not create a secure download." }, { status: 500 });
  await db.from("download_events").insert({ entitlement_id: entitlement.id, asset_id: asset.id, customer_id: user.id, user_agent: request.headers.get("user-agent")?.slice(0, 500) });
  return NextResponse.redirect(data.signedUrl);
}
