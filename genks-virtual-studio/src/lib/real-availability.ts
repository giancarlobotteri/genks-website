/**
 * The real studio calendar, shared with prodbygenks.com and the GENKS back office.
 *
 * Source: GET /api/availability?date=YYYY-MM-DD&calendar=1 of the existing backend (app.prodbygenks.com,
 * reached through a same-origin proxy: vite.config.ts locally, vercel.json in production). In calendar
 * mode the backend ignores `duration` and returns 14 days starting at `date`, each with:
 *   - allSlots: every start the opening hours allow (30-minute steps), ignoring bookings;
 *   - durationsBySlot: for each start that is still free, every duration (0.25 h … 8 h, in quarter hours)
 *     that fits without touching a booking, a valid hold, a blackout or the Google busy calendar.
 * A start is bookable for N hours only if durationsBySlot[start] contains N. Nothing here invents slots:
 * if the API does not answer, the caller shows an error.
 *
 * Time helpers below are ports of the backend's own (src/lib/rome-time.ts, booking-slots.ts,
 * recording-selection.ts and studio-scheduler.ts on main), so the browser reads days and times exactly
 * as the server does (Europe/Rome, daylight saving, nights that cross midnight).
 */

export type StudioDay = { date: string; allSlots: string[]; durationsBySlot: Record<string, number[]> };

/** Longest session the backend computes (8 h) and the steps the old site offers (1 h, then +30 min). */
export const MIN_HOURS = 1;
export const MAX_HOURS = 8;
export const HOUR_STEP = 0.5;
export const BOOKING_HORIZON_DAYS = 180;

/* ---- Europe/Rome wall time (port of rome-time.ts) ---- */
const rome = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", timeZoneName: "longOffset" });
const romeDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
const wall = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export const todayInRome = (now = new Date()) => romeDay.format(now);

/** The instant of a Rome wall time; NaN for a time that does not exist (spring change). */
export function fromRomeWallTime(day: string, time: string) {
  const key = `${day}T${time}`;
  const naive = new Date(`${day}T${time}:00Z`);
  if (!Number.isFinite(naive.getTime())) return new Date(NaN);
  const candidates: number[] = [];
  for (const hours of [-24, 0, 24]) {
    const zone = rome.formatToParts(new Date(naive.getTime() + hours * 3600000)).find(p => p.type === "timeZoneName")?.value ?? "";
    const m = /GMT([+-])(\d{2}):(\d{2})/.exec(zone);
    if (!m) continue;
    const offset = (Number(m[2]) * 60 + Number(m[3])) * (m[1] === "+" ? 1 : -1);
    const candidate = naive.getTime() - offset * 60000;
    const p = Object.fromEntries(wall.formatToParts(new Date(candidate)).map(x => [x.type, x.value]));
    if (`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` === key) candidates.push(candidate);
  }
  // as PostgreSQL: the repeated autumn hour resolves to standard time (the later instant)
  return new Date(candidates.length ? Math.max(...candidates) : NaN);
}

export function shiftDay(day: string, offset: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/* ---- Booking rules (ports of recording-selection.ts / studio-scheduler.ts) ---- */

/**
 * Minimum notice before a start: 65 minutes for card payment, 35 for cash. A request from this site is
 * paid afterwards (link or cash), so the stricter card notice is applied.
 */
export const NOTICE_MINUTES = 65;
export function startAllowed(day: string, time: string, now: number) {
  const start = fromRomeWallTime(day, time).getTime();
  return Number.isFinite(start) && start > now + NOTICE_MINUTES * 60000;
}

export function slotAvailable(day: StudioDay | undefined, time: string, hours: number, now: number) {
  return Boolean(day?.durationsBySlot[time]?.includes(hours) && startAllowed(day!.date, time, now));
}
export const availableTimes = (day: StudioDay | undefined, hours: number, now: number) =>
  day ? day.allSlots.filter(t => slotAvailable(day, t, hours, now)) : [];
export const dayHasRoom = (day: StudioDay, hours: number, now: number) => availableTimes(day, hours, now).length > 0;

/** Why a start of the opening hours cannot be booked for `hours` (for the label of a disabled slot). */
export function slotState(day: StudioDay, time: string, hours: number, now: number): "free" | "short" | "busy" | "past" {
  if (!startAllowed(day.date, time, now)) return "past";
  const fits = day.durationsBySlot[time];
  if (!fits?.length) return "busy";
  return fits.includes(hours) ? "free" : "short";
}

export const durationLabel = (hours: number) => {
  const minutes = Math.round(hours * 60), h = Math.floor(minutes / 60), m = minutes % 60;
  return [h ? `${h} ${h === 1 ? "ora" : "ore"}` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
};

export const durationOptions = (max = MAX_HOURS) =>
  Array.from({ length: Math.round((max - MIN_HOURS) / HOUR_STEP) + 1 }, (_, k) => MIN_HOURS + k * HOUR_STEP);

const appointmentFmt = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
/** "ven 20 nov, 23:00 → sab 21 nov, 02:00 · ora italiana" */
export function appointmentLabel(day: string, time: string, hours: number) {
  const start = fromRomeWallTime(day, time);
  if (!Number.isFinite(start.getTime())) return "";
  const end = new Date(start.getTime() + hours * 3600000);
  return `${appointmentFmt.format(start)} → ${appointmentFmt.format(end)} · ora italiana`;
}

/** Starts before 10:00 on Saturday and Sunday belong to the night that began the evening before. */
export const isNightOf = (day: string, time: string) => [6, 0].includes(weekdayOf(day)) && time < "10:00";

/* ---- Fetch ---- */

export class AvailabilityError extends Error {}

/** Fourteen days of the real calendar from `date` (Rome). Throws AvailabilityError, never fakes data. */
export async function fetchCalendar(date: string, signal?: AbortSignal): Promise<StudioDay[]> {
  let r: Response;
  try {
    r = await fetch(`/api/availability?${new URLSearchParams({ date, calendar: "1" })}`, { signal, cache: "no-store", headers: { Accept: "application/json" } });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new AvailabilityError("Il calendario non risponde. Controlla la connessione e riprova.");
  }
  const body = (await r.json().catch(() => null)) as { days?: unknown; slots?: unknown; error?: string } | null;
  if (r.status === 429) throw new AvailabilityError(body?.error ?? "Troppe richieste al calendario. Attendi qualche minuto e riprova.");
  if (!r.ok) throw new AvailabilityError(body?.error ?? "Il calendario dello studio non è disponibile in questo momento. Riprova tra poco.");
  // a date outside the bookable range answers { slots: [] }: no days to show
  if (body && Array.isArray(body.slots) && !body.days) return [];
  if (!body || !Array.isArray(body.days)) throw new AvailabilityError("Risposta del calendario non valida. Riprova tra poco.");
  return (body.days as StudioDay[]).filter(d => typeof d?.date === "string" && Array.isArray(d.allSlots) && d.durationsBySlot && typeof d.durationsBySlot === "object");
}
