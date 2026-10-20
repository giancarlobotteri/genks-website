import { requireAdminIdentity } from "@/lib/auth";
import { AdminMfa } from "@/components/admin/admin-mfa";
import { signOut } from "@/app/login/actions";

export const dynamic = "force-dynamic";
export default async function AdminSecurityPage() {
  await requireAdminIdentity();
  return <div className="portal-shell narrow-shell admin-login-shell">
    <span className="eyebrow">ACCESSO PROTETTO GENKS</span>
    <h1>Verifica in due passaggi.</h1>
    <p>Per proteggere clienti, ordini e file, il pannello richiede anche il codice della tua app di autenticazione.</p>
    <AdminMfa />
    <form action={signOut}><button className="button button-secondary">Esci dall’account</button></form>
  </div>;
}
