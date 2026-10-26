import Link from "next/link";
import "./account-space.css";
import { claimGuestPurchases } from "@/lib/claim-guest-purchases";
import { signOut } from "@/app/login/actions";
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await claimGuestPurchases();
  return <div className="portal-shell account-space">
    <header className="portal-header"><div><span className="eyebrow">AREA CLIENTE GENKS</span><h1>Il tuo spazio.</h1><p className="muted">{user.email}</p></div><form action={signOut}><button className="button button-secondary">ESCI</button></form></header>
    <nav className="portal-tabs" aria-label="Account"><Link href="/account/library">Raccolta</Link><Link href="/account/orders">Ordini</Link><Link href="/account/bookings">Prenotazioni</Link><Link href="/account/projects">Progetti</Link><Link href="/account/details">I miei dati</Link></nav>
    {children}
  </div>;
}
