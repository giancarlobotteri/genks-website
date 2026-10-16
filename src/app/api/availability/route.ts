import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGoogleBusyRanges, hasGoogleCalendar } from "@/lib/google-calendar";
import { fromRomeWallTime, todayInRome } from "@/lib/rome-time";
import { availableSlots, shiftDay } from "@/lib/booking-slots";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!hasSupabase) return Response.json({ error: "Prenotazioni temporaneamente non disponibili." }, { status: 503 });
  const query = new URL(request.url).searchParams;
  const parsed = z.object({ date: z.iso.date(), duration: z.coerce.number().int().min(1).max(8) }).safeParse({ date: query.get("date"), duration: query.get("duration") ?? 1 });
  if (!parsed.success) return Response.json({ error: "Scegli una data e una durata valide." }, { status: 400 });
  const { date, duration } = parsed.data;
  if (date < todayInRome() || date > shiftDay(todayInRome(), 180)) return Response.json({ slots: [] });
  const db = createSupabaseAdminClient();
  const expired = await db.rpc("expire_booking_holds");
  if (expired.error) return Response.json({ error: "Calendario temporaneamente non disponibile." }, { status: 503 });
  const from = fromRomeWallTime(date, "00:00");
  const to = fromRomeWallTime(shiftDay(date, 1), "23:59");
  const [rules, bookings, blackouts] = await Promise.all([
    db.from("availability_rules").select("weekday,start_time,end_time,ends_next_day,flexible_close,slot_minutes,buffer_minutes").eq("active", true),
    db.from("bookings").select("starts_at,ends_at,blocked_until").in("status", ["pending", "approved_awaiting_payment", "confirmed"]).lt("starts_at", to.toISOString()).gt("blocked_until", from.toISOString()),
    db.from("blackout_dates").select("starts_at,ends_at").lt("starts_at", to.toISOString()).gt("ends_at", from.toISOString()),
  ]);
  if (rules.error || bookings.error || blackouts.error) return Response.json({ error: "Impossibile verificare gli orari. Riprova tra poco." }, { status: 503 });
  try {
    const google = hasGoogleCalendar ? await getGoogleBusyRanges(from, to) : [];
    return Response.json({ slots: availableSlots(date, duration, rules.data ?? [], [...(bookings.data ?? []), ...(blackouts.data ?? []), ...google]) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Il calendario condiviso è temporaneamente non disponibile." }, { status: 503 }); }
}
