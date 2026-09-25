"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendTransactionalEmail } from "@/lib/email";
import { getGoogleBusyRanges, hasGoogleCalendar } from "@/lib/google-calendar";

const text = (min = 1, max = 1000) => z.string().trim().min(min).max(max);

export async function createBooking(formData: FormData) {
  if (!hasSupabase) redirect("/services/recording?error=setup");
  const parsed = z.object({ name:text(2,120),artistName:z.string().trim().max(120),email:z.email(),phone:text(6,40),date:text(10,10),time:text(5,5),duration:z.coerce.number().int().min(1).max(8),notes:z.string().trim().max(2000),referenceUrl:z.union([z.literal(""),z.url()]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/services/recording?error=invalid");
  const start = new Date(`${parsed.data.date}T${parsed.data.time}:00+02:00`); const end = new Date(start.getTime()+parsed.data.duration*3600000);
  if (!Number.isFinite(start.getTime()) || start < new Date()) redirect("/services/recording?error=date");
  if (hasGoogleCalendar) {
    try {
      const busy = await getGoogleBusyRanges(start, end);
      if (busy.some((range) => new Date(range.starts_at) < end && new Date(range.ends_at) > start)) redirect("/services/recording?error=conflict");
    } catch { redirect("/services/recording?error=calendar"); }
  }
  const db=await createSupabaseServerClient();
  const {data,error}=await db.rpc("submit_booking",{p_name:parsed.data.name,p_artist_name:parsed.data.artistName,p_email:parsed.data.email,p_phone:parsed.data.phone,p_starts_at:start.toISOString(),p_ends_at:end.toISOString(),p_notes:parsed.data.notes||null,p_reference_url:parsed.data.referenceUrl||null});
  if(error||!data) {
    const reason = error?.message.includes("booking_conflict") ? "conflict" : error?.message.includes("booking_blackout") || error?.message.includes("booking_unavailable") ? "unavailable" : "save";
    redirect(`/services/recording?error=${reason}`);
  }
  const reference=String(data);
  await sendTransactionalEmail({to:parsed.data.email,subject:`GENKS booking request ${reference}`,heading:"Request received.",body:`Your recording request for ${start.toLocaleString("it-IT")} is pending approval. We’ll contact you before it becomes confirmed.`});
  if(process.env.GENKS_ADMIN_EMAIL) await sendTransactionalEmail({to:process.env.GENKS_ADMIN_EMAIL,subject:`New booking ${reference}`,heading:"New recording request.",body:`${parsed.data.name} requested ${start.toLocaleString("it-IT")}. Open Admin to approve or reschedule.`});
  redirect(`/services/recording?success=${reference}`);
}

export async function createProject(formData: FormData) {
  if (!hasSupabase) redirect("/services/project?error=setup");
  const parsed=z.object({name:text(2,120),artistName:z.string().trim().max(120),email:z.email(),phone:z.string().trim().max(40),trackTitle:text(1,160),service:z.enum(["mix","master","mix_master"]),description:text(10,4000),trackCount:z.coerce.number().int().min(1).max(200),referenceLinks:z.string().trim().max(2000),desiredDeadline:z.string().trim().max(10),notes:z.string().trim().max(2000)}).safeParse(Object.fromEntries(formData));
  if(!parsed.success) redirect("/services/project?error=invalid"); const user=await getCurrentUser();const db=createSupabaseAdminClient();
  const links=parsed.data.referenceLinks.split(/\s+/).filter(Boolean).filter(link=>URL.canParse(link)).slice(0,20);
  const {data,error}=await db.from("service_projects").insert({customer_id:user?.id??null,name:parsed.data.name,artist_name:parsed.data.artistName||null,email:parsed.data.email.toLowerCase(),phone:parsed.data.phone||null,track_title:parsed.data.trackTitle,service:parsed.data.service,description:parsed.data.description,track_count:parsed.data.trackCount,reference_links:links,desired_deadline:parsed.data.desiredDeadline||null,notes:parsed.data.notes||null}).select("reference").single();
  if(error||!data) redirect("/services/project?error=save");
  await sendTransactionalEmail({to:parsed.data.email,subject:`GENKS project request ${data.reference}`,heading:"Project received.",body:"Your request is in review. You’ll receive a quote before any payment or work begins."});
  redirect(`/services/project?success=${data.reference}`);
}

export async function createExclusive(formData: FormData) {
  if(!hasSupabase) redirect("/services/exclusive?error=setup");
  const parsed=z.object({beatId:z.uuid(),name:text(2,120),email:z.email(),phone:z.string().trim().max(40),message:z.string().trim().max(2000)}).safeParse(Object.fromEntries(formData));
  if(!parsed.success) redirect("/services/exclusive?error=invalid"); const user=await getCurrentUser();const db=createSupabaseAdminClient();
  const {data,error}=await db.from("exclusive_requests").insert({beat_id:parsed.data.beatId,customer_id:user?.id??null,name:parsed.data.name,email:parsed.data.email.toLowerCase(),phone:parsed.data.phone||null,message:parsed.data.message||null}).select("reference,beats(title)").single();
  if(error||!data) redirect("/services/exclusive?error=save"); const beat=Array.isArray(data.beats)?data.beats[0]:data.beats;
  const phone=(process.env.NEXT_PUBLIC_GENKS_WHATSAPP??"").replace(/\D/g,""); const copy=`Ciao Genks, sono interessato all'Exclusive License di ${beat?.title??"un beat"}. Riferimento ${data.reference}.`;
  redirect(phone?`https://wa.me/${phone}?text=${encodeURIComponent(copy)}`:`/services/exclusive?success=${data.reference}`);
}
