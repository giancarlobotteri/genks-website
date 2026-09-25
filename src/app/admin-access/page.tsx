import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { signInAsAdmin } from "@/app/login/actions";

export default async function AdminAccessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <main className="portal-shell narrow-shell admin-login-shell">
    <div className="admin-login-icon"><ShieldCheck aria-hidden="true" /></div>
    <span className="eyebrow">PRIVATE CONTROL ROOM</span>
    <h1>GENKS Admin.</h1>
    <p className="muted">Area riservata al proprietario per pubblicare beat e gestire catalogo, licenze, ordini e prenotazioni.</p>
    {query.error && <p className="notice error" role="alert">Email o password non corretti.</p>}
    {query.denied && <p className="notice error" role="alert">Questo account non è autorizzato ad accedere all’Admin.</p>}
    {query.setup && <p className="notice error" role="alert">L’account esiste, ma deve ancora ricevere il ruolo admin in Supabase.</p>}
    <form action={signInAsAdmin} className="premium-form admin-login-form">
      <label>Email amministratore<input name="email" type="email" autoComplete="username" required defaultValue="prod.genks@gmail.com" readOnly /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required autoFocus /></label>
      <button className="button button-primary magnetic-cta" type="submit"><LockKeyhole size={17} /> ACCEDI AL PANNELLO</button>
    </form>
    <Link href="/" className="text-link admin-back-link">← Torna al sito</Link>
  </main>;
}
