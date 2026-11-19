// Studio hours of GENKS (as on prodbygenks.com): Monday–Thursday 19:30–00:00, Friday from 19:30,
// Saturday from 10:00, Sunday 10:00–00:00. The visitor picks a preferred start: the real availability
// (the studio calendar) is confirmed by email, so no slot is shown as taken here.

export type DemoDay = { iso: string; label: string; weekday: string; slots: { start: string; free: boolean }[] };

const EVENING = ["19:30", "20:30", "21:30", "22:30"];
const DAY = ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
const STARTS: Record<number, string[]> = {
  0: DAY, 1: EVENING, 2: EVENING, 3: EVENING, 4: EVENING, 5: [...EVENING, "23:30"], 6: DAY,
};

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
      slots: (STARTS[d.getDay()] ?? []).map(start => ({ start, free: true })),
    });
  }
  return out;
}
