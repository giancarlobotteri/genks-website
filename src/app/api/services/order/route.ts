import {getPublicDiscounts} from '@/lib/public-discounts-server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {saveContactChoice} from '@/lib/customer-contact-server';
import {quoteOrder,orderSummary,cardOrderLines} from '@/lib/service-order-v8';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {getStripe} from '@/lib/stripe';
import {remoteProjectPaymentsReady} from '@/lib/remote-project-payments';
import {allowPublicRequest} from '@/lib/security/request-limit';
import {previewRecipientAllowed} from '@/lib/preview-mode';
import {getGoogleBusyRanges,hasGoogleBusyCalendar} from '@/lib/google-calendar';
import {fromRomeWallTime} from '@/lib/rome-time';
import {serviceTerms} from '@/data/legal';
import {flushNotifications} from '@/lib/notifications';
export const runtime='nodejs';
export async function POST(request:Request){
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')!==origin)return Response.json({error:'Richiesta non autorizzata.'},{status:403});
 if(!await allowPublicRequest('service'))return Response.json({error:'Troppe richieste. Attendi qualche minuto.'},{status:429});
 try{
  const text=await request.text();if(text.length>150000)throw Error('Ordine troppo grande.');
  const raw=JSON.parse(text);
  const data=z.object({name:z.string().trim().min(2).max(120),artistName:z.string().trim().max(120),email:z.email(),phone:z.string().trim().min(6).max(40),accepted:z.literal('on'),earlyStart:z.boolean(),withdrawalAcknowledged:z.boolean(),contactOwner:z.string().max(100),saveContact:z.boolean(),requestId:z.uuid(),direct:z.boolean().default(false),items:z.unknown(),expectedTotal:z.number().int().min(50),website:z.literal('')}).parse(raw);
  if(data.earlyStart&&!data.withdrawalAcknowledged)throw Error('Conferma di aver letto le condizioni dell’avvio anticipato.');
  if(!previewRecipientAllowed(data.email))throw Error('Destinatario non autorizzato in questa anteprima.');
  const quote=quoteOrder(data.items,data.earlyStart,new Date(),await getPublicDiscounts());
  if(quote.total!==data.expectedTotal)throw Error('Il listino è cambiato. Ricarica il riepilogo prima di pagare.');
  if(quote.cardNow&&!await remoteProjectPaymentsReady())throw Error('Pagamento con carta temporaneamente non disponibile. Riprova tra poco.');
  for(const part of quote.parts){const sel=part.selection;if(part.hours&&sel.date){
   const start=fromRomeWallTime(sel.date,sel.time),end=new Date(start.getTime()+part.hours*3600000);
   if(start.getTime()<Date.now()+14*86400000&&!data.earlyStart)throw Error('Per questa data entro 14 giorni richiedi espressamente l’avvio anticipato e leggi le condizioni, oppure scegli una data successiva.');
   if(start.getTime()<=Date.now()+35*60000)throw Error('Orario troppo vicino per la modalità di anticipo scelta.');
   if(hasGoogleBusyCalendar){const rules=await createSupabaseAdminClient().from('availability_rules').select('buffer_minutes').eq('active',true).eq('weekday',new Date(sel.date+'T12:00:00Z').getUTCDay());if(rules.error||!rules.data?.length)throw Error('Disponibilità del calendario non verificabile.');const protectedEnd=new Date(end.getTime()+Math.max(0,...rules.data.map(r=>Number(r.buffer_minutes)||0))*60000);const busy=await getGoogleBusyRanges(start,protectedEnd);if(busy.some(r=>new Date(r.starts_at)<protectedEnd&&new Date(r.ends_at)>start))throw Error('L’orario è già occupato. Scegli un altro intervallo.');}
  }}
  const user=await getCurrentUser();const form=new FormData();for(const [k,v] of Object.entries(data)){if(typeof v==='string')form.set(k,v);}if(data.saveContact)form.set('saveContact','on');
  await saveContactChoice(form,user);
  const db=createSupabaseAdminClient();const summary=orderSummary(quote);
  const result=await db.rpc('reserve_service_cart_v8',{p_data:{...data,customerId:user?.email?.toLowerCase()===data.email.toLowerCase()?user.id:null},p_quote:{...quote,requestId:data.requestId},p_terms:serviceTerms,p_summary:summary});
  if(result.error||!result.data){console.error('GENKS order reserve failed',result.error?.code);throw Error('Non è stato possibile riservare l’ordine: l’orario potrebbe essere appena stato occupato. Controlla la disponibilità e riprova.');}
  const prepared=result.data as {project_id:string;reference:string;quote_id:string|null;expires_at:string};
  if(!quote.cardNow){await flushNotifications({prefix:`v8-order-${prepared.project_id}`});await flushNotifications({prefix:`v8-owner-${prepared.project_id}`});return Response.json({cashOnly:true,url:'/services/ordine?code='+encodeURIComponent(prepared.reference)});}
  const previous=await db.from('service_quotes').select('checkout_url,stripe_session_id,status').eq('id',prepared.quote_id).single();
  if(previous.data?.checkout_url&&previous.data.status==='open')return Response.json({url:previous.data.checkout_url});
  const session=await getStripe().checkout.sessions.create({mode:'payment',locale:'it',payment_method_types:['card'],customer_email:data.email,expires_at:Math.floor(new Date(prepared.expires_at).getTime()/1000),
   line_items:cardOrderLines(quote).map(l=>({quantity:1,price_data:{currency:"eur",unit_amount:l.amount,product_data:{name:("GENKS · "+l.name).slice(0,250),description:"Le condizioni ricevute distinguono totale ordine, importo iniziale e saldo successivo."}}})),
   success_url:`${origin}/services/ordine?session={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/services/checkout?${data.direct?"direct=1&":""}cancelled=1`,metadata:{payment_type:'service_cart_v8',quote_id:prepared.quote_id!,project_id:prepared.project_id}},
   {idempotencyKey:`genks-v8-${prepared.quote_id}`});
  const saved=await db.from('service_quotes').update({stripe_session_id:session.id,checkout_url:session.url,status:'open'}).eq('id',prepared.quote_id).in('status',['creating','open']).select('id').single();
  if(saved.error||!session.url){if(session.status==='open')await getStripe().checkout.sessions.expire(session.id);throw Error('Pagamento non preparato. Nessun addebito effettuato.');}
  await flushNotifications({prefix:`v8-order-${prepared.project_id}`});await flushNotifications({prefix:`v8-owner-${prepared.project_id}`});
  return Response.json({url:session.url});
 }catch(e){const message=e instanceof z.ZodError?'Controlla contatti e condizioni.':e instanceof Error?e.message:'Impossibile completare l’ordine.';console.error('GENKS checkout requires retry',randomUUID());return Response.json({error:message.startsWith('contact_')?'L’account è cambiato. Ricarica la pagina e verifica i contatti.':message},{status:400});}
}
