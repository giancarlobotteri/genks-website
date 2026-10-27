"use server";
import {requireAdmin} from '@/lib/auth';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {expireServiceQuotes} from '@/lib/service-payments';
import {deleteGoogleCalendarEvent} from '@/lib/google-calendar';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';
export async function manageServiceOrder(form:FormData){
 const admin=await requireAdmin();
 const input=z.object({id:z.uuid(),mode:z.enum(['archive','restore']),confirmed:z.literal('on')}).safeParse(Object.fromEntries(form));
 if(!input.success)redirect('/admin/payments?error=invalid');
 const db=createSupabaseAdminClient();
 if(input.data.mode==='archive'){
  const paid=await db.from('payments').select('id').eq('project_id',input.data.id).eq('status','succeeded').limit(1);
  if(paid.error)redirect('/admin/payments?error=payment_pending');
  if(!paid.data.length)try{
   // A failed checkout preparation has no Stripe link to expire. Wait beyond the
   // maximum request lifetime before closing it, so an in-flight request cannot race us.
   const stale=await db.from('service_quotes').update({status:'cancelled'}).eq('project_id',input.data.id).in('status',['creating','open']).is('stripe_session_id',null).lt('created_at',new Date(Date.now()-35*60_000).toISOString());
   if(stale.error)throw Error('Verifica pagamento non disponibile.');
   await expireServiceQuotes('project',input.data.id);
  }catch{redirect('/admin/payments?error=payment_pending');}
 }
 const result=await db.rpc('admin_manage_service_order',{p_project:input.data.id,p_admin:admin.id,p_restore:input.data.mode==='restore'});
 if(result.error)redirect('/admin/payments?error=payment_pending');
 let calendarError=false;
 const cleanup=z.object({events:z.array(z.object({id:z.uuid(),event:z.string(),kind:z.enum(['booking','project'])}))}).safeParse(result.data);
 if(cleanup.success)for(const event of cleanup.data.events){
  try{
   await deleteGoogleCalendarEvent(event.event);
   const saved=await db.from(event.kind==='booking'?'bookings':'service_projects').update({google_calendar_event_id:null}).eq('id',event.id).eq('google_calendar_event_id',event.event);
   if(saved.error)calendarError=true;
  }catch{calendarError=true;}
 }
 for(const path of ['/admin/payments','/admin/projects','/admin/bookings','/admin/analytics','/account/projects','/account/bookings','/services/recording'])revalidatePath(path);
 if(calendarError)redirect('/admin/payments?archived=1&cleanup='+input.data.id);
 redirect('/admin/payments?managed='+input.data.mode+(input.data.mode==='restore'?'':'&archived=1'));
}
