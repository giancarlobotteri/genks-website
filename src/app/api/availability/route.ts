import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({ date: z.iso.date() });

export async function GET(request: Request) {
  if (!hasSupabase || !process.env.SUPABASE_SECRET_KEY) {
    return Response.json({ error: "Booking availability is not configured." }, { status: 503 });
  }
  const parsed = querySchema.safeParse({ date: new URL(request.url).searchParams.get("date") });
  if (!parsed.success) return Response.json({ error: "Choose a valid date." }, { status: 400 });

  const day = new Date(`${parsed.data.date}T12:00:00+02:00`);
  if (!Number.isFinite(day.getTime()) || day < new Date(new Date().toDateString())) {
    return Response.json({ slots: [] });
  }
  const db = createSupabaseAdminClient();
  const weekday = day.getDay();
  const dayStart = new Date(`${parsed.data.date}T00:00:00+02:00`);
  const dayEnd = new Date(`${parsed.data.date}T23:59:59+02:00`);
  const [{ data: rules }, { data: bookings }, { data: blackouts }] = await Promise.all([
    db.from("availability_rules").select("start_time,end_time,slot_minutes,buffer_minutes").eq("weekday", weekday).eq("active", true),
    db.from("bookings").select("starts_at,ends_at").in("status", ["pending", "approved_awaiting_payment", "confirmed"]).lt("starts_at", dayEnd.toISOString()).gt("ends_at", dayStart.toISOString()),
    db.from("blackout_dates").select("starts_at,ends_at").lt("starts_at", dayEnd.toISOString()).gt("ends_at", dayStart.toISOString()),
  ]);

  const slots: string[] = [];
  for (const rule of rules ?? []) {
    const [startHour, startMinute] = rule.start_time.split(":").map(Number);
    const [endHour, endMinute] = rule.end_time.split(":").map(Number);
    for (let minutes = startHour * 60 + startMinute; minutes + rule.slot_minutes <= endHour * 60 + endMinute; minutes += rule.slot_minutes + rule.buffer_minutes) {
      const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
      const minute = String(minutes % 60).padStart(2, "0");
      const slotStart = new Date(`${parsed.data.date}T${hour}:${minute}:00+02:00`);
      const slotEnd = new Date(slotStart.getTime() + rule.slot_minutes * 60_000);
      const blocked = [...(bookings ?? []), ...(blackouts ?? [])].some((item) => new Date(item.starts_at) < slotEnd && new Date(item.ends_at) > slotStart);
      if (!blocked && slotStart > new Date()) slots.push(`${hour}:${minute}`);
    }
  }
  return Response.json({ slots: [...new Set(slots)].sort() });
}
