import { calendarFeedAllowed } from "@/lib/calendar-feed";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { renderCalendar, type CalendarEntry } from "@/lib/ical";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!calendarFeedAllowed(new URL(request.url).searchParams.get("token"))) return new Response("Non autorizzato", { status: 401 });
  const db = createSupabaseAdminClient();
  const entries: CalendarEntry[] = [];
  // Read in batches, so the feed does not silently stop at the API's row limit.
  for (const table of ["bookings", "service_projects"] as const) {
    for (let offset = 0; ; offset += 500) {
      const query = table === "bookings"
        ? db.from(table).select("id,reference,starts_at,ends_at,updated_at").in("status", ["confirmed", "completed"])
        : db.from(table).select("id,reference,service,agreed_deadline,updated_at").in("status", ["paid", "in_progress", "review"]).not("agreed_deadline", "is", null);
      const { data, error } = await query.order("id").range(offset, offset + 499);
      if (error) return new Response("Calendario temporaneamente non disponibile", { status: 503 });
      for (const row of data ?? []) {
        if ("starts_at" in row) entries.push({ id: `booking-${row.id}`, title: `Studio GENKS · ${row.reference}`, start: row.starts_at, end: row.ends_at, updated: row.updated_at });
        else entries.push({ id: `project-${row.id}`, title: `Scadenza ${row.service.replaceAll("_", " & ")} GENKS · ${row.reference}`, start: row.agreed_deadline!, allDay: true, updated: row.updated_at });
      }
      if (!data || data.length < 500) break;
    }
  }
  return new Response(renderCalendar(entries), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } });
}
