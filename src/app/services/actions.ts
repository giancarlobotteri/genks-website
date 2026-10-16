"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email";
import { getGoogleBusyRanges, hasGoogleCalendar } from "@/lib/google-calendar";
import { fromRomeWallTime } from "@/lib/rome-time";
import { revalidatePath } from "next/cache";
import { flushNotifications, queueNotification } from "@/lib/notifications";

const text = (min = 1, max = 1000) => z.string().trim().min(min).max(max);

export async function createBooking(formData: FormData) {
  if (!hasSupabase) redirect("/services/recording?error=setup");
  if(formData.get("website"))redirect("/services/recording?error=invalid");
  const parsed = z.object({ name:text(2,120),artistName:z.string().trim().max(120),email:z.email(),phone:text(6,40),date:z.iso.date(),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),duration:z.coerce.number().int().min(1).max(8),notes:z.string().trim().max(2000).default(""),referenceUrl:z.union([z.literal(""),z.url()]) }).safeParse(Object.fromEntries(formData));
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
  const expired=await db.rpc("expire_booking_holds");
  if(expired.error)redirect("/services/recording?error=save");
  const {data,error}=await db.from("bookings").insert({reference:`BKG-${crypto.randomUUID().replaceAll("-", "").slice(0,8).toUpperCase()}`,customer_id:user?.email?.toLowerCase()===parsed.data.email.toLowerCase()?user.id:null,service_id:(await db.from("booking_services").select("id").eq("code","recording").eq("active",true).single()).data?.id,name:parsed.data.name,artist_name:parsed.data.artistName||null,email:parsed.data.email.toLowerCase(),phone:parsed.data.phone,starts_at:start.toISOString(),ends_at:end.toISOString(),notes:parsed.data.notes||null,reference_url:parsed.data.referenceUrl||null}).select("reference").single();
  if(error||!data) {
    const reason = error?.code==="23P01" || error?.message.includes("booking_conflict") ? "conflict" : error?.message.includes("request_rate_limit") ? "limit" : error?.message.includes("booking_blackout") || error?.message.includes("booking_unavailable") ? "unavailable" : "save";
    redirect(`/services/recording?error=${reason}`);
  }
  const reference=data.reference;
  revalidatePath("/admin/bookings");
  await notifyService(`request-${reference}-customer`,{to:parsed.data.email,subject:`Richiesta di prenotazione GENKS ${reference}`,heading:"Richiesta ricevuta.",body:`La tua richiesta di registrazione per ${start.toLocaleString("it-IT",{timeZone:"Europe/Rome"})} è in attesa di approvazione. Ti contatteremo prima di confermarla.`});
  if(process.env.GENKS_ADMIN_EMAIL) await notifyService(`request-${reference}-admin`,{to:process.env.GENKS_ADMIN_EMAIL,subject:`Nuova prenotazione ${reference}`,heading:"Nuova richiesta di registrazione.",body:`${parsed.data.name} ha richiesto ${start.toLocaleString("it-IT",{timeZone:"Europe/Rome"})}. Apri il pannello amministratore per approvare o cambiare la data.`});
  redirect(`/services/recording?success=${reference}`);
}

export async function createProject(formData: FormData) {
  if (!hasSupabase) redirect("/services/project?error=setup");
  if(formData.get("website"))redirect("/services/project?error=invalid");
  const parsed=z.object({name:text(2,120),artistName:z.string().trim().max(120),email:z.email(),phone:z.string().trim().max(40),trackTitle:text(1,160),service:z.enum(["mix","master","mix_master"]),description:text(10,4000),trackCount:z.coerce.number().int().min(1).max(200),referenceLinks:z.string().trim().max(2000).default(""),desiredDeadline:z.union([z.literal(""),z.iso.date()]),notes:z.string().trim().max(2000).default("")}).safeParse(Object.fromEntries(formData));
  if(!parsed.success) redirect("/services/project?error=invalid"); const user=await getCurrentUser();const db=createSupabaseAdminClient();
  const links=parsed.data.referenceLinks.split(/\s+/).filter(Boolean).filter(link=>URL.canParse(link)&&["https:","http:"].includes(new URL(link).protocol)).slice(0,20);
  const {data,error}=await db.from("service_projects").insert({customer_id:user?.email?.toLowerCase()===parsed.data.email.toLowerCase()?user.id:null,name:parsed.data.name,artist_name:parsed.data.artistName||null,email:parsed.data.email.toLowerCase(),phone:parsed.data.phone||null,track_title:parsed.data.trackTitle,service:parsed.data.service,description:parsed.data.description,track_count:parsed.data.trackCount,reference_links:links,desired_deadline:parsed.data.desiredDeadline||null,notes:parsed.data.notes||null}).select("reference").single();
  if(error||!data) redirect(`/services/project?error=${error?.message.includes("request_rate_limit")?"limit":"save"}`);
  await notifyService(`request-${data.reference}-customer`,{to:parsed.data.email,subject:`Richiesta di progetto GENKS ${data.reference}`,heading:"Progetto ricevuto.",body:"La richiesta è in valutazione. Riceverai un preventivo prima di qualsiasi pagamento o inizio del lavoro."});
  if(process.env.GENKS_ADMIN_EMAIL) await notifyService(`request-${data.reference}-admin`,{to:process.env.GENKS_ADMIN_EMAIL,subject:`Nuovo progetto ${data.reference}`,heading:"Nuova richiesta di mix o master.",body:`${parsed.data.name} ha richiesto ${parsed.data.service.replaceAll("_", " & ")} per ${parsed.data.trackTitle}. Apri Mix & Master nel pannello amministratore per vedere i dettagli e inviare un preventivo.`});
  revalidatePath("/admin/projects");
  redirect(`/services/project?success=${data.reference}`);
}

export async function createExclusive(formData: FormData) {
  if(!hasSupabase) redirect("/services/exclusive?error=setup");
  const parsed=z.object({beatId:z.uuid(),name:text(2,120),email:z.email(),phone:z.string().trim().max(40),message:z.string().trim().max(2000)}).safeParse(Object.fromEntries(formData));
  if(!parsed.success) redirect("/services/exclusive?error=invalid"); const user=await getCurrentUser();const db=createSupabaseAdminClient();
  const {data,error}=await db.from("exclusive_requests").insert({beat_id:parsed.data.beatId,customer_id:user?.email?.toLowerCase()===parsed.data.email.toLowerCase()?user.id:null,name:parsed.data.name,email:parsed.data.email.toLowerCase(),phone:parsed.data.phone||null,message:parsed.data.message||null}).select("reference,beats(title)").single();
  if(error||!data) redirect("/services/exclusive?error=save"); const beat=Array.isArray(data.beats)?data.beats[0]:data.beats;
  const phone=(process.env.NEXT_PUBLIC_GENKS_WHATSAPP??"").replace(/\D/g,""); const copy=`Ciao Genks, sono interessato alla licenza esclusiva di ${beat?.title??"un beat"}. Riferimento ${data.reference}.`;
  redirect(phone?`https://wa.me/${phone}?text=${encodeURIComponent(copy)}`:`/services/exclusive?success=${data.reference}`);
}

async function notifyService(key:string,input: Parameters<typeof sendTransactionalEmail>[0]) {
  try { await queueNotification(key,input); await flushNotifications({prefix:key}); }
  catch { console.error("Service request saved; notification delivery failed."); }
}
