import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { cinematicOriginAllowed } from '@/lib/cinematic-origin';
import { cinematicSandboxConfigured, cinematicSandboxRecipient } from '@/lib/cinematic-sandbox';
import { flushNotifications, queueNotification } from '@/lib/notifications';
import { previewRecipientAllowed } from '@/lib/preview-mode';
import { allowPublicRequest } from '@/lib/security/request-limit';

const types = {
  bundle: 'Richiesta pacchetto',
  exclusive: 'Richiesta licenza esclusiva',
  order: 'Richiesta licenza beat',
} as const;

const schema = z.object({
  kind: z.enum(['bundle', 'exclusive', 'order']),
  summary: z.string().trim().max(400),
  data: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email().max(254),
  }).catchall(z.string().max(2000)),
});

export async function POST(request: Request) {
  if (!cinematicOriginAllowed(request)) return Response.json({ error: 'Origine non autorizzata.' }, { status: 403 });
  if (process.env.VERCEL_ENV === 'preview' && !cinematicSandboxConfigured()) {
    return Response.json({ error: 'Anteprima non configurata.' }, { status: 503 });
  }
  if (!await allowPublicRequest('service')) return Response.json({ error: 'Troppe richieste.' }, { status: 429 });

  const raw = await request.text();
  if (raw.length > 18000) return Response.json({ error: 'Richiesta troppo grande.' }, { status: 413 });
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return Response.json({ error: 'Richiesta non valida.' }, { status: 400 }); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return Response.json({ error: 'Controlla i dati della richiesta.' }, { status: 400 });

  const { kind, summary, data } = parsed.data;
  const email = data.email.toLowerCase();
  if (!previewRecipientAllowed(email) || (process.env.VERCEL_ENV === 'preview' && !cinematicSandboxRecipient(email))) {
    return Response.json({ error: 'Destinatario non autorizzato.' }, { status: 403 });
  }

  const reference = 'VS-' + randomUUID().slice(0, 12).toUpperCase();
  const key = 'cinematic-request-' + reference;
  const clean = (value: string) => value.replace(/[\r\n\t]/g, ' ');
  const fields = Object.entries(data)
    .filter(([name, value]) => value && !['name', 'email', 'ack', 'consent'].includes(name))
    .slice(0, 24)
    .map(([name, value]) => clean(name) + ': ' + clean(value));

  const label = types[kind];
  const owner = process.env.GENKS_ADMIN_EMAIL || 'prod.genks@gmail.com';
  try {
    await queueNotification(key + '-owner', {
      to: owner, subject: `GENKS · ${label} · ${reference}`, heading: 'Nuova richiesta dal sito.',
      body: [`Cliente: ${clean(data.name)}`, `Email cliente: ${email}`, clean(summary), ...fields].filter(Boolean).join('\n'),
    });
    if (email !== owner.toLowerCase()) await queueNotification(key + '-customer', {
      to: email, subject: `GENKS · ${label} ricevuta · ${reference}`, heading: 'Abbiamo ricevuto la tua richiesta.',
      body: `Riferimento: ${reference}\nServizio: ${label}\nGENKS ti contatterà per i prossimi passi.`,
    });
  } catch {
    return Response.json({ error: 'Impossibile salvare la richiesta. Riprova tra poco.' }, { status: 503 });
  }
  await flushNotifications({ prefix: key }).catch(() => {});
  return Response.json({ reference });
}
