import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LibraryPage() {
  const user = await requireUser();
  const db = await createSupabaseServerClient();
  const { data } = await db.from("entitlements").select("id,granted_at,order_items(beat_title_snapshot,license_name_snapshot),beats(title,cover_path),license_types(name,included_assets)").eq("customer_id", user.id).is("revoked_at", null).order("granted_at", { ascending: false });
  return <section className="portal-panel"><div className="panel-heading"><h2>Library</h2><span>{data?.length ?? 0} licenses</span></div>{!data?.length ? <div className="empty-state"><h3>No sounds here yet.</h3><p>Your licensed beats will appear after Stripe confirms payment.</p><Link className="button button-primary" href="/beats">EXPLORE BEATS</Link></div> : <div className="library-grid">{data.map((item) => { const orderItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items; return <article className="library-card" key={item.id}><span className="eyebrow">LICENSED</span><h3>{orderItem?.beat_title_snapshot ?? "Beat"}</h3><p>{orderItem?.license_name_snapshot}</p><Link className="button button-secondary" href={`/api/downloads/${item.id}`}>VIEW DOWNLOADS</Link></article>; })}</div>}</section>;
}
