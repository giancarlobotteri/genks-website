import {buildRecordingQuote} from "@/lib/recording-quote";
import {getPublicDiscounts} from "@/lib/public-discounts-server";
import "server-only";
import type {ServiceQuote} from "@/lib/service-quote";
import {serviceTerms,serviceTermsVersion} from "@/data/legal";
import {deliveryDateLabel} from "@/lib/service-delivery";
import {serviceAmount} from "@/lib/service-rates";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {getStripe} from "@/lib/stripe";
import {remoteProjectPaymentsReady} from "@/lib/remote-project-payments";
import {previewRecipientAllowed} from "@/lib/preview-mode";
import {flushNotifications} from "@/lib/notifications";

export function serviceQuoteSummary(q:ServiceQuote){return [q.packageName?`Pacchetto: ${q.packageName}`:"SERVIZI ED EXTRA",...q.lines.map(l=>`${l.name}: ${l.quantity} × ${serviceAmount(l.unitAmount)} = ${serviceAmount(l.quantity*l.unitAmount)}`),`Totale: ${serviceAmount(q.totalCents)}`,q.hasProduction?`Prima versione prevista: ${deliveryDateLabel(q.estimatedFirstVersionAt)}. ${q.estimateBasis}`:"",q.studioMinutes?`Ore di studio incluse: ${q.studioMinutes/60}. Gli appuntamenti inclusi si organizzano con GENKS, senza pagare nuovamente le ore già acquistate.`:"",q.validityDays?`Ore da utilizzare entro ${q.validityDays} giorni dal pagamento.`:"",...q.songs.filter(s=>s.fileUrl).map(s=>`File di ${s.trackTitle}: ${s.fileUrl}`)].filter(Boolean).join("\n");}
type Prepared={id:string;project_id?:string;booking_id?:string;reference:string;amount_cents:number;expires_at:string};
async function checkout(prepared:Prepared,email:string,lines:{name:string;quantity:number;unitAmount:number}[],type:"remote_project"|"recording"){
 const origin=process.env.NEXT_PUBLIC_SITE_URL;if(!origin)throw new Error("site_unavailable");
 const db=createSupabaseAdminClient();
 let sessionId:string|undefined;
 try{
 const session=await getStripe().checkout.sessions.create({mode:"payment",locale:"it",payment_method_types:["card"],customer_email:email,
 expires_at:Math.floor(new Date(prepared.expires_at).getTime()/1000),line_items:lines.map(l=>({quantity:l.quantity,price_data:{currency:"eur",unit_amount:l.unitAmount,product_data:{name:`GENKS · ${l.name}`.slice(0,250)}}})),
 success_url:`${origin}/checkout/success?service_session={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/services/${type==="recording"?"recording":"project"}?payment=cancelled`,
 metadata:{quote_id:prepared.id,payment_type:type,...(prepared.project_id?{project_id:prepared.project_id}:{}),...(prepared.booking_id?{booking_id:prepared.booking_id}:{})}},
 {idempotencyKey:`genks-service-v7-${prepared.id}`});
 sessionId=session.id;
 const saved=await db.from("service_quotes").update({stripe_session_id:session.id,checkout_url:session.url,status:"open"}).eq("id",prepared.id).eq("status","creating").select("id").maybeSingle();
 if(saved.error||!saved.data||!session.url){if(session.status==="open")await getStripe().checkout.sessions.expire(session.id);throw new Error("checkout_save");}
 return session.url;
 }catch(error){
 // Preserve the slot if Stripe cannot confirm session expiration. Never free a still-payable booking.
 if(sessionId){try{const session=await getStripe().checkout.sessions.retrieve(sessionId);if(session.status==="complete")throw new Error("payment_pending_verification");if(session.status==="open")await getStripe().checkout.sessions.expire(sessionId);}catch{throw error;}}
 await db.from("service_quotes").update({status:"expired"}).eq("id",prepared.id).eq("status","creating");
 if(prepared.booking_id)await db.from("bookings").update({status:"cancelled"}).eq("id",prepared.booking_id).eq("status","approved_awaiting_payment");
 throw error;
 }
}
export async function reserveServiceOrder(data:Record<string,unknown>,quote:ServiceQuote){
 if(!previewRecipientAllowed(String(data.email)))throw new Error("recipient_not_allowed");
 if(data.payment==="card"&&!await remoteProjectPaymentsReady())throw new Error("card_unavailable");
 const db=createSupabaseAdminClient();
 const result=await db.rpc("reserve_service_order_v7",{p_data:data,p_quote:quote,p_summary:serviceQuoteSummary(quote),p_terms:serviceTerms,p_terms_version:serviceTermsVersion,p_owner_email:"prod.genks@gmail.com"});
 if(result.error||!result.data)throw new Error("order_save");
 const prepared=result.data as Prepared;
 if(data.payment==="cash")return {reference:prepared.reference};
 const url=await checkout(prepared,String(data.email),quote.lines,"remote_project");
 try{await flushNotifications({prefix:`contract-${prepared.project_id}`});}catch{console.error("Contract queued for retry");}
 return {reference:prepared.reference,url};
}
export async function reserveRecordingPayment(data:Record<string,unknown>,summary:string){
 if(!await remoteProjectPaymentsReady()||!previewRecipientAllowed(String(data.email)))throw new Error("card_unavailable");
 const quote=buildRecordingQuote(String(data.date),String(data.time),Number(data.duration),await getPublicDiscounts());
 if(data.expectedTotal!==undefined&&data.expectedTotal!==quote.total)throw new Error("price_changed");
 const db=createSupabaseAdminClient();const result=await db.rpc("reserve_recording_checkout_v7",{p_data:{...data,expectedTotal:quote.total},p_summary:summary+` Totale: ${serviceAmount(quote.total)}.`});
 if(result.error||!result.data)throw new Error(result.error?.message.includes("booking_conflict")?"booking_conflict":"booking_payment_error");
 const prepared=result.data as Prepared;
 if(prepared.amount_cents!==quote.total)throw new Error("quote_mismatch");
 return checkout(prepared,String(data.email),quote.lines,"recording");
}
