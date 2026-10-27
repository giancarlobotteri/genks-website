import styles from "./admin-suite.module.css";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminNavigation } from "@/components/admin/admin-navigation";
export const dynamic = "force-dynamic";
export default async function AdminLayout({children}:{children:React.ReactNode}) {
  await requireAdmin();
  return <div className={`admin-shell ${styles.shell}`}><aside className="admin-sidebar"><Link href="/admin" className="admin-brand">GENKS <span>STUDIO CONTROL</span></Link><AdminNavigation/><Link className="admin-return" href="/">Torna al sito ↗</Link></aside><section className="admin-content">{children}</section></div>;
}
