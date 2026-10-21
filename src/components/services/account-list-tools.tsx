import Link from "next/link";
import { italianLabel } from "@/lib/italian";
export type AccountListQuery = { page?: string; sort?: string; status?: string };
export const accountSort = (sort?: string) => ["date_asc", "price_asc", "price_desc"].includes(sort??"") ? sort! : "date_desc";
export const accountPage = (value?: string) => Math.max(1, Math.min(100000, Math.floor(Number(value) || 1)));
export function AccountListTools({ path, sort, status, states }: { path: string; sort: string; status: string; states: string[] }) {
  return <form className="account-list-tools" action={path}>
    <label>Ordina per<select name="sort" defaultValue={sort}><option value="date_desc">Data · più recenti</option><option value="date_asc">Data · meno recenti</option><option value="price_asc">Prezzo · crescente</option><option value="price_desc">Prezzo · decrescente</option></select></label>
    <label>Stato<select name="status" defaultValue={status}><option value="">Tutti gli stati</option>{states.map(state => <option key={state} value={state}>{italianLabel(state)}</option>)}</select></label>
    <button className="button button-primary">Applica filtri</button><Link className="text-link" href={path}>Azzera filtri</Link>
  </form>;
}
export function AccountListPagination({ page, total, path, sort, status }: { page: number; total: number; path: string; sort: string; status: string }) {
  const pages = Math.max(1, Math.ceil(total / 5));
  const url = (next: number) => `${path}?${new URLSearchParams({ page: String(next), sort, status })}`;
  return <nav className="account-list-pagination" aria-label="Pagine della lista"><span>{total ? `${(page - 1) * 5 + 1}–${Math.min(page * 5, total)} di ${total}` : "Nessun risultato"} · Pagina {page} di {pages}</span><div>{page > 1 && <Link className="button button-secondary" href={url(page - 1)}>Precedenti</Link>}{page < pages && <Link className="button button-secondary" href={url(page + 1)}>Successivi</Link>}</div></nav>;
}

