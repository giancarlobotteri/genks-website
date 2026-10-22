import { fromRomeWallTime } from "./rome-time.ts";
export const extraTimePolicy = "Per le sessioni del venerdì e del sabato, dopo mezzanotte si aggiungono 9,99 € ogni 30 minuti alla tariffa base di 24,99 €/ora. Il calcolo è proporzionale ai minuti effettivi. Negli altri giorni la sessione termina entro mezzanotte.";
export function extraTimeCents(dayMinutes: number, nightMinutes: number, hourly = 2499) {
  return Math.round(((dayMinutes+nightMinutes)*hourly)/60) + Math.round(nightMinutes*999/30);
}
export function recordingSessionCents(day: string, time: string, hours: number, hourly: number) {
  if (!day || !time) return Math.max(50,Math.round(hourly*hours));
  const start=fromRomeWallTime(day,time);
  const next=new Date(`${day}T12:00:00Z`); next.setUTCDate(next.getUTCDate()+1);
  const midnight=fromRomeWallTime(next.toISOString().slice(0,10),"00:00");
  const nightMinutes=Math.max(0,(start.getTime()+hours*3600000-midnight.getTime())/60000);
  return Math.max(50,Math.round(hourly*hours)+Math.round(nightMinutes*999/30));
}
