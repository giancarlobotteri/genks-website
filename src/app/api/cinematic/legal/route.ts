import {legalDocuments} from '@/data/legal';
/** The legal texts of GENKS, read by the new site's /legal/* pages (single source: src/data/legal.ts). */
export function GET(request: Request) {
  const doc = new URL(request.url).searchParams.get('doc') ?? '';
  const entry = (legalDocuments as Record<string, {title: string; body: string}>)[doc];
  if (!entry) return Response.json({error: 'Documento non trovato.'}, {status: 404});
  return Response.json({title: entry.title, body: entry.body}, {headers: {'Cache-Control': 'public, max-age=300, s-maxage=3600'}});
}
