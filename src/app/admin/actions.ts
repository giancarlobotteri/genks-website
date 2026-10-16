"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasStripe } from "@/lib/env";
import { privatePreview, previewRecipientAllowed, stripeTestMode } from "@/lib/preview-mode";
import { ensureOrderConfirmationEmail } from "@/lib/order-confirmation";
import { redirect } from "next/navigation";
import { createBookingCalendarEvent, createProjectDeadlineEvent, deleteGoogleCalendarEvent } from "@/lib/google-calendar";
import { issueServicePayment, expireServiceQuotes } from "@/lib/service-payments";
import { flushNotifications } from "@/lib/notifications";
import { canChangeServiceStatus } from "@/lib/service-workflow";
import { fromRomeWallTime } from "@/lib/rome-time";
import { configureStripeEvents } from "@/lib/stripe-readiness";

async function audit(action:string,entityType:string,entityId:string,payload?:unknown){const user=await requireAdmin();const db=createSupabaseAdminClient();await db.from("admin_audit_log").insert({admin_id:user.id,action,entity_type:entityType,entity_id:entityId,payload});return db}

export async function createBeat(formData:FormData){const data=z.object({title:z.string().trim().min(1).max(160),slug:z.string().trim().regex(/^[a-z0-9-]+$/),bpm:z.coerce.number().int().min(30).max(300),musicalKey:z.string().trim().min(1).max(20),genre:z.string().trim().min(1).max(60),mood:z.string().trim().min(1).max(60),tags:z.string().trim().max(500),description:z.string().trim().max(3000),status:z.enum(["draft","published"]),featured:z.string().optional(),sortOrder:z.coerce.number().int().min(0).max(10000),publicationDate:z.string().trim().max(10)}).parse(Object.fromEntries(formData));const user=await requireAdmin();const db=createSupabaseAdminClient();const {data:beat,error}=await db.from("beats").insert({title:data.title,slug:data.slug,bpm:data.bpm,musical_key:data.musicalKey,genre:data.genre,mood:data.mood,tags:data.tags.split(",").map(x=>x.trim()).filter(Boolean),description:data.description,status:data.status,featured:data.featured==="on",sort_order:data.sortOrder,published_at:data.status==="published"?(data.publicationDate?new Date(`${data.publicationDate}T12:00:00Z`).toISOString():new Date().toISOString()):null}).select("id").single();if(error||!beat)throw new Error(error?.message??"Creazione del beat non riuscita");const {data:licenses}=await db.from("license_types").select("id").eq("active",true);if(licenses?.length)await db.from("beat_license_prices").insert(licenses.map(license=>({beat_id:beat.id,license_type_id:license.id})));await db.from("admin_audit_log").insert({admin_id:user.id,action:"create",entity_type:"beat",entity_id:beat.id,payload:{title:data.title}});revalidatePath("/admin/beats");revalidatePath("/")}

const licenseSchema=z.object({code:z.string().trim().max(50).regex(/^[a-z0-9_-]+$/),name:z.string().trim().min(1),price:z.coerce.number().min(0).max(100000),shortDescription:z.string().trim().max(500),fullDescription:z.string().trim().max(3000),assets:z.string().trim(),streamsLimit:z.string().trim().refine(value=>value===""||/^\d+$/.test(value)),monetization:z.string().trim().max(1000),musicVideo:z.string().trim().max(1000),performances:z.string().trim().max(1000),radio:z.string().trim().max(1000),distribution:z.string().trim().max(1000),contentId:z.string().trim().max(1000),contractText:z.string().trim().max(20000),displayOrder:z.coerce.number().int().min(0),exclusive:z.string().optional(),active:z.string().optional()});
function licensePayload(data:z.infer<typeof licenseSchema>){return{code:data.code,name:data.name,price_cents:Math.round(data.price*100),short_description:data.shortDescription,full_description:data.fullDescription,included_assets:data.assets.split(",").map(x=>x.trim()).filter(Boolean),streams_limit:data.streamsLimit?Number(data.streamsLimit):null,monetization_permissions:data.monetization||null,music_video_permissions:data.musicVideo||null,performances:data.performances||null,radio:data.radio||null,distribution_restrictions:data.distribution||null,content_id_policy:data.contentId||null,contract_text:data.contractText||null,display_order:data.displayOrder,is_exclusive:data.exclusive==="on",active:data.active==="on"}}
export async function createLicense(formData:FormData){const data=licenseSchema.parse(Object.fromEntries(formData));const db=await audit("create","license",data.code,{name:data.name});const{data:license,error}=await db.from("license_types").insert(licensePayload(data)).select("id").single();if(error||!license)throw new Error(error?.message??"Creazione della licenza non riuscita");const{data:beats}=await db.from("beats").select("id");if(beats?.length)await db.from("beat_license_prices").insert(beats.map(beat=>({beat_id:beat.id,license_type_id:license.id,active:true})));revalidatePath("/admin/licenses");revalidatePath("/","layout")}
export async function updateLicense(formData:FormData){const id=z.uuid().parse(formData.get("id"));const data=licenseSchema.parse(Object.fromEntries(formData));const db=await audit("update","license",id,{code:data.code,name:data.name});const{error}=await db.from("license_types").update({...licensePayload(data),updated_at:new Date().toISOString()}).eq("id",id);if(error)throw new Error(error.message);revalidatePath("/admin/licenses");revalidatePath("/","layout")}

export async function createPromotion(formData:FormData){const data=z.object({code:z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]+$/),discountType:z.enum(["percent","fixed"]),amount:z.coerce.number().positive(),expiresAt:z.string().trim(),usageLimit:z.string().trim(),minimumOrder:z.string().trim()}).parse(Object.fromEntries(formData));if(data.discountType==="percent"&&data.amount>100)throw new Error("La percentuale non può superare 100.");const db=await audit("create","promotion",data.code);const {error}=await db.from("promo_codes").insert({code:data.code,discount_type:data.discountType,amount:data.discountType==="fixed"?Math.round(data.amount*100):Math.round(data.amount),expires_at:data.expiresAt?new Date(data.expiresAt).toISOString():null,usage_limit:data.usageLimit?Number(data.usageLimit):null,minimum_order_cents:data.minimumOrder?Math.round(Number(data.minimumOrder)*100):null});if(error)throw new Error(error.message);revalidatePath("/admin/promotions")}

export async function setPromotionActive(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const active = z.enum(["true", "false"]).parse(formData.get("active")) === "true";
  const db = await audit(active ? "activate" : "deactivate", "promotion", id);
  const { error } = await db.from("promo_codes").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/promotions");
}

export async function updateSiteSetting(formData:FormData){const key=z.enum(["commerce","booking","customer_segments"]).parse(formData.get("key"));const value=z.string().min(2).max(10000).parse(formData.get("value"));let json:unknown;try{json=JSON.parse(value)}catch{throw new Error("Le impostazioni devono essere in formato JSON valido.")}const db=await audit("update","site_setting",key,json);const{error}=await db.from("site_settings").upsert({key,value:json,updated_at:new Date().toISOString()});if(error)throw new Error(error.message);revalidatePath("/admin/settings")}

export async function updateBookingStatus(formData:FormData){
  const id=z.uuid().parse(formData.get("id"));
  const status=z.enum(["pending","approved_awaiting_payment","confirmed","completed","cancelled","rejected","no_show"]).parse(formData.get("status"));
  const db=await audit("status_change","booking",id,{status});
  const {data:current}=await db.from("bookings").select("status,reference,starts_at,ends_at,google_calendar_event_id,hold_expires_at").eq("id",id).single();
  if(!current)throw new Error("Prenotazione non trovata.");
  if(!canChangeServiceStatus("booking",current.status,status))redirect("/admin/bookings?notice=invalid_status");
  if(["cancelled","rejected"].includes(status)){try{await expireServiceQuotes("booking",id)}catch{redirect("/admin/bookings?notice=status_error")}}
  let eventId=current.google_calendar_event_id;
  if(status==="confirmed"&&!eventId)eventId=await createBookingCalendarEvent({id,reference:current.reference,startsAt:current.starts_at,endsAt:current.ends_at});
  if(["cancelled","rejected"].includes(status)&&eventId){await deleteGoogleCalendarEvent(eventId);eventId=null;}
  const {data:changed,error}=await db.from("bookings").update({status,google_calendar_event_id:eventId,hold_expires_at:status==="pending"?(current.status==="pending"?current.hold_expires_at:new Date(Date.now()+48*3600000).toISOString()):status==="approved_awaiting_payment"?current.hold_expires_at:null,updated_at:new Date().toISOString()}).eq("id",id).eq("status",current.status).select("id").maybeSingle();if(error||!changed)redirect("/admin/bookings?notice=status_error");
  if(status==="cancelled")await db.from("payments").update({review_reason:"Sessione annullata: verificare l’eventuale rimborso in Stripe."}).eq("booking_id",id).eq("status","succeeded");
  await db.from("booking_status_history").insert({booking_id:id,from_status:current.status,to_status:status});
  await flushNotifications({prefix:`status-bookings-${id}`});
  revalidatePath("/admin/bookings");
}
export async function updateProjectStatus(formData:FormData){
  const id=z.uuid().parse(formData.get("id"));
  const status=z.enum(["requested","quoted","awaiting_payment","paid","in_progress","review","delivered","cancelled"]).parse(formData.get("status"));
  const db=await audit("status_change","project",id,{status});
  const {data:current}=await db.from("service_projects").select("status,reference,service,agreed_deadline,google_calendar_event_id").eq("id",id).single();
  if(!current)throw new Error("Progetto non trovato.");
  if(!canChangeServiceStatus("project",current.status,status))redirect("/admin/projects?notice=invalid_status");
  if(["quoted","cancelled"].includes(status)){try{await expireServiceQuotes("project",id)}catch{redirect("/admin/projects?notice=status_error")}}
  let eventId=current.google_calendar_event_id;
  if(["paid","in_progress"].includes(status)&&current.agreed_deadline&&!eventId)eventId=await createProjectDeadlineEvent({id,reference:current.reference,service:current.service,deadline:current.agreed_deadline});
  if(status==="cancelled"&&eventId){await deleteGoogleCalendarEvent(eventId);eventId=null;}
  const {data:changed,error}=await db.from("service_projects").update({status,google_calendar_event_id:eventId,updated_at:new Date().toISOString()}).eq("id",id).eq("status",current.status).select("id").maybeSingle();if(error||!changed)redirect("/admin/projects?notice=status_error");
  if(status==="cancelled")await db.from("payments").update({review_reason:"Progetto annullato: verificare l’eventuale rimborso in Stripe."}).eq("project_id",id).eq("status","succeeded");
  await db.from("project_status_history").insert({project_id:id,from_status:current.status,to_status:status});
  await flushNotifications({prefix:`status-service_projects-${id}`});
  revalidatePath("/admin/projects");
}

async function createServicePayment(formData:FormData,type:"booking"|"project"){
  await requireAdmin();
  const path=type==="booking"?"/admin/bookings":"/admin/projects";
  const parsed=z.object({id:z.uuid(),price:z.coerce.number().min(0.5).max(100000),scope:z.string().trim().min(10).max(2000),revisions:z.coerce.number().int().min(0).max(50),deadline:z.union([z.literal(""),z.iso.date()]).default("")}).safeParse(Object.fromEntries(formData));
  if(!parsed.success)redirect(`${path}?notice=invalid_quote`);
  let notice="quote_sent";
  try {
    if(!hasStripe)throw new Error("Stripe non configurato");
    if(privatePreview&&!stripeTestMode())throw new Error("Anteprima privata");
    await audit("payment_request",type,parsed.data.id,{priceCents:Math.round(parsed.data.price*100)});
    const result=await issueServicePayment({type,id:parsed.data.id,priceCents:Math.round(parsed.data.price*100),scope:parsed.data.scope,revisions:parsed.data.revisions,deadline:parsed.data.deadline||null});
    if(result.failures)notice="email_pending";
  } catch { notice="quote_error"; }
  revalidatePath(path);
  redirect(`${path}?notice=${notice}`);
}
export async function requestBookingPayment(formData:FormData){await createServicePayment(formData,"booking")}
export async function requestProjectPayment(formData:FormData){await createServicePayment(formData,"project")}

export async function retryNotifications() {
  await requireAdmin();
  await flushNotifications({limit:30});
  revalidatePath("/admin");redirect("/admin?notice=retried");
}
export async function repairStripeConfiguration() {
  await requireAdmin();
  try { await configureStripeEvents(); } catch { redirect("/admin/settings?notice=stripe_error"); }
  revalidatePath("/admin/settings");redirect("/admin/settings?notice=stripe_configured");
}

export async function createBlackout(form:FormData) {
  await requireAdmin();
  const parsed=z.object({start:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),end:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),reason:z.string().trim().max(200)}).safeParse(Object.fromEntries(form));
  if(!parsed.success)redirect("/admin/bookings?notice=status_error");
  const start=fromRomeWallTime(parsed.data.start.slice(0,10),parsed.data.start.slice(11));
  const end=fromRomeWallTime(parsed.data.end.slice(0,10),parsed.data.end.slice(11));
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)redirect("/admin/bookings?notice=status_error");
  const db=await audit("blackout","calendar",parsed.data.start);
  const result=await db.rpc("create_studio_blackout",{p_start:start.toISOString(),p_end:end.toISOString(),p_reason:parsed.data.reason});
  if(result.error)redirect("/admin/bookings?notice=blackout_conflict");
  revalidatePath("/admin/bookings");
}
export async function deleteBlackout(form:FormData) {
  const id=z.uuid().parse(form.get("id"));const db=await audit("remove_blackout","calendar",id);
  const {error}=await db.from("blackout_dates").delete().eq("id",id);if(error)throw new Error("Impossibile rimuovere il blocco.");
  revalidatePath("/admin/bookings");
}
export async function deliverProject(form:FormData) {
  await requireAdmin();
  const parsed=z.object({id:z.uuid(),url:z.url().refine(value=>value.startsWith("https://"))}).safeParse(Object.fromEntries(form));
  if(!parsed.success)redirect("/admin/projects?notice=status_error");
  const db=await audit("deliver","project",parsed.data.id);
  const result=await db.rpc("deliver_service_project",{p_id:parsed.data.id,p_url:parsed.data.url});
  if(result.error)redirect("/admin/projects?notice=status_error");
  await flushNotifications({prefix:`delivery-${parsed.data.id}`});
  revalidatePath("/admin/projects");revalidatePath("/account/projects");redirect("/admin/projects?notice=delivered");
}
export async function createBusinessCost(form:FormData) {
  await requireAdmin();
  const parsed=z.object({description:z.string().trim().min(2).max(300),amount:z.coerce.number().positive().max(1000000),day:z.iso.date(),category:z.enum(["studio","software","marketing","collaborators","other"])}).safeParse(Object.fromEntries(form));
  if(!parsed.success)redirect("/admin/analytics?notice=invalid_cost");
  const db=await audit("create_cost","business_cost",parsed.data.day);
  const result=await db.from("business_costs").insert({description:parsed.data.description,amount_cents:Math.round(parsed.data.amount*100),incurred_on:parsed.data.day,category:parsed.data.category});
  if(result.error)throw new Error("Impossibile registrare il costo.");revalidatePath("/admin/analytics");
}
export async function deleteBusinessCost(form:FormData) {
  const id=z.uuid().parse(form.get("id"));const db=await audit("delete_cost","business_cost",id);
  const {error}=await db.from("business_costs").delete().eq("id",id);if(error)throw new Error("Impossibile rimuovere il costo.");revalidatePath("/admin/analytics");
}
export async function markExclusiveSold(formData:FormData){const id=z.uuid().parse(formData.get("id"));const db=await audit("sold","exclusive_request",id);const {data:req}=await db.from("exclusive_requests").update({status:"sold",updated_at:new Date().toISOString()}).eq("id",id).select("beat_id").single();if(req)await db.from("beats").update({status:"exclusive_sold"}).eq("id",req.beat_id);revalidatePath("/admin/exclusive");revalidatePath("/")}

export async function retryOrderConfirmation(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(formData.get("id"));
  const db = createSupabaseAdminClient();
  const { data: order } = await db.from("orders").select("customer_email,status").eq("id", id).single();
  if (!order || order.status !== "paid" || !previewRecipientAllowed(order.customer_email))
    redirect("/admin/orders?email=not_allowed");
  try {
    await ensureOrderConfirmationEmail(id);
  } catch {
    revalidatePath("/admin/orders");
    redirect("/admin/orders?email=failed");
  }
  revalidatePath("/admin/orders");
  redirect("/admin/orders?email=sent");
}

export async function deleteLicense(formData: FormData) {
  const id=z.uuid().parse(formData.get("id")); const db=await audit("delete","license",id);
  const {count,error:countError}=await db.from("order_items").select("id",{head:true,count:"exact"}).eq("license_type_id",id);
  if(countError)throw new Error("Impossibile verificare gli acquisti della licenza.");
  if(count){await db.from("license_types").update({active:false}).eq("id",id);}
  else {const {error}=await db.from("license_types").delete().eq("id",id);if(error)throw new Error("Impossibile eliminare la licenza. Disattivala per rimuoverla dal catalogo.");}
  revalidatePath("/","layout");
}

export async function updateBeatDetails(formData: FormData) {
  const user=await requireAdmin();
  const input=z.object({id:z.uuid(),title:z.string().trim().min(1).max(160),slug:z.string().trim().regex(/^[a-z0-9-]+$/),bpm:z.coerce.number().int().min(30).max(300),musicalKey:z.string().trim().min(1).max(20),genre:z.string().trim().min(1).max(60),mood:z.string().trim().min(1).max(60),description:z.string().trim().max(3000),status:z.enum(["draft","published","archived","exclusive_sold"]),featured:z.string().optional()}).parse(Object.fromEntries(formData));
  const db=createSupabaseAdminClient();
  const {error}=await db.from("beats").update({title:input.title,slug:input.slug,bpm:input.bpm,musical_key:input.musicalKey,genre:input.genre,mood:input.mood,description:input.description,status:input.status,featured:input.featured==="on",updated_at:new Date().toISOString()}).eq("id",input.id);
  if(error)throw new Error("Salvataggio del beat non riuscito. Controlla che l’indirizzo non sia già usato.");
  await db.from("admin_audit_log").insert({admin_id:user.id,action:"update",entity_type:"beat",entity_id:input.id});
  revalidatePath("/","layout");
}
