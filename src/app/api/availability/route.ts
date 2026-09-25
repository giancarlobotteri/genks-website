import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGoogleBusyRanges, hasGoogleCalendar } from "@/lib/google-calendar";

const querySchema = z.object({
  date: z.iso.date(),
  duration: z.coerce.number().int().min(1).max(8).default(1),
});

export async function GET(request: Request) {
  if (!hasSupabase) {
    return Response.json({ error: "Booking availability is not configured." }, { status: 503 });
  }
  const search = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({ date: search.get("date"), duration: search.get("duration") ?? 1 });
  if (!parsed.success) return Response.json({ error: "Choose a valid date." }, { status: 400 });

  const day = new Date(`${parsed.data.date}T12:00:00+02:00`);
  if (!Number.isFinite(day.getTime()) || day < new Date(new Date().toDateString())) {
    return Response.json({ slots: [] });
  }
  const db = await createSupabaseServerClient();
  const weekday = day.getDay();
  const dayStart = new Date(`${parsed.data.date}T00:00:00+02:00`);
  const dayEnd = new Date(`${parsed.data.date}T23:59:59+02:00`);
  let googleBusy: Array<{ starts_at: string; ends_at: string }> = [];
  try { if (hasGoogleCalendar) googleBusy = await getGoogleBusyRanges(dayStart, dayEnd); }
  catch { return Response.json({ error: "The shared studio calendar is temporarily unavailable." }, { status: 503 }); }
  const [{ data: rules }, { data: bookings }, { data: blackouts }] = await Promise.all([
    db.from("availability_rules").select("start_time,end_time,slot_minutes,buffer_minutes").eq("weekday", weekday).eq("active", true),
    db.from("bookings").select("starts_at,ends_at").in("status", ["pending", "approved_awaiting_payment", "confirmed"]).lt("starts_at", dayEnd.toISOString()).gt("ends_at", dayStart.toISOString()),
    db.from("blackout_dates").select("starts_at,ends_at").lt("starts_at", dayEnd.toISOString()).gt("ends_at", dayStart.toISOString()),
  ]);

  const slots: string[] = [];
  for (const rule of rules ?? []) {
    const [startHour, startMinute] = rule.start_time.split(":").map(Number);
    const [endHour, endMinute] = rule.end_time.split(":").map(Number);
    const durationMinutes = parsed.data.duration * 60;
    for (let minutes = startHour * 60 + startMinute; minutes + durationMinutes <= endHour * 60 + endMinute; minutes += rule.slot_minutes + rule.buffer_minutes) {
      const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
      const minute = String(minutes % 60).padStart(2, "0");
      const slotStart = new Date(`${parsed.data.date}T${hour}:${minute}:00+02:00`);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
      const protectedEnd = new Date(slotEnd.getTime() + rule.buffer_minutes * 60_000);
      const blocked = [...(bookings ?? []), ...(blackouts ?? []), ...googleBusy].some((item) => {
        const itemStart = new Date(item.starts_at);
        const itemEnd = new Date(new Date(item.ends_at).getTime() + rule.buffer_minutes * 60_000);
        return itemStart < protectedEnd && itemEnd > slotStart;
      });
      if (!blocked && slotStart > new Date()) slots.push(`${hour}:${minute}`);
    }
  }
  return Response.json({ slots: [...new Set(slots)].sort() });
}
