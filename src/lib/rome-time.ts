const rome = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", timeZoneName: "longOffset" });
const romeDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
const wall = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const wallTimes = new Map<string, number>();

export function todayInRome() { return romeDay.format(new Date()); }

export function fromRomeWallTime(day: string, time: string) {
  const key = `${day}T${time}`;
  if (wallTimes.has(key)) return new Date(wallTimes.get(key)!);
  const naive = new Date(`${day}T${time}:00Z`);
  if (!Number.isFinite(naive.getTime())) return new Date(NaN);
  const candidates: number[] = [];
  for (const hours of [-24, 0, 24]) {
    const zone = rome.formatToParts(new Date(naive.getTime() + hours * 3600000)).find(part => part.type === "timeZoneName")?.value ?? "";
    const match = /GMT([+-])(\d{2}):(\d{2})/.exec(zone);
    if (!match) continue;
    const offset = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1);
    const candidate = naive.getTime() - offset * 60000;
    const p = Object.fromEntries(wall.formatToParts(new Date(candidate)).map(part => [part.type, part.value]));
    if (`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` === key) candidates.push(candidate);
  }
  // PostgreSQL resolves the repeated autumn hour to standard time (the later instant).
  // A missing spring wall time has no valid candidate.
  const result = candidates.length ? Math.max(...candidates) : NaN;
  if (wallTimes.size >= 4096) wallTimes.clear();
  wallTimes.set(key, result);
  return new Date(result);
}
