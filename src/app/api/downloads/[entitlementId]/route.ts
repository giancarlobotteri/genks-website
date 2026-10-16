import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowedDownloadKinds } from "@/lib/commerce/download-access";

export async function GET(request: Request, context: RouteContext<"/api/downloads/[entitlementId]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/account/library", request.url));
  const { entitlementId } = await context.params;
  const db = createSupabaseAdminClient();
  const { data: entitlement } = await db.from("entitlements").select("id,customer_id,beat_id,license_type_id,order_item_id,revoked_at").eq("id", entitlementId).eq("customer_id", user.id).is("revoked_at", null).single();
  if (!entitlement) return Response.json({ error: "Accesso al file negato." }, { status: 403 });
  const { data: item } = await db.from("order_items").select("id,order_id,beat_id,license_type_id,license_terms_snapshot,beat_title_snapshot,license_name_snapshot").eq("id", entitlement.order_item_id).single();
  if (!item) return Response.json({ error: "Accesso al file negato." }, { status: 403 });
  const { data: order } = await db.from("orders").select("id,customer_id,status,paid_at,refunded_at,order_number,customer_name,customer_email").eq("id", item.order_id).single();
  const kinds = order ? allowedDownloadKinds(entitlement, item, order, user.id) : [];
  if (!kinds.length) return Response.json({ error: "Il download richiede una licenza acquistata con pagamento confermato." }, { status: 403 });
  const query = new URL(request.url).searchParams;
  if(query.get("document")==="license") {
    const snapshot=item.license_terms_snapshot;
    const contract=snapshot&&typeof snapshot==="object"&&"contractText" in snapshot&&typeof snapshot.contractText==="string"?snapshot.contractText:"";
    if(!contract||!order)return Response.json({error:"Contratto non disponibile."},{status:404});
    const text=`GENKS · LICENZA ACQUISTATA\nOrdine: ${order.order_number}\nAcquirente: ${order.customer_name??""}\nEmail: ${order.customer_email}\nBeat: ${item.beat_title_snapshot}\nLicenza: ${item.license_name_snapshot}\nPagamento: ${order.paid_at}\n\n${contract}`;
    return new Response(text,{headers:{"Content-Type":"text/plain; charset=utf-8","Content-Disposition":`attachment; filename="GENKS-licenza-${item.id}.txt"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }
  const requestedKind=query.get("kind")??kinds[0];
  if(!kinds.includes(requestedKind as typeof kinds[number]))return Response.json({error:"Il formato non è incluso nella licenza acquistata."},{status:403});
  const { data: assets } = await db.from("beat_assets").select("id,bucket,storage_path,filename,kind").eq("beat_id", entitlement.beat_id).eq("bucket", "beat-assets").eq("kind",requestedKind).order("created_at",{ascending:false}).limit(1);
  const asset = assets?.[0];
  if (!asset) return Response.json({ error: "I file acquistati non sono ancora disponibili." }, { status: 404 });
  const { data, error } = await db.storage.from("beat-assets").createSignedUrl(asset.storage_path, 60, { download: asset.filename });
  if (error || !data) return Response.json({ error: "Non è stato possibile creare un collegamento sicuro per scaricare il file." }, { status: 500 });
  // Keep the temporary storage URL on the server: each download checks the buyer's session.
  const range = request.headers.get("range");
  const source = await fetch(data.signedUrl, {
    cache: "no-store",
    signal: request.signal,
    headers: range && /^bytes=\d+-\d*$/.test(range) ? { Range: range } : undefined,
  }).catch(() => null);
  if (!source?.ok || !source.body) return Response.json({ error: "Il file non è disponibile. Riprova tra poco." }, { status: 502 });
  await db.from("download_events").insert({ entitlement_id: entitlement.id, asset_id: asset.id, customer_id: user.id, user_agent: request.headers.get("user-agent")?.slice(0, 500) });
  const filename = asset.filename.replace(/[^a-zA-Z0-9._ -]/g, "_");
  const headers = new Headers({
    "Content-Type": source.headers.get("content-type") ?? "application/octet-stream",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const contentRange = source.headers.get("content-range");
  if (source.status === 206 && contentRange) headers.set("Content-Range", contentRange);
  headers.set("Accept-Ranges", "bytes");
  return new Response(source.body, { status: source.status, headers });
}
