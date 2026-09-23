import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.email) {
    const admin = createSupabaseAdminClient();
    await Promise.all([
      admin.from("orders").update({ customer_id: user.id }).is("customer_id", null).ilike("customer_email", user.email),
      admin.from("entitlements").update({ customer_id: user.id }).is("customer_id", null).ilike("customer_email", user.email),
      admin.from("bookings").update({ customer_id: user.id }).is("customer_id", null).ilike("email", user.email),
      admin.from("service_projects").update({ customer_id: user.id }).is("customer_id", null).ilike("email", user.email),
    ]);
  }
  return <div className="portal-shell">
    <header className="portal-header"><div><span className="eyebrow">GENKS ACCOUNT</span><h1>Your space.</h1><p className="muted">{user.email}</p></div><form action={signOut}><button className="button button-secondary">SIGN OUT</button></form></header>
    <nav className="portal-tabs" aria-label="Account"><Link href="/account/library">Library</Link><Link href="/account/orders">Orders</Link><Link href="/account/bookings">Bookings</Link><Link href="/account/projects">Projects</Link></nav>
    {children}
  </div>;
}
