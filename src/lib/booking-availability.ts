import "server-only";
import { hasSupabase } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGoogleBusyRanges, hasGoogleBusyCalendar } from "@/lib/google-calendar";
import { fromRomeWallTime, todayInRome } from "@/lib/rome-time";
import { availableSlots, shiftDay } from "@/lib/booking-slots";
export async function readBookingAvailability(date:string,duration=1,calendarView=false,includeDurations=false){
 if(!hasSupabase)throw Error("Prenotazioni temporaneamente non disponibili.");
 if(date<todayInRome()||date>shiftDay(todayInRome(),180))return {slots:[]};
 const lastDay=calendarView?shiftDay(date,13):date;
  const db = createSupabaseAdminClient();
  // A public availability read must never change booking state or queue notifications.
  const asOf = new Date().toISOString();
  const from = fromRomeWallTime(date, "00:00");
  const to = fromRomeWallTime(shiftDay(lastDay, 1), "23:59");
  const [rules, bookings, blackouts] = await Promise.all([
    db.from("availability_rules").select("weekday,start_time,end_time,ends_next_day,flexible_close,slot_minutes,buffer_minutes").eq("active", true),
    db.from("bookings").select("starts_at,ends_at,blocked_until").in("status", ["pending", "approved_awaiting_payment", "confirmed"]).or(`hold_expires_at.is.null,hold_expires_at.gt.${asOf}`).lt("starts_at", to.toISOString()).gt("blocked_until", from.toISOString()),
    db.from("blackout_dates").select("starts_at,ends_at").lt("starts_at", to.toISOString()).gt("ends_at", from.toISOString()),
  ]);
  if (rules.error || bookings.error || blackouts.error) throw Error("Impossibile verificare gli orari. Riprova tra poco.");
  try {
    const google = hasGoogleBusyCalendar ? await getGoogleBusyRanges(from, to) : [];
    const busy = [...(bookings.data ?? []), ...(blackouts.data ?? []), ...google];
    const now = new Date();
    if (calendarView) {
      const days = Array.from({ length: 14 }, (_, index) => {
        const day = shiftDay(date, index);
        const durationsBySlot: Record<string, number[]> = {};
        for (let quarters = 1; quarters <= 32; quarters++) {
          for (const slot of availableSlots(day, quarters / 4, rules.data ?? [], busy, now)) (durationsBySlot[slot] ??= []).push(quarters / 4);
        }
        return { date: day, allSlots: availableSlots(day, .25, rules.data ?? [], [], now), durationsBySlot };
      });
      return { days };
    }
    const durationsBySlot: Record<string, number[]> = {};
    if (includeDurations) {
      for (let quarters = 1; quarters <= 32; quarters++) {
        const hours = quarters / 4;
        for (const slot of availableSlots(date, hours, rules.data ?? [], busy, now)) (durationsBySlot[slot] ??= []).push(hours);
      }
    }
    return { slots: availableSlots(date, duration, rules.data ?? [], busy, now), ...(includeDurations ? { durationsBySlot } : {}) };
  } catch { throw Error("Il calendario condiviso è temporaneamente non disponibile."); }
}
