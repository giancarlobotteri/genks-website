import 'server-only';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {queueNotification,flushNotifications} from '@/lib/notifications';
const setting='support_inbox_notifications';
type InboxState={enabledSince?:string;checkedAt?:string;status?:string;queued?:number};
export async function supportInboxStatus(){const r=await createSupabaseAdminClient().from('site_settings').select('value').eq('key',setting).maybeSingle();return (r.data?.value??{}) as InboxState;}
export async function syncSupportInbox(force=false){
 const db=createSupabaseAdminClient();const previous=await supportInboxStatus();const now=new Date().toISOString();
 if(!force&&previous.status==='restricted'&&previous.checkedAt&&Date.now()-Date.parse(previous.checkedAt)<3600000)return previous;
 const enabledSince=previous.enabledSince??now;
 const save=async(status:string,queued=0)=>{const state={enabledSince,checkedAt:now,status,queued};const r=await db.from('site_settings').upsert({key:setting,value:state,updated_at:now});if(r.error)throw Error('Stato assistenza non disponibile.');return state;};
 const key=process.env.GENKS_RESEND_RECEIVING_KEY||process.env.RESEND_API_KEY;
 if(!key)return save('not_configured');
 const support=(process.env.GENKS_SUPPORT_EMAIL||'assistenza@prodbygenks.com').toLowerCase(),owner=process.env.GENKS_ADMIN_EMAIL||'prod.genks@gmail.com';
 let cursor='',queued=0,complete=false;
 for(let page=0;page<20;page++){
  const url=new URL('https://api.resend.com/emails/receiving');url.searchParams.set('limit','100');if(cursor)url.searchParams.set('after',cursor);
  const response=await fetch(url,{headers:{Authorization:`Bearer ${key}`},cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(response.status===401||response.status===403)return save('restricted');
  if(!response.ok)return save('unavailable');
  const body=await response.json() as {data?:{id:string;to:string[];from:string;subject:string;created_at:string}[];has_more?:boolean};
  if(!Array.isArray(body.data))return save('unavailable');
  for(const mail of body.data){if(!/^[a-f0-9-]{36}$/i.test(mail.id)||!Array.isArray(mail.to)||!mail.to.some(address=>(address.match(/<([^>]+)>/)?.[1]??address).trim().toLowerCase()===support)||!Number.isFinite(Date.parse(mail.created_at))||Date.parse(mail.created_at)<Date.parse(enabledSince))continue;
   await queueNotification('support-inbox-'+mail.id,{to:owner,subject:'GENKS · Nuova email di assistenza',heading:'Hai un nuovo messaggio di assistenza.',body:`Email del cliente: ${String(mail.from).slice(0,300)}\nOggetto: ${String(mail.subject).slice(0,300)}\nRicevuta da: ${support}`,actionUrl:'https://resend.com/emails/receiving',actionLabel:'Leggi il messaggio su Resend'});queued++;
  }
  if(!body.has_more||!body.data.length||body.data.some(m=>Date.parse(m.created_at)<Date.parse(enabledSince))){complete=true;break;}
  cursor=body.data.at(-1)!.id;await new Promise(resolve=>setTimeout(resolve,600));
 }
 if(!complete)return save('backlog',queued);
 const flushed=await flushNotifications({prefix:'support-inbox-',limit:10});return save(flushed.failures?'delivery_pending':'active',queued);
}
