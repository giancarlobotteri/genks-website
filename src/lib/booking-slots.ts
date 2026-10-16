import { fromRomeWallTime } from "./rome-time.ts";

type Rule = { weekday: number; start_time: string; end_time: string; ends_next_day: boolean; flexible_close?: boolean; slot_minutes: number; buffer_minutes: number };
type Busy = { starts_at: string; ends_at: string; blocked_until?: string };
export function shiftDay(day: string, offset: number) {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10);
}
const minutes = (time: string) => Number(time.slice(0,2))*60+Number(time.slice(3,5));

export function availableSlots(day: string, durationHours: number, rules: Rule[], busy: Busy[], now = new Date()) {
  const result = new Set<string>();
  for (const ruleDay of [shiftDay(day,-1),day]) {
    const weekday = new Date(`${ruleDay}T12:00:00Z`).getUTCDay();
    for (const rule of rules.filter(r=>r.weekday===weekday)) {
      const endDay=rule.ends_next_day?shiftDay(ruleDay,1):ruleDay;
      const windowEnd=fromRomeWallTime(endDay,rule.end_time.slice(0,5));
      const closingMinute=minutes(rule.end_time)+(rule.ends_next_day?1440:0);
      for(let minute=minutes(rule.start_time);minute<closingMinute;minute+=rule.slot_minutes) {
        const slotDay=minute>=1440?shiftDay(ruleDay,1):ruleDay;
        if(slotDay!==day)continue;
        const time=`${String(Math.floor(minute%1440/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`;
        const start=fromRomeWallTime(slotDay,time);const end=new Date(start.getTime()+durationHours*3600000);
        if(start<=now||(!rule.flexible_close&&end>windowEnd))continue;
        // Round-trip rejects nonexistent wall times during a DST change.
        const local=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(start);
        if(local!==time)continue;
        const protectedEnd=end.getTime()+rule.buffer_minutes*60000;
        if(!busy.some(b=>new Date(b.starts_at).getTime()<protectedEnd&&new Date(b.blocked_until??b.ends_at).getTime()>start.getTime()))result.add(time);
      }
    }
  }
  return [...result].sort();
}
