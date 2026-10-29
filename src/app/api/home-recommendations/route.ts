import {NextResponse} from 'next/server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {suggestedServices,purchasedServiceIds} from '@/lib/home-discovery';
export const dynamic='force-dynamic';
const response=(status:string,ids:string[]=[])=>NextResponse.json({status,ids},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
export async function GET(){
 try{
  const db=await createSupabaseServerClient();
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user||!user.email_confirmed_at)return response('guest');
  // Session-scoped client + explicit ownership. No admin client or email lookup.
  const [projects,bookings]=await Promise.all([
   db.from('service_projects').select('service,commerce_snapshot').eq('customer_id',user.id).is('archived_at',null).in('status',['paid','in_progress','review','delivered']).order('created_at',{ascending:false}).limit(20),
   db.from('bookings').select('id').eq('customer_id',user.id).is('archived_at',null).eq('status','completed').limit(1)
  ]);
  if(projects.error||bookings.error)return response('unavailable');
  return response('ready',suggestedServices(purchasedServiceIds(projects.data??[]),Boolean(bookings.data?.length)));
 }catch{return response('unavailable');}
}
