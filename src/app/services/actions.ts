"use server";
import { allowPublicRequest } from "@/lib/security/request-limit";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGoogleBusyRanges, hasGoogleCalendar } from "@/lib/google-calendar";
import { fromRomeWallTime } from "@/lib/rome-time";
import { revalidatePath } from "next/cache";
import { flushNotifications } from "@/lib/notifications";
import { serviceRateVersion } from "@/lib/service-rates";

const text = (min = 1, max = 1000) => z.string().trim().min(min).max(max);

export async function createBooking(formData: FormData) {
  if (!await allowPublicRequest("service")) redirect("/services/recording?error=limit");
  if (!hasSupabase) redirect("/services/recording?error=setup");
  if(formData.get("website"))redirect("/services/recording?error=invalid");
  const parsed = z.object({ name:text(2,120),artistName:z.string().trim().max(120),email:z.email(),phone:text(6,40),date:z.iso.date(),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),duration:z.coerce.number().refine(value => [1,2,3,4,6,8].includes(value)),notes:z.string().trim().max(2000).default(""),referenceUrl:z.union([z.literal(""),z.url()]),rateVersion:z.literal(serviceRateVersion),accepted:z.literal("on") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/services/recording?error=invalid");

  const start = fromRomeWallTime(parsed.data.date, parsed.data.time); const end = new Date(start.getTime()+parsed.data.duration*3600000);
  if (!Number.isFinite(start.getTime()) || start < new Date()) redirect("/services/recording?error=date");
  if (hasGoogleCalendar) {
    let busy;
    try {
      busy = await getGoogleBusyRanges(start, end);
    } catch { redirect("/services/recording?error=calendar"); }
    if (busy.some((range) => new Date(range.starts_at) < end && new Date(range.ends_at) > start)) redirect("/services/recording?error=conflict");
  }
  const user = await getCurrentUser();
  const db=createSupabaseAdminClient();
  const { data, error } = await db.rpc("reserve_cash_service", {
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
  const parsed=z.object({name:text(2,120),artistName:z.string().trim().max(120),email:z.email(),phone:z.string().trim().max(40),trackTitle:text(1,160),service:z.enum(["mix","master","mix_master"]),description:text(10,4000),trackCount:z.coerce.number().int().min(1).max(200),referenceLinks:z.string().trim().max(2000).default(""),desiredDeadline:z.union([z.literal(""),z.iso.date()]),notes:z.string().trim().max(2000).default(""),mode:z.enum(["studio","remote"]),rateVersion:z.literal(serviceRateVersion),accepted:z.literal("on")}).safeParse(Object.fromEntries(formData));
  if(!parsed.success) redirect("/services/project?error=invalid"); const user=await getCurrentUser();const db=createSupabaseAdminClient();
  const links=parsed.data.referenceLinks.split(/\s+/).filter(Boolean).filter(link=>URL.canParse(link)&&["https:","http:"].includes(new URL(link).protocol)).slice(0,20);
  const {data,error}=await db.rpc("reserve_cash_service", {
    p_type: "project", p_owner_email: "prod.genks@gmail.com",
    p_data: { ...parsed.data, links, customerId: user?.email?.toLowerCase() === parsed.data.email.toLowerCase() ? user.id : null },
  });
  if(error||!data) redirect(`/services/project?error=${error?.message.includes("request_rate_limit")?"limit":"save"}`);
  await flushReservationNotifications(String(data));
  revalidatePath("/admin/projects");
  redirect(`/services/project?success=${String(data)}`);
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
  } catch { console.error("Reservation saved; notification delivery will be retried."); }
}
