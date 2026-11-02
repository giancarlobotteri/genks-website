import {funnelService,type FunnelService} from './funnel';
export const FUNNEL_CONSENT='genks_stats_consent';
const key='genks:funnel:v1';
type Session={id:string;expires:number;sent:string[];service?:FunnelService};
export function hasFunnelConsent(){return typeof document!=='undefined'&&document.cookie.split('; ').includes(FUNNEL_CONSENT+'=v1-yes');}
function session():Session|null{
 if(!hasFunnelConsent())return null;
 try{const saved=JSON.parse(sessionStorage.getItem(key)??'null');const s:Session=saved&&saved.expires>Date.now()?saved:{id:crypto.randomUUID(),expires:0,sent:[]};s.expires=Date.now()+30*60000;sessionStorage.setItem(key,JSON.stringify(s));return s;}catch{return null;}
}
export function funnelContext(){const s=session();return s?{session:s.id,device:window.matchMedia('(pointer: coarse)').matches||innerWidth<768?'mobile' as const:'desktop' as const,service:s.service??'cart'}:undefined;}
export function trackFunnel(step:'service_selected'|'form_started'|'checkout_viewed'|'checkout_error',service?:FunnelService){
 const s=session();if(!s)return;
 const target=service??funnelService(location.pathname,new URLSearchParams(location.search))??s.service??'cart';
 const event=step+':'+target;if(s.sent.includes(event))return;
 s.sent.push(event);if(step==='service_selected')s.service=target;
 try{sessionStorage.setItem(key,JSON.stringify(s));}catch{return;}
 const context=funnelContext();if(!context)return;
 void fetch('/api/funnel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context,step,service:target}),keepalive:true}).catch(()=>{});
}
export function setFunnelConsent(accept:boolean){
 const old=funnelContext();
 if(!accept&&old)void fetch('/api/funnel',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:old.session}),keepalive:true}).catch(()=>{});
 document.cookie=FUNNEL_CONSENT+'=v1-'+(accept?'yes':'no')+'; Path=/; Max-Age=15552000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
 if(!accept)try{sessionStorage.removeItem(key);}catch{}
 window.dispatchEvent(new Event('genks:stats-consent'));
}
