"use server";
import {requireAdmin} from '@/lib/auth';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {expireServiceQuotes} from '@/lib/service-payments';
import {deleteGoogleCalendarEvent} from '@/lib/google-calendar';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

export async function removeBooking(form:FormData){
 const user=await requireAdmin();
 const parsed=z.object({id:z.uuid(),confirmed:z.literal('on'),restore:z.enum(['0','1'])}).safeParse(Object.fromEntries(form));
 if(!parsed.success)redirect('/admin/bookings?notice=remove_error');
 const db=createSupabaseAdminClient();
 if(parsed.data.restore==='0'){
  const current=await db.from('bookings').select('google_calendar_event_id').eq('id',parsed.data.id).single();
  if(current.error)redirect('/admin/bookings?notice=remove_error');
  try{await expireServiceQuotes('booking',parsed.data.id);}catch{redirect('/admin/bookings?notice=remove_payment_pending');}
  // Delete only the event belonging to this booking, never other calendar commitments.
  try{await deleteGoogleCalendarEvent(current.data.google_calendar_event_id);}catch{redirect('/admin/bookings?notice=remove_calendar_error');}
 }
 const result=await db.rpc('admin_remove_booking',{p_booking:parsed.data.id,p_admin:user.id,p_restore:parsed.data.restore==='1'});
 if(result.error)redirect('/admin/bookings?notice=remove_payment_pending');
 for(const path of ['/admin/bookings','/admin/payments','/admin/analytics','/admin','/account/bookings','/services/recording'])revalidatePath(path);
 redirect('/admin/bookings?notice='+ (parsed.data.restore==='1'?'booking_restored':'booking_removed'));
}
