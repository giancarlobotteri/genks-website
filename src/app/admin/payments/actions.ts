"use server";
import {requireAdmin} from '@/lib/auth';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {getStripe} from '@/lib/stripe';
import {queueNotification,flushNotifications} from '@/lib/notifications';
import {serviceAmount} from '@/lib/service-rates';
import {orderVersion} from '@/lib/service-order-v8';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {fromRomeWallTime} from '@/lib/rome-time';
import {getGoogleBusyRanges,hasGoogleBusyCalendar} from '@/lib/google-calendar';
async function assertNoPaymentReview(partId:string){
 const db=createSupabaseAdminClient();const part=await db.from('service_order_parts_v8').select('project_id').eq('id',partId).single();if(part.error)redirect('/admin/payments?error=invalid');
 const payments=await db.from('payments').select('id').eq('project_id',part.data.project_id).or('disputed.eq.true,refunded_cents.gt.0,review_reason.not.is.null').limit(1);
 if(payments.error||payments.data?.length)redirect('/admin/payments?error=review');
}
export async function requestCustomPayment(form:FormData){
 await requireAdmin();
 const parsed=z.object({email:z.email(),description:z.string().trim().min(10).max(1000),amount:z.string().regex(/^\d{1,5}([.,]\d{1,2})?$/)}).safeParse(Object.fromEntries(form));
 if(!parsed.success)redirect('/admin/payments?error=invalid');
 const cents=Math.round(Number(parsed.data.amount.replace(',','.'))*100);if(cents<50||cents>2000000)redirect('/admin/payments?error=invalid');
 const db=createSupabaseAdminClient();const expires=new Date(Date.now()+24*3600000).toISOString();
 const project=await db.from('service_projects').insert({name:'Cliente',email:parsed.data.email,track_title:'Pagamento personalizzato',service:'studio_package',track_count:1,description:parsed.data.description,notes:parsed.data.description,status:'awaiting_payment',price_cents:cents,commerce_snapshot:{version:orderVersion,stage:'custom'}}).select('id,reference').single();
 if(project.error)redirect('/admin/payments?error=save');
 await db.from('notification_outbox').update({cancelled_at:new Date().toISOString()}).eq('dedupe_key',`request-${project.data.reference}-customer`).is('sent_at',null);
 const quote=await db.from('service_quotes').insert({project_id:project.data.id,amount_cents:cents,scope:parsed.data.description,revision_count:0,expires_at:expires,fixed_price:true,commerce_snapshot:{version:orderVersion,stage:'custom'}}).select('id').single();
 if(quote.error)redirect('/admin/payments?error=save');
 const origin=process.env.NEXT_PUBLIC_SITE_URL!;
 const session=await getStripe().checkout.sessions.create({mode:'payment',locale:'it',payment_method_types:['card'],customer_email:parsed.data.email,expires_at:Math.floor(new Date(expires).getTime()/1000),line_items:[{quantity:1,price_data:{currency:'eur',unit_amount:cents,product_data:{name:'GENKS · '+project.data.reference,description:parsed.data.description.slice(0,500)}}}],success_url:`${origin}/services/ordine?session={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/services`,metadata:{payment_type:'service_cart_v8',quote_id:quote.data.id,project_id:project.data.id}}, {idempotencyKey:'v8-custom-'+quote.data.id});
 const saved=await db.from('service_quotes').update({status:'open',stripe_session_id:session.id,checkout_url:session.url}).eq('id',quote.data.id);
 if(saved.error||!session.url){if(session.status==='open')await getStripe().checkout.sessions.expire(session.id);redirect('/admin/payments?error=save');}
 await queueNotification('v8-custom-'+quote.data.id,{to:parsed.data.email,subject:'GENKS · Richiesta di pagamento · '+project.data.reference,heading:'Il tuo pagamento personalizzato',body:`Codice ordine: ${project.data.reference}\n\nDescrizione: ${parsed.data.description}\n\nImporto da pagare: ${serviceAmount(cents)}\n\nScadenza del link: ${new Date(expires).toLocaleString('it-IT',{timeZone:'Europe/Rome'})}\n\nSe riguarda un ordine precedente, conserva entrambi i riferimenti. Questa richiesta non modifica automaticamente il saldo di un altro ordine. Per chiarimenti rispondi prima di pagare.`,actionUrl:session.url,actionLabel:'Paga con carta o Apple Pay'});
 await flushNotifications({prefix:'v8-custom-'+quote.data.id,throwOnFailure:true});revalidatePath('/admin/payments');redirect('/admin/payments?sent=1');
}
export async function recordServiceCash(form:FormData){
 await requireAdmin();const parsed=z.object({part:z.uuid(),stage:z.enum(['initial','balance']),confirmed:z.literal('on')}).safeParse(Object.fromEntries(form));if(!parsed.success)redirect('/admin/payments?error=invalid');
 await assertNoPaymentReview(parsed.data.part);const db=createSupabaseAdminClient();const open=await db.from('service_quotes').select('id,stripe_session_id').eq('commerce_snapshot->>partId',parsed.data.part).in('status',['creating','open']);if(open.error)throw Error('Verifica pagamenti non disponibile.');
 for(const q of open.data??[]){if(!q.stripe_session_id)redirect('/admin/payments?error=payment_pending');const session=await getStripe().checkout.sessions.retrieve(q.stripe_session_id);if(session.status==='complete')redirect('/admin/payments?error=payment_pending');if(session.status==='open')await getStripe().checkout.sessions.expire(session.id);await db.from('service_quotes').update({status:'expired'}).eq('id',q.id);}
 const result=await db.rpc('receive_service_part_v8',{p_part:parsed.data.part,p_stage:parsed.data.stage});
 if(result.error)redirect('/admin/payments?error=expired');
 await flushNotifications({prefix:`cash-v8-${parsed.data.part}-${parsed.data.stage}`});revalidatePath('/admin/payments');revalidatePath('/admin/bookings');revalidatePath('/admin/analytics');redirect('/admin/payments?received=1');
}
export async function requestBalancePayment(form:FormData){
 await requireAdmin();const id=z.uuid().parse(form.get('part'));await assertNoPaymentReview(id);const db=createSupabaseAdminClient();
 const expired=await db.from('service_quotes').select('id,stripe_session_id').eq('commerce_snapshot->>partId',id).in('status',['creating','open']).lt('expires_at',new Date().toISOString());if(expired.error)throw Error('Verifica saldo non disponibile.');for(const old of expired.data??[]){if(old.stripe_session_id){const session=await getStripe().checkout.sessions.retrieve(old.stripe_session_id);if(session.status==='complete')redirect('/admin/payments?error=payment_pending');if(session.status==='open')await getStripe().checkout.sessions.expire(session.id);}await db.from('service_quotes').update({status:'expired'}).eq('id',old.id);}
 const prepared=await db.rpc('prepare_service_balance_v8',{p_part:id});if(prepared.error||!prepared.data)redirect('/admin/payments?error=balance');
 const q=prepared.data as {id:string;amount_cents:number;email:string;reference:string;scope:string;project_id:string;expires_at:string;checkout_url:string|null;stripe_session_id:string|null};
 let url=q.checkout_url;
 if(!q.stripe_session_id){const origin=process.env.NEXT_PUBLIC_SITE_URL!;const session=await getStripe().checkout.sessions.create({mode:'payment',locale:'it',payment_method_types:['card'],customer_email:q.email,expires_at:Math.floor(new Date(q.expires_at).getTime()/1000),line_items:[{quantity:1,price_data:{currency:'eur',unit_amount:q.amount_cents,product_data:{name:('GENKS · '+q.scope).slice(0,250)}}}],success_url:`${origin}/services/ordine?session={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/account/projects`,metadata:{payment_type:'service_cart_v8',quote_id:q.id,project_id:q.project_id}}, {idempotencyKey:'v8-balance-'+q.id});const saved=await db.from('service_quotes').update({status:'open',stripe_session_id:session.id,checkout_url:session.url}).eq('id',q.id);if(saved.error||!session.url){if(session.status==='open')await getStripe().checkout.sessions.expire(session.id);redirect('/admin/payments?error=save');}url=session.url;}
 if(!url||new Date(q.expires_at).getTime()<=Date.now())redirect('/admin/payments?error=balance_expired');
 await queueNotification('v8-balance-'+q.id,{to:q.email,subject:'GENKS · Saldo · '+q.reference,heading:'Il saldo del tuo ordine',body:`${q.scope}\n\nSaldo da pagare: ${serviceAmount(q.amount_cents)}\n\nL’anticipo già ricevuto non viene addebitato nuovamente. Il pagamento aggiorna questa voce dell’ordine.`,actionUrl:url,actionLabel:'Paga il saldo con carta o Apple Pay'});await flushNotifications({prefix:'v8-balance-'+q.id,throwOnFailure:true});redirect('/admin/payments?sent=1');
}
export async function scheduleCredit(form:FormData){
 await requireAdmin();const p=z.object({part:z.uuid(),date:z.iso.date(),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),minutes:z.coerce.number().int().min(15).max(300).multipleOf(15)}).safeParse(Object.fromEntries(form));if(!p.success)redirect('/admin/payments?error=invalid');
 await assertNoPaymentReview(p.data.part);const start=fromRomeWallTime(p.data.date,p.data.time),end=new Date(start.getTime()+p.data.minutes*60000);
 if(hasGoogleBusyCalendar){const ranges=await getGoogleBusyRanges(start,end);if(ranges.some(r=>new Date(r.starts_at)<end&&new Date(r.ends_at)>start))redirect('/admin/payments?error=occupied');}
 const result=await createSupabaseAdminClient().rpc('schedule_service_credit_v8',{p_part:p.data.part,p_start:start.toISOString(),p_minutes:p.data.minutes});if(result.error)redirect('/admin/payments?error=occupied');
 await flushNotifications({prefix:'v8-credit-'});revalidatePath('/admin/payments');revalidatePath('/admin/bookings');redirect('/admin/payments?scheduled=1');
}
