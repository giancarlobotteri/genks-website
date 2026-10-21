import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendDueBookingReminders } from "@/lib/booking-reminders";
import { flushNotifications } from "@/lib/notifications";

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
    await new Promise(resolve => setTimeout(resolve, 600));
    const alerts = await flushNotifications({ prefix: "reservation-", limit: 10 });
    await new Promise(resolve => setTimeout(resolve, 600));
    const confirmations = await flushNotifications({ prefix: "cash-agree-", limit: 10 });
    await new Promise(resolve => setTimeout(resolve, 600));
    const contracts = await flushNotifications({prefix:"contract-",limit:5});
    await new Promise(resolve => setTimeout(resolve, 600));
    const withdrawals = await flushNotifications({prefix:"withdrawal-",limit:5});
    return Response.json({ ...result, notificationFailures: alerts.failures + confirmations.failures + contracts.failures + withdrawals.failures }, { status: result.failures || alerts.failures || confirmations.failures || contracts.failures || withdrawals.failures ? 503 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Promemoria da verificare." }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}
