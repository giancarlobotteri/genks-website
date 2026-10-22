"use server";
import { allowPublicRequest } from "@/lib/security/request-limit";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGoogleBusyRanges, hasGoogleBusyCalendar } from "@/lib/google-calendar";
import { fromRomeWallTime } from "@/lib/rome-time";
import { revalidatePath } from "next/cache";
import { flushNotifications } from "@/lib/notifications";
import { getPublicDiscounts } from "@/lib/public-discounts-server";
import { projectPaymentMethod } from "@/lib/remote-project-policy";
import { priceProjectSongs, type PricedProjectSong } from "@/lib/project-songs";
import {buildServiceQuote} from "@/lib/service-quote";
import { openRemoteProjectPayment } from "@/lib/remote-project-payments";
import { serviceRateVersion, projectRateVersion, projectPrice } from "@/lib/service-rates";

const text = (min = 1, max = 1000) => z.string().trim().min(min).max(max);

export async function createBooking(formData: FormData) {
  if (!await allowPublicRequest("service")) redirect("/services/recording?error=limit");
  if (!hasSupabase) redirect("/services/recording?error=setup");
  if(formData.get("website"))redirect("/services/recording?error=invalid");
  const parsed = z.object({ name:text(2,120),artistName:z.string().trim().max(120),email:z.email(),phone:text(6,40),date:z.iso.date(),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),duration:z.coerce.number().min(0.25).max(8).multipleOf(0.25),notes:z.string().trim().max(2000).default(""),referenceUrl:z.union([z.literal(""),z.url()]),expectedTotal:z.coerce.number().int().min(50).optional(),rateVersion:z.literal(serviceRateVersion),accepted:z.literal("on") }).safeParse(Object.fromEntries(formData));
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
  if (!await allowPublicRequest("service")) redirect("/services/project?error=limit");
  if (!hasSupabase) redirect("/services/project?error=setup");
  if(formData.get("website"))redirect("/services/project?error=invalid");
  let songs: PricedProjectSong[] | null = null;
  if (formData.has("songs")) {
    const raw = formData.get("songs");
    if (typeof raw !== "string" || raw.length > 200000) redirect("/services/project?error=invalid");
    try { songs = priceProjectSongs(String(formData.get("service")), JSON.parse(raw), await getPublicDiscounts()); } catch { songs = null; }
    if (!songs) redirect("/services/project?error=invalid");
    formData.set("service", songs[0].service!);
    for (const key of ["trackTitle", "trackCount", "description", "referenceLinks", "notes", "desiredDeadline"] as const) formData.set(key, String(songs[0][key]));
  }
  const parsed=z.object({name:text(2,120),artistName:z.string().trim().max(120),email:z.email(),phone:z.string().trim().max(40),trackTitle:text(1,160),service:z.enum(["mix","master","mix_master"]),description:text(10,4000),trackCount:z.coerce.number().int().min(1).max(200),referenceLinks:z.string().trim().max(2000).default(""),desiredDeadline:z.union([z.literal(""),z.iso.date()]),notes:z.string().trim().max(2000).default(""),mode:z.enum(["studio","remote"]),payment:z.enum(["card","cash"]).optional(),expectedTotal:z.coerce.number().int().min(50).optional(),rateVersion:z.literal(projectRateVersion),accepted:z.literal("on"),earlyStart:z.preprocess(v=>v==="on",z.boolean()),withdrawalAcknowledged:z.preprocess(v=>v==="on",z.boolean())}).safeParse(Object.fromEntries(formData));
  if(!parsed.success || projectPrice(parsed.data.service,parsed.data.trackCount) === null || parsed.data.earlyStart && !parsed.data.withdrawalAcknowledged) redirect("/services/project?error=invalid"); const user=await getCurrentUser();
  let serverQuote:ReturnType<typeof buildServiceQuote>;
  try {
    if(!formData.has("songs"))throw new Error("songs_required");
    serverQuote=buildServiceQuote({songs:JSON.parse(String(formData.get("songs"))),packageCode:String(formData.get("packageCode")??""),rush:formData.get("rush")==="true",earlyStart:parsed.data.earlyStart},await getPublicDiscounts());
    if(parsed.data.expectedTotal!==serverQuote.totalCents)throw new Error("price_changed");
    songs=serverQuote.songs;
  }catch{redirect("/services/project?error=invalid");}
  const links=parsed.data.referenceLinks.split(/\s+/).filter(Boolean).filter(link=>URL.canParse(link)&&["https:","http:"].includes(new URL(link).protocol)).slice(0,20);
  const payment = projectPaymentMethod(parsed.data.mode, parsed.data.payment);
  if (payment!=="card") redirect("/services/project?error=invalid");
  if (payment === "card") {
    let checkoutUrl: string;
    try {
      checkoutUrl = await openRemoteProjectPayment({ ...parsed.data, links, songs, serverQuote, customerId: user?.email?.toLowerCase() === parsed.data.email.toLowerCase() ? user.id : null });
    } catch { redirect("/services/project?error=remote_payment"); }
    revalidatePath("/admin/projects");
    redirect(checkoutUrl);
  }
  redirect("/services/project?error=invalid");
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
