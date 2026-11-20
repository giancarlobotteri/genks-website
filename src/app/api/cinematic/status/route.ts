import {allowPublicRequest} from '@/lib/security/request-limit';
import {getStripe} from '@/lib/stripe';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
export const runtime = 'nodejs';

/**
 * Order confirmation for the new site (www.prodbygenks.com/ordine), the same checks as /services/ordine.
 * `code` (cash orders) is only echoed back after a format check; `session` (card) is verified with Stripe
 * and the database. Nothing personal is returned: state, reference and amount paid.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const headers = {'Cache-Control': 'no-store'};
  const code = params.get('code') ?? '', session = params.get('session') ?? '';
  if (code) {
    if (!/^PRJ-[A-Z0-9-]{8,40}$/.test(code)) return Response.json({error: 'Codice ordine non valido.'}, {status: 400, headers});
    return Response.json({state: 'received', reference: code}, {headers});
  }
  if (!/^cs_(test_|live_)?[A-Za-z0-9_]{10,250}$/.test(session)) return Response.json({error: 'Pagamento non trovato.'}, {status: 400, headers});
  if (!await allowPublicRequest('checkout')) return Response.json({error: 'Troppe richieste. Attendi qualche minuto.'}, {status: 429, headers});
  try {
    const checkout = await getStripe().checkout.sessions.retrieve(session);
    if (checkout.metadata?.payment_type !== 'service_cart_v8') return Response.json({error: 'Pagamento non trovato.'}, {status: 404, headers});
    if (checkout.payment_status !== 'paid') return Response.json({state: 'pending', reference: ''}, {headers});
    const db = createSupabaseAdminClient();
    const row = await db.from('service_quotes').select('id,status,service_projects(reference)').eq('id', checkout.metadata.quote_id).eq('stripe_session_id', checkout.id).single();
    const pay = await db.from('payments').select('review_reason,disputed').eq('quote_id', row.data?.id ?? '00000000-0000-0000-0000-000000000000').maybeSingle();
    const project = Array.isArray(row.data?.service_projects) ? row.data.service_projects[0] : row.data?.service_projects;
    const paid = row.data?.status === 'paid' && Boolean(pay.data);
    const review = Boolean(pay.data?.review_reason) || Boolean(pay.data?.disputed);
    return Response.json({state: review ? 'review' : paid ? 'paid' : 'pending', reference: (project as {reference?: string} | null)?.reference ?? '', amount: checkout.amount_total ?? 0}, {headers});
  } catch {
    return Response.json({error: 'Verifica del pagamento non disponibile. Riprova tra poco.'}, {status: 503, headers});
  }
}
