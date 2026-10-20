import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { bookingCalendarFile } from "@/lib/booking-calendar";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ bookingId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Accesso richiesto", { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { bookingId } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(bookingId)) return new Response("Non disponibile", { status: 404 });
  const { data, error } = await createSupabaseAdminClient().from("bookings").select("id,reference,starts_at,ends_at,updated_at")
    .eq("id", bookingId).eq("customer_id", user.id).eq("status", "confirmed").maybeSingle();
  if (error || !data) return new Response("Non disponibile", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return new Response(bookingCalendarFile(data), { headers: {
    "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="GENKS-${data.reference}.ics"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow",
  } });
}
