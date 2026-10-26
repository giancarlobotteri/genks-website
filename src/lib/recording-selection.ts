import { fromRomeWallTime } from "./rome-time.ts";

export function recordingStartAllowed(day: string, time: string, payment: string, now: number) {
  const start = fromRomeWallTime(day, time).getTime();
  return Number.isFinite(start) && start > now + (payment === "card" ? 35 * 60000 : 24 * 3600000);
}

const appointmentFormat = new Intl.DateTimeFormat("it-IT", {timeZone:"Europe/Rome", weekday:"short", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"});
export function recordingAppointmentLabel(day: string, time: string, hours: number) {
  const start = fromRomeWallTime(day, time);
  if (!Number.isFinite(start.getTime())) return "";
  const end = new Date(start.getTime() + hours * 3600000);
  return `${appointmentFormat.format(start)} → ${appointmentFormat.format(end)} · ora italiana`;
}
