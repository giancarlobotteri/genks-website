"use server";
import { allowPublicRequest } from "@/lib/security/request-limit";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import {saveContactChoice} from "@/lib/customer-contact-server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGoogleBusyRanges, hasGoogleBusyCalendar } from "@/lib/google-calendar";
import { fromRomeWallTime } from "@/lib/rome-time";
import { revalidatePath } from "next/cache";
import { flushNotifications } from "@/lib/notifications";
import { getPublicDiscounts } from "@/lib/public-discounts-server";
import { projectPaymentMethod } from "@/lib/remote-project-policy";

import {buildServiceQuote} from "@/lib/service-quote";
import {reserveServiceOrder,reserveRecordingPayment} from "@/lib/service-checkout";
import {packageByCode} from "@/lib/service-catalog";
import { serviceRateVersion, projectRateVersion } from "@/lib/service-rates";

const text = (min = 1, max = 1000) => z.string().trim().min(min).max(max);

export async function createBooking(formData: FormData) {
  if(formData.get("rateVersion")!=="legacy-disabled") redirect("/services/recording?notice=updated");
  if (!await allowPublicRequest("service")) redirect("/services/recording?error=limit");
  if (!hasSupabase) redirect("/services/recording?error=setup");
  if(formData.get("website"))redirect("/services/recording?error=invalid");
  const parsed = z.object({ name:text(2,120),artistName:z.string().trim().max(120),email:z.email(),phone:text(6,40),date:z.iso.date(),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),duration:z.coerce.number().min(0.25).max(8).multipleOf(0.25),notes:z.string().trim().max(2000).default(""),referenceUrl:z.union([z.literal(""),z.url()]),expectedTotal:z.coerce.number().int().min(50).optional(),payment:z.enum(["card","cash"]).default("cash"),rateVersion:z.literal(serviceRateVersion),accepted:z.literal("on") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/services/recording?error=invalid");

  const start = fromRomeWallTime(parsed.data.date, parsed.data.time); const end = new Date(start.getTime()+parsed.data.duration*3600000);
  if (!Number.isFinite(start.getTime()) || start < new Date()) redirect("/services/recording?error=date");
  const db=createSupabaseAdminClient();
  if (hasGoogleBusyCalendar) {
    const weekday=new Date(`${parsed.data.date}T12:00:00Z`).getUTCDay();
    const rules=await db.from("availability_rules").select("buffer_minutes").eq("active",true).eq("weekday",weekday);
    if(rules.error || !rules.data?.length) redirect("/services/recording?error=calendar");
    const buffer=Math.max(0,...rules.data.map(rule=>Number(rule.buffer_minutes)||0));
    const protectedEnd=new Date(end.getTime()+buffer*60000);
    let busy;
    try {
      busy = await getGoogleBusyRanges(start, protectedEnd);
    } catch { redirect("/services/recording?error=calendar"); }
    if (busy.some((range) => new Date(range.starts_at) < protectedEnd && new Date(range.ends_at) > start)) redirect("/services/recording?error=conflict");
  }
  const user = await getCurrentUser();
  try{await saveContactChoice(formData,user);}catch{redirect("/services/recording?error=contact");}
  if(parsed.data.payment==="card"){
    let url:string;
    try{url=await reserveRecordingPayment({...parsed.data,startsAt:start.toISOString(),customerId:user?.email?.toLowerCase()===parsed.data.email.toLowerCase()?user.id:null},`Registrazione in studio · ${parsed.data.duration} ore · ${parsed.data.date} ${parsed.data.time} (Europe/Rome). Tariffa base 24,99 €/ora; supplemento notturno 9,99 € ogni 30 minuti, già incluso nel totale.`);}
    catch{redirect("/services/recording?error=payment");}
    revalidatePath("/admin/bookings");redirect(url);
  }
  const { data, error } = await db.rpc("reserve_cash_service_v5", {
    p_type: "booking", p_owner_email: "prod.genks@gmail.com",
    p_data: { ...parsed.data, startsAt: start.toISOString(), customerId: user?.email?.toLowerCase() === parsed.data.email.toLowerCase() ? user.id : null },
  });
  if(error||!data) {
    const reason = error?.code==="23P01" || error?.message.includes("booking_conflict") ? "conflict" : error?.message.includes("request_rate_limit") ? "limit" : error?.message.includes("booking_blackout") || error?.message.includes("booking_unavailable") ? "unavailable" : "save";
    redirect(`/services/recording?error=${reason}`);
  }
  const reference = String(data);
  revalidatePath("/admin/bookings");
  await flushReservationNotifications(reference);
  redirect(`/services/recording?success=${reference}`);
}

export async function createProject(formData: FormData) {
  if(formData.get("rateVersion")!=="legacy-disabled") redirect("/services/project?notice=updated");
  if (!await allowPublicRequest("service")) redirect("/services/project?error=limit");
  if (!hasSupabase) redirect("/services/project?error=setup");
  if(formData.get("website"))redirect("/services/project?error=invalid");
  const parsed=z.object({name:text(2,120),artistName:z.string().trim().max(120),email:z.email(),phone:z.string().trim().max(40),mode:z.enum(["studio","remote"]),payment:z.enum(["card","cash"]),expectedTotal:z.coerce.number().int().min(50),rateVersion:z.literal(projectRateVersion),accepted:z.literal("on"),earlyStart:z.preprocess(v=>v==="on",z.boolean()),withdrawalAcknowledged:z.preprocess(v=>v==="on",z.boolean())}).safeParse(Object.fromEntries(formData));
  if(!parsed.success||parsed.data.earlyStart&&!parsed.data.withdrawalAcknowledged||projectPaymentMethod(parsed.data.mode,parsed.data.payment)!==parsed.data.payment)redirect("/services/project?error=invalid");
  const packageCode=String(formData.get("packageCode")??"");const pack=packageByCode(packageCode);
  if(pack?.studio&&parsed.data.mode!=="studio")redirect("/services/project?error=invalid");
  const raw=formData.get("songs");if(typeof raw!=="string"||raw.length>200000)redirect("/services/project?error=invalid");
  let serverQuote:ReturnType<typeof buildServiceQuote>;
  try{serverQuote=buildServiceQuote({songs:JSON.parse(raw),packageCode,rush:formData.get("rush")==="true",earlyStart:parsed.data.earlyStart},await getPublicDiscounts());}catch{redirect("/services/project?error=invalid");}
  if(serverQuote.totalCents!==parsed.data.expectedTotal)redirect("/services/project?error=price");
  const user=await getCurrentUser();
  try{await saveContactChoice(formData,user);}catch{redirect("/services/project?error=contact");}
  let result:{reference:string;url?:string};
  try{result=await reserveServiceOrder({...parsed.data,notes:"",links:serverQuote.songs.flatMap(s=>s.referenceLinks.split(/\s+/).filter(link=>/^https?:\/\//i.test(link))),customerId:user?.email?.toLowerCase()===parsed.data.email.toLowerCase()?user.id:null},serverQuote);}catch{redirect("/services/project?error=remote_payment");}
  revalidatePath("/admin/projects");
  if(result.url)redirect(result.url);
  await flushReservationNotifications(result.reference);
  redirect(`/services/project?success=${result.reference}`);
}

export async function createExclusive(formData: FormData) {
  if (!await allowPublicRequest("service")) redirect("/services/exclusive?error=limit");
  if(!hasSupabase) redirect("/services/exclusive?error=setup");
  const parsed=z.object({beatId:z.uuid(),name:text(2,120),email:z.email(),phone:z.string().trim().max(40),message:z.string().trim().max(2000)}).safeParse(Object.fromEntries(formData));
  if(!parsed.success) redirect("/services/exclusive?error=invalid"); const user=await getCurrentUser();const db=createSupabaseAdminClient();
  const {data,error}=await db.from("exclusive_requests").insert({beat_id:parsed.data.beatId,customer_id:user?.email?.toLowerCase()===parsed.data.email.toLowerCase()?user.id:null,name:parsed.data.name,email:parsed.data.email.toLowerCase(),phone:parsed.data.phone||null,message:parsed.data.message||null}).select("reference,beats(title)").single();
  if(error||!data) redirect("/services/exclusive?error=save"); const beat=Array.isArray(data.beats)?data.beats[0]:data.beats;
  const phone=(process.env.NEXT_PUBLIC_GENKS_WHATSAPP??"").replace(/\D/g,""); const copy=`Ciao Genks, sono interessato alla licenza esclusiva di ${beat?.title??"un beat"}. Riferimento ${data.reference}.`;
  redirect(phone?`https://wa.me/${phone}?text=${encodeURIComponent(copy)}`:`/services/exclusive?success=${data.reference}`);
}

async function flushReservationNotifications(reference: string) {
  // Both messages were queued in the reservation transaction. A failed delivery stays retryable.
  try {
    const db = createSupabaseAdminClient();
    const type = reference.startsWith("BKG-") ? "booking" : "project";
    const request = await db.from(type === "booking" ? "bookings" : "service_projects").select("id").eq("reference", reference).single();
    if (request.error || !request.data) throw new Error("Reservation missing");
    const agreement = await db.from("studio_cash_agreements").select("id").eq(`${type}_id`, request.data.id).single();
    if (agreement.error || !agreement.data) throw new Error("Price snapshot missing");
    await flushNotifications({ prefix: `reservation-${reference}-admin` });
    await new Promise(resolve => setTimeout(resolve, 600));
    await flushNotifications({ prefix: `cash-agree-${agreement.data.id}` });
    if(type === "project") { await new Promise(resolve=>setTimeout(resolve,600)); await flushNotifications({prefix:`contract-${request.data.id}`}); }
  } catch { console.error("Reservation saved; notification delivery will be retried."); }
}
