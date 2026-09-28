const rome = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", timeZoneName: "longOffset" });
const romeDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });

export function todayInRome() { return romeDay.format(new Date()); }

export function fromRomeWallTime(day: string, time: string) {
  const naive = new Date(`${day}T${time}:00Z`);
  if (!Number.isFinite(naive.getTime())) return new Date(NaN);
  const zone = rome.formatToParts(naive).find(part => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(zone);
  if (!match) return new Date(NaN);
  const minutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1);
  return new Date(naive.getTime() - minutes * 60_000);
}
