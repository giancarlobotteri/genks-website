import {stripeTestMode} from '@/lib/preview-mode';
import 'server-only';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {z} from 'zod';
import {funnelServices,type FunnelService} from './funnel';
export const funnelContextSchema=z.object({session:z.uuid(),device:z.enum(['mobile','desktop']),service:z.enum(funnelServices)}).strict();
export function funnelEnabled(){return process.env.VERCEL_ENV==='production'&&!stripeTestMode();}
export type FunnelContext=z.infer<typeof funnelContextSchema>;
export function consentGiven(cookie:string|null){return (cookie??'').split(';').some(c=>c.trim()==='genks_stats_consent=v1-yes');}
export async function recordFunnel(context:FunnelContext|undefined,step:string,quote?:string){
 if(!context||!funnelEnabled())return;
 try{const {error}=await createSupabaseAdminClient().rpc('genks_funnel_record',{p_session:context.session,p_step:step,p_service:context.service,p_device:context.device,p_quote:quote??null}).abortSignal(AbortSignal.timeout(1500));if(error)console.warn('[GENKS funnel] evento non registrato');}catch{console.warn('[GENKS funnel] statistiche non disponibili');}
}
/** Called only after Stripe payment verification and successful business settlement. */
export async function completeFunnelPayment(quote:string,live:boolean){
 if(!live)return;
 try{const db=createSupabaseAdminClient();const {data}=await db.from('genks_funnel_events').select('session_id,device,service').eq('quote_id',quote).eq('step','payment_started').limit(10).abortSignal(AbortSignal.timeout(1500));for(const row of data??[])await recordFunnel({session:row.session_id,device:row.device,service:row.service as FunnelService},'payment_completed',quote);}catch{console.warn('[GENKS funnel] esito statistico non disponibile');}
}
