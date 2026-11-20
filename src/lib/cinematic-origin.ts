export function cinematicOriginAllowed(request: Request) {
  if (!new URL(request.url).pathname.startsWith('/api/cinematic/')) return false;
  const origin = request.headers.get('origin');
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const local = process.env.NODE_ENV === 'development' ? ['http://127.0.0.1:3141', 'http://localhost:3141'] : [];
  return [new URL(request.url).origin, 'https://www.prodbygenks.com', 'https://prodbygenks.com', process.env.GENKS_CINEMATIC_PREVIEW_ORIGIN, ...local].filter(Boolean).includes(origin);
}

/** Where the customer returns after an order from the new site: the site they ordered from (www or apex). */
export function cinematicSiteOrigin(request: Request) {
  const origin = request.headers.get('origin') ?? '';
  const allowed = ['https://www.prodbygenks.com', 'https://prodbygenks.com', process.env.GENKS_CINEMATIC_PREVIEW_ORIGIN].filter(Boolean);
  if (allowed.includes(origin)) return origin;
  if (process.env.NODE_ENV === 'development' && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return origin;
  return 'https://www.prodbygenks.com';
}
