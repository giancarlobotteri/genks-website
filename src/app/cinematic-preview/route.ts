import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.GENKS_CINEMATIC_SANDBOX !== 'true') {
    return new Response(null, { status: 404 });
  }
  const nonce = request.headers.get('x-nonce');
  if (!nonce || !/^[A-Za-z0-9+/=]+$/.test(nonce)) return new Response(null, { status: 403 });
  const html = await readFile(join(process.cwd(), 'public/qa-studio/index.html'), 'utf8');
  return new Response(html.replaceAll('<script ', `<script nonce="${nonce}" `), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
  });
}
