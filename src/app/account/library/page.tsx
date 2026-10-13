import { italianLabel } from "@/lib/italian";
import Link from "next/link";
import { claimGuestPurchases } from "@/lib/claim-guest-purchases";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LibraryPage() {
  const user = await claimGuestPurchases();
  const db = await createSupabaseServerClient();
  const { data } = await db.from("entitlements").select("id,granted_at,order_items(beat_title_snapshot,license_name_snapshot),beats(title,cover_path),license_types(name,included_assets)").eq("customer_id", user.id).is("revoked_at", null).order("granted_at", { ascending: false });
  return <section className="portal-panel"><div className="panel-heading"><h2>Raccolta</h2><span>{data?.length ?? 0} licenze</span></div>{!data?.length ? <div className="empty-state"><h3>Non ci sono ancora beat disponibili.</h3><p>I beat acquistati compariranno dopo la conferma del pagamento da parte di Stripe.</p><Link className="button button-primary" href="/beats">ESPLORA I BEAT</Link></div> : <div className="library-grid">{data.map((item) => { const orderItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items; return <article className="library-card" key={item.id}><span className="eyebrow">LICENZA ACQUISTATA</span><h3>{orderItem?.beat_title_snapshot ?? "Beat"}</h3><p>{italianLabel(orderItem?.license_name_snapshot)}</p><Link className="button button-secondary" href={`/api/downloads/${item.id}`}>VEDI I FILE DA SCARICARE</Link></article>; })}</div>}</section>;
}
