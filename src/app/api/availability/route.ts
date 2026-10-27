import {readBookingAvailability} from "@/lib/booking-availability";
import {todayInRome} from "@/lib/rome-time";
import { allowPublicRequest } from "@/lib/security/request-limit";
import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import { shiftDay } from "@/lib/booking-slots";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await allowPublicRequest("availability")) return Response.json({error:"Troppe richieste. Attendi qualche minuto e riprova."},{status:429,headers:{"Retry-After":"600","Cache-Control":"no-store"}});
  if (!hasSupabase) return Response.json({ error: "Prenotazioni temporaneamente non disponibili." }, { status: 503 });
  const query = new URL(request.url).searchParams;
  const parsed = z.object({ date: z.iso.date(), duration: z.coerce.number().min(0.25).max(8).multipleOf(0.25) }).safeParse({ date: query.get("date"), duration: query.get("duration") ?? 1 });
  if (!parsed.success) return Response.json({ error: "Scegli una data e una durata valide." }, { status: 400 });
  const { date, duration } = parsed.data;
  const calendarView = query.get("calendar") === "1";
  if (date < todayInRome() || date > shiftDay(todayInRome(), 180)) return Response.json({ slots: [] });
  try{return Response.json(await readBookingAvailability(date,duration,calendarView,query.get("includeDurations")==="1"),{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"Impossibile verificare gli orari. Riprova tra poco."},{status:503});}
}