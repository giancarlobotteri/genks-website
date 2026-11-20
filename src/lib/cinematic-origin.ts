export function cinematicOriginAllowed(request: Request) {
  if (!new URL(request.url).pathname.startsWith('/api/cinematic/')) return false;
  const origin = request.headers.get('origin');
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const local = process.env.NODE_ENV === 'development' ? ['http://127.0.0.1:3141', 'http://localhost:3141'] : [];
  return [new URL(request.url).origin, 'https://www.prodbygenks.com', 'https://prodbygenks.com', process.env.GENKS_CINEMATIC_PREVIEW_ORIGIN, ...local].filter(Boolean).includes(origin);
}
