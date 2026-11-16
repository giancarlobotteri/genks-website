// Demo availability: deterministic, generated locally, never a real calendar.
// A production adapter would read the studio calendar on the server.

export type DemoDay = { iso: string; label: string; weekday: string; slots: { start: string; free: boolean }[] };

const STARTS: Record<number, string[]> = {
  0: [],
  1: ["15:00", "17:00", "19:00", "21:00"],
  2: ["15:00", "17:00", "19:00", "21:00"],
  3: ["15:00", "17:00", "19:00", "21:00"],
  4: ["15:00", "17:00", "19:00", "21:00"],
  5: ["15:00", "17:00", "19:00", "21:00"],
  6: ["10:00", "12:00", "14:00", "16:00", "18:00"],
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function demoAvailability(from: Date, days = 14): DemoDay[] {
  const fmtDay = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
  const fmtWd = new Intl.DateTimeFormat("it-IT", { weekday: "short" });
  const out: DemoDay[] = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const iso = isoDate(d);
    out.push({
      iso,
      label: fmtDay.format(d),
      weekday: fmtWd.format(d),
      slots: (STARTS[d.getDay()] ?? []).map(start => ({ start, free: hash(iso + start) % 3 !== 0 })),
    });
  }
  return out;
}
