import Link from "next/link";

export function pageNumber(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
}

export function AdminPagination({ page, total, path, params = {} }: { page: number; total: number; path: string; params?: Record<string, string> }) {
  const pages = Math.max(1, Math.ceil(total / 5));
  const href = (n: number) => `${path}?${new URLSearchParams({ ...params, page: String(n) })}`;
  return <nav className="admin-pagination" aria-label="Pagine della lista">
    <span>{total ? `${(page - 1) * 5 + 1}–${Math.min(page * 5, total)} di ${total}` : "Nessun elemento"}</span>
    <div>{page > 1 && <Link className="button button-secondary" href={href(page - 1)}>Precedenti</Link>}<span>Pagina {page} di {pages}</span>{page < pages && <Link className="button button-secondary" href={href(page + 1)}>Successivi</Link>}</div>
  </nav>;
}
