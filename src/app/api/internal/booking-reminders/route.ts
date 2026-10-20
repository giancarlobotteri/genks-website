import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendDueBookingReminders } from "@/lib/booking-reminders";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 256) return new Response("Non autorizzato", { status: 401 });
  let ticket: unknown;
  try { ticket = JSON.parse(raw).ticket; } catch { /* Fail closed. */ }
  if (typeof ticket !== "string" || !/^[a-f0-9]{64}$/.test(ticket)) return new Response("Non autorizzato", { status: 401 });
  const consumed = await createSupabaseAdminClient().rpc("consume_reminder_dispatch", { p_ticket: ticket });
  if (consumed.error || consumed.data !== true) return new Response("Non autorizzato", { status: 401 });
  try {
    const result = await sendDueBookingReminders();
    return Response.json(result, { status: result.failures ? 503 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Promemoria da verificare." }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}
