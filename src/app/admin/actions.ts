"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { hasStripe } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/email";
import { createBookingCalendarEvent, createProjectDeadlineEvent, deleteGoogleCalendarEvent } from "@/lib/google-calendar";

async function audit(action:string,entityType:string,entityId:string,payload?:unknown){const user=await requireAdmin();const db=createSupabaseAdminClient();await db.from("admin_audit_log").insert({admin_id:user.id,action,entity_type:entityType,entity_id:entityId,payload});return db}

export async function createBeat(formData:FormData){const data=z.object({title:z.string().trim().min(1).max(160),slug:z.string().trim().regex(/^[a-z0-9-]+$/),bpm:z.coerce.number().int().min(30).max(300),musicalKey:z.string().trim().min(1).max(20),genre:z.string().trim().min(1).max(60),mood:z.string().trim().min(1).max(60),tags:z.string().trim().max(500),description:z.string().trim().max(3000),status:z.enum(["draft","published"]),featured:z.string().optional(),sortOrder:z.coerce.number().int().min(0).max(10000),publicationDate:z.string().trim().max(10)}).parse(Object.fromEntries(formData));const user=await requireAdmin();const db=createSupabaseAdminClient();const {data:beat,error}=await db.from("beats").insert({title:data.title,slug:data.slug,bpm:data.bpm,musical_key:data.musicalKey,genre:data.genre,mood:data.mood,tags:data.tags.split(",").map(x=>x.trim()).filter(Boolean),description:data.description,status:data.status,featured:data.featured==="on",sort_order:data.sortOrder,published_at:data.status==="published"?(data.publicationDate?new Date(`${data.publicationDate}T12:00:00Z`).toISOString():new Date().toISOString()):null}).select("id").single();if(error||!beat)throw new Error(error?.message??"Beat creation failed");const {data:licenses}=await db.from("license_types").select("id").eq("active",true);if(licenses?.length)await db.from("beat_license_prices").insert(licenses.map(license=>({beat_id:beat.id,license_type_id:license.id})));await db.from("admin_audit_log").insert({admin_id:user.id,action:"create",entity_type:"beat",entity_id:beat.id,payload:{title:data.title}});revalidatePath("/admin/beats");revalidatePath("/")}

export async function createLicense(formData:FormData){const data=z.object({code:z.string().trim().regex(/^[a-z0-9_-]+$/),name:z.string().trim().min(1),price:z.coerce.number().min(0),shortDescription:z.string().trim().max(500),fullDescription:z.string().trim().max(3000),assets:z.string().trim(),streamsLimit:z.string().trim(),monetization:z.string().trim().max(1000),musicVideo:z.string().trim().max(1000),performances:z.string().trim().max(1000),radio:z.string().trim().max(1000),distribution:z.string().trim().max(1000),contentId:z.string().trim().max(1000),contractText:z.string().trim().max(20000),displayOrder:z.coerce.number().int().min(0),exclusive:z.string().optional()}).parse(Object.fromEntries(formData));const db=await audit("create","license",data.code,{name:data.name});const {error}=await db.from("license_types").insert({code:data.code,name:data.name,price_cents:Math.round(data.price*100),short_description:data.shortDescription,full_description:data.fullDescription,included_assets:data.assets.split(",").map(x=>x.trim()).filter(Boolean),streams_limit:data.streamsLimit?Number(data.streamsLimit):null,monetization_permissions:data.monetization||null,music_video_permissions:data.musicVideo||null,performances:data.performances||null,radio:data.radio||null,distribution_restrictions:data.distribution||null,content_id_policy:data.contentId||null,contract_text:data.contractText||null,display_order:data.displayOrder,is_exclusive:data.exclusive==="on"});if(error)throw new Error(error.message);revalidatePath("/admin/licenses")}

export async function createPromotion(formData:FormData){const data=z.object({code:z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]+$/),discountType:z.enum(["percent","fixed"]),amount:z.coerce.number().positive(),expiresAt:z.string().trim(),usageLimit:z.string().trim(),minimumOrder:z.string().trim()}).parse(Object.fromEntries(formData));const db=await audit("create","promotion",data.code);const {error}=await db.from("promo_codes").insert({code:data.code,discount_type:data.discountType,amount:data.discountType==="fixed"?Math.round(data.amount*100):Math.round(data.amount),expires_at:data.expiresAt?new Date(data.expiresAt).toISOString():null,usage_limit:data.usageLimit?Number(data.usageLimit):null,minimum_order_cents:data.minimumOrder?Math.round(Number(data.minimumOrder)*100):null});if(error)throw new Error(error.message);revalidatePath("/admin/promotions")}

export async function updateSiteSetting(formData:FormData){const key=z.enum(["commerce","booking","customer_segments"]).parse(formData.get("key"));const value=z.string().min(2).max(10000).parse(formData.get("value"));let json:unknown;try{json=JSON.parse(value)}catch{throw new Error("Settings must be valid JSON.")}const db=await audit("update","site_setting",key,json);const{error}=await db.from("site_settings").upsert({key,value:json,updated_at:new Date().toISOString()});if(error)throw new Error(error.message);revalidatePath("/admin/settings")}

export async function updateBookingStatus(formData:FormData){
  const id=z.uuid().parse(formData.get("id"));
  const status=z.enum(["approved_awaiting_payment","confirmed","completed","cancelled","rejected","no_show"]).parse(formData.get("status"));
  const db=await audit("status_change","booking",id,{status});
  const {data:current}=await db.from("bookings").select("status,reference,starts_at,ends_at,google_calendar_event_id").eq("id",id).single();
  if(!current)throw new Error("Booking not found.");
  let eventId=current.google_calendar_event_id;
  if(status==="confirmed"&&!eventId)eventId=await createBookingCalendarEvent({id,reference:current.reference,startsAt:current.starts_at,endsAt:current.ends_at});
  if(["cancelled","rejected"].includes(status)&&eventId){await deleteGoogleCalendarEvent(eventId);eventId=null;}
  await db.from("bookings").update({status,google_calendar_event_id:eventId,updated_at:new Date().toISOString()}).eq("id",id);
  await db.from("booking_status_history").insert({booking_id:id,from_status:current.status,to_status:status});
  revalidatePath("/admin/bookings");
}
export async function updateProjectStatus(formData:FormData){
  const id=z.uuid().parse(formData.get("id"));
  const status=z.enum(["quoted","awaiting_payment","paid","in_progress","review","delivered","cancelled"]).parse(formData.get("status"));
  const db=await audit("status_change","project",id,{status});
  const {data:current}=await db.from("service_projects").select("status,reference,service,desired_deadline,google_calendar_event_id").eq("id",id).single();
  if(!current)throw new Error("Project not found.");
  let eventId=current.google_calendar_event_id;
  if(["paid","in_progress"].includes(status)&&current.desired_deadline&&!eventId)eventId=await createProjectDeadlineEvent({id,reference:current.reference,service:current.service,deadline:current.desired_deadline});
  if(status==="cancelled"&&eventId){await deleteGoogleCalendarEvent(eventId);eventId=null;}
  await db.from("service_projects").update({status,google_calendar_event_id:eventId,updated_at:new Date().toISOString()}).eq("id",id);
  await db.from("project_status_history").insert({project_id:id,from_status:current.status,to_status:status});
  revalidatePath("/admin/projects");
}

async function createServicePayment(formData:FormData,type:"booking"|"project"){
  if(!hasStripe) throw new Error("Stripe is not configured.");
  const input=z.object({id:z.uuid(),price:z.coerce.number().positive().max(100000)}).parse(Object.fromEntries(formData));
  const priceCents=Math.round(input.price*100);const db=await audit("payment_request",type,input.id,{priceCents});
  const table=type==="booking"?"bookings":"service_projects";
  const {data}=await db.from(table).select("id,reference,email,name").eq("id",input.id).single();
  if(!data)throw new Error("Request not found.");
  const origin=process.env.NEXT_PUBLIC_SITE_URL;if(!origin)throw new Error("NEXT_PUBLIC_SITE_URL is required for payment links.");
  const session=await getStripe().checkout.sessions.create({mode:"payment",customer_email:data.email,line_items:[{quantity:1,price_data:{currency:"eur",unit_amount:priceCents,product_data:{name:type==="booking"?`GENKS Recording · ${data.reference}`:`GENKS Mix/Master · ${data.reference}`}}}],success_url:`${origin}/checkout/success?${type}=${data.id}`,cancel_url:`${origin}/services`,metadata:{[`${type}_id`]:data.id,payment_type:type}},{idempotencyKey:`${type}_${data.id}_${priceCents}`});
  await db.from(table).update({price_cents:priceCents,status:type==="booking"?"approved_awaiting_payment":"awaiting_payment",updated_at:new Date().toISOString()}).eq("id",data.id);
  await sendTransactionalEmail({to:data.email,subject:`GENKS payment request ${data.reference}`,heading:"Your request is approved.",body:`Complete the secure payment of €${input.price.toFixed(2)} to continue.`,actionUrl:session.url??origin,actionLabel:"Pay securely"});
  revalidatePath(type==="booking"?"/admin/bookings":"/admin/projects");
}
export async function requestBookingPayment(formData:FormData){await createServicePayment(formData,"booking")}
export async function requestProjectPayment(formData:FormData){await createServicePayment(formData,"project")}
export async function markExclusiveSold(formData:FormData){const id=z.uuid().parse(formData.get("id"));const db=await audit("sold","exclusive_request",id);const {data:req}=await db.from("exclusive_requests").update({status:"sold",updated_at:new Date().toISOString()}).eq("id",id).select("beat_id").single();if(req)await db.from("beats").update({status:"exclusive_sold"}).eq("id",req.beat_id);revalidatePath("/admin/exclusive");revalidatePath("/")}
