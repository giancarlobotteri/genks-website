import {getCurrentUser} from '@/lib/auth';
import {z} from 'zod';
import {funnelEnabled,funnelContextSchema,consentGiven,recordFunnel} from '@/lib/funnel-server';
import {clientFunnelSteps} from '@/lib/funnel';
import {allowPublicRequest} from '@/lib/security/request-limit';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
export const runtime='nodejs';
const schema=funnelContextSchema.extend({step:z.enum(clientFunnelSteps)}).strict();
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});
 if(!funnelEnabled()||!consentGiven(request.headers.get('cookie')))return new Response(null,{status:204});
 let user;try{user=await getCurrentUser();}catch{return new Response(null,{status:503});}if(user?.email_confirmed_at&&user.email?.toLowerCase()===(process.env.GENKS_ADMIN_EMAIL||'prod.genks@gmail.com').toLowerCase())return new Response(null,{status:204});
 if(!await allowPublicRequest('funnel'))return new Response(null,{status:429});
 try{const text=await request.text();if(text.length>600)return new Response(null,{status:413});const {step,...context}=schema.parse(JSON.parse(text));await recordFunnel(context,step);return new Response(null,{status:204});}catch{return new Response(null,{status:400});}
}
export async function DELETE(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});
 if(!await allowPublicRequest('funnel'))return new Response(null,{status:429});
 try{const text=await request.text();if(text.length>100)return new Response(null,{status:413});const {session}=z.object({session:z.uuid()}).strict().parse(JSON.parse(text));const {error}=await createSupabaseAdminClient().from('genks_funnel_events').delete().eq('session_id',session).abortSignal(AbortSignal.timeout(1500));if(error)return new Response(null,{status:503});return new Response(null,{status:204});}catch{return new Response(null,{status:400});}
}
