import { allowPublicRequest } from "@/lib/security/request-limit";
import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGoogleBusyRanges, hasGoogleBusyCalendar } from "@/lib/google-calendar";
import { fromRomeWallTime, todayInRome } from "@/lib/rome-time";
import { availableSlots, shiftDay } from "@/lib/booking-slots";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await allowPublicRequest("availability")) return Response.json({error:"Troppe richieste. Attendi qualche minuto e riprova."},{status:429,headers:{"Retry-After":"600","Cache-Control":"no-store"}});
  if (!hasSupabase) return Response.json({ error: "Prenotazioni temporaneamente non disponibili." }, { status: 503 });
  const query = new URL(request.url).searchParams;
  const parsed = z.object({ date: z.iso.date(), duration: z.coerce.number().min(0.25).max(8).multipleOf(0.25) }).safeParse({ date: query.get("date"), duration: query.get("duration") ?? 1 });
  if (!parsed.success) return Response.json({ error: "Scegli una data e una durata valide." }, { status: 400 });
  const { date, duration } = parsed.data;
  if (date < todayInRome() || date > shiftDay(todayInRome(), 180)) return Response.json({ slots: [] });
  const db = createSupabaseAdminClient();
  // A public availability read must never change booking state or queue notifications.
  const asOf = new Date().toISOString();
  const from = fromRomeWallTime(date, "00:00");
  const to = fromRomeWallTime(shiftDay(date, 1), "23:59");
  const [rules, bookings, blackouts] = await Promise.all([
    db.from("availability_rules").select("weekday,start_time,end_time,ends_next_day,flexible_close,slot_minutes,buffer_minutes").eq("active", true),
    db.from("bookings").select("starts_at,ends_at,blocked_until").in("status", ["pending", "approved_awaiting_payment", "confirmed"]).or(`hold_expires_at.is.null,hold_expires_at.gt.${asOf}`).lt("starts_at", to.toISOString()).gt("blocked_until", from.toISOString()),
    db.from("blackout_dates").select("starts_at,ends_at").lt("starts_at", to.toISOString()).gt("ends_at", from.toISOString()),
  ]);
  if (rules.error || bookings.error || blackouts.error) return Response.json({ error: "Impossibile verificare gli orari. Riprova tra poco." }, { status: 503 });
  try {
    const google = hasGoogleBusyCalendar ? await getGoogleBusyRanges(from, to) : [];
    const busy = [...(bookings.data ?? []), ...(blackouts.data ?? []), ...google];
    const now = new Date();
    const durationsBySlot: Record<string, number[]> = {};
    if (query.get("includeDurations") === "1") {
      for (let quarters = 1; quarters <= 32; quarters++) {
        const hours = quarters / 4;
        for (const slot of availableSlots(date, hours, rules.data ?? [], busy, now)) (durationsBySlot[slot] ??= []).push(hours);
      }
    }
    return Response.json({ slots: availableSlots(date, duration, rules.data ?? [], busy, now), ...(query.get("includeDurations") === "1" ? { durationsBySlot } : {}) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Il calendario condiviso è temporaneamente non disponibile." }, { status: 503 }); }
}
