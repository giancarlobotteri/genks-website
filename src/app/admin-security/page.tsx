import styles from "./security.module.css";
import {ShieldCheck} from "lucide-react";
import {requireAdmin} from "@/lib/auth";
import { requireAdminIdentity } from "@/lib/auth";
import { AdminMfa } from "@/components/admin/admin-mfa";
import { signOut } from "@/app/login/actions";

export const dynamic = "force-dynamic";
export default async function AdminSecurityPage({searchParams}:{searchParams:Promise<{preview?:string}>}) {
  const preview=(await searchParams).preview==="1";if(preview)await requireAdmin();
  await requireAdminIdentity();
  return <div className={styles.page}><header className={styles.intro}><div className={styles.badge}><ShieldCheck size={44} aria-hidden="true"/></div><span>GENKS · ACCESSO RISERVATO</span><h1>Il tuo studio.<br/>Al sicuro.</h1><p>Apri l’app di autenticazione e inserisci il codice a sei cifre per accedere al pannello.</p><div className={styles.hint}><span>1 · Apri la tua app di autenticazione</span><span>2 · Inserisci il codice GENKS attuale</span><span>3 · Entra nel tuo studio control</span></div></header><div className={styles.panel}>{preview&&<p className="notice">Anteprima grafica: nessuna modifica al tuo accesso.</p>}<AdminMfa preview={preview}/><form action={signOut} className={styles.exit}><button className="button button-secondary">Esci dall’account</button></form></div></div>;
}
