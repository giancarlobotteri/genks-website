export function paginate<T>(items: T[], requestedPage: number, pageSize = 5) {
  const size = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(totalPages, Math.max(1, Math.floor(requestedPage)));
  const start = (page - 1) * size;
  return { items: items.slice(start, start + size), page, totalPages, start, total: items.length };
}
