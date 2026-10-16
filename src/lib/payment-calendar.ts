import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createBookingCalendarEvent, createProjectDeadlineEvent, deleteGoogleCalendarEvent, hasGoogleCalendar } from "@/lib/google-calendar";
export async function syncPaymentCalendar(paymentId:string) {
  if(!hasGoogleCalendar)return;
  const db=createSupabaseAdminClient();
  const {data:payment,error}=await db.from("payments").select("booking_id,project_id").eq("id",paymentId).single();
  if(error||!payment)throw new Error("Calendario del pagamento da aggiornare.");
  if(payment.booking_id) {
    const {data:b,error}=await db.from("bookings").select("id,reference,status,starts_at,ends_at,google_calendar_event_id").eq("id",payment.booking_id).single();
    if(error||!b)throw new Error("Prenotazione da sincronizzare.");
    let eventId=b.google_calendar_event_id;
    if(["confirmed","completed"].includes(b.status)&&!eventId)eventId=await createBookingCalendarEvent({id:b.id,reference:b.reference,startsAt:b.starts_at,endsAt:b.ends_at});
    if(["cancelled","rejected"].includes(b.status)&&eventId){await deleteGoogleCalendarEvent(eventId);eventId=null;}
    if(eventId!==b.google_calendar_event_id){const result=await db.from("bookings").update({google_calendar_event_id:eventId}).eq("id",b.id);if(result.error)throw new Error("Conferma calendario da salvare.");}
  }
  if(payment.project_id) {
    const {data:p,error}=await db.from("service_projects").select("id,reference,status,service,agreed_deadline,google_calendar_event_id").eq("id",payment.project_id).single();
    if(error||!p)throw new Error("Progetto da sincronizzare.");
    let eventId=p.google_calendar_event_id;
    if(["paid","in_progress","review"].includes(p.status)&&p.agreed_deadline&&!eventId)eventId=await createProjectDeadlineEvent({id:p.id,reference:p.reference,service:p.service,deadline:p.agreed_deadline});
    if(["cancelled","delivered"].includes(p.status)&&eventId){await deleteGoogleCalendarEvent(eventId);eventId=null;}
    if(eventId!==p.google_calendar_event_id){const result=await db.from("service_projects").update({google_calendar_event_id:eventId}).eq("id",p.id);if(result.error)throw new Error("Conferma calendario da salvare.");}
  }
}
