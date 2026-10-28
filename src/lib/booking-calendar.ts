import { renderCalendar } from "./ical.ts";

export type BookingCalendar = { id: string; reference: string; starts_at: string; ends_at: string; updated_at?: string };
export const studioAddress = "Via Quintina, Ponte San Giovanni, Perugia (PG), Italia";
const stamp = (date: string) => new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export function bookingCalendarUrl(booking: BookingCalendar, includeAddress=false) {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.search = new URLSearchParams({ action: "TEMPLATE", text: `Sessione in studio GENKS · ${booking.reference}`,
    dates: `${stamp(booking.starts_at)}/${stamp(booking.ends_at)}`, ctz: "Europe/Rome", location: includeAddress?studioAddress:"Ponte San Giovanni (PG)",
    details: `Sessione confermata presso GENKS. Riferimento ${booking.reference}. Per modifiche contatta assistenza@prodbygenks.com.` }).toString();
  return url.href;
}
export function bookingCalendarFile(booking: BookingCalendar, includeAddress=false) {
  // No customer name, email or other appointments are included in this personal file.
  return renderCalendar([{ id: `booking-${booking.id}`, title: `Sessione in studio GENKS · ${booking.reference}`,
    start: booking.starts_at, end: booking.ends_at, updated: booking.updated_at ?? booking.starts_at, location: includeAddress?studioAddress:"Ponte San Giovanni (PG)" }], new Date(booking.updated_at ?? booking.starts_at));
}
export function bookingReminderMessage(booking: BookingCalendar & { name: string; hours_before: number }) {
  const day = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(booking.starts_at));
  const time = (value: string) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  return {
    subject: `GENKS · Promemoria ${booking.hours_before} ore · ${booking.reference}`,
    heading: booking.hours_before === 24 ? "Il tuo prossimo appuntamento." : "Ci vediamo tra poco in studio.",
    body: [`Ciao ${booking.name},`, "ti ricordiamo la tua sessione confermata con GENKS.", `Giorno: ${day}`,
      `Orario: ${time(booking.starts_at)} – ${time(booking.ends_at)} · ora italiana`, `Studio: ${studioAddress}`,
      `Riferimento: ${booking.reference}`, "Se hai un imprevisto, rispondi a questa email: avvisaci prima della sessione.",
      "Puoi salvare l’appuntamento su Google Calendar con il pulsante qui sotto. Per Apple Calendar o Outlook apri il file calendario allegato."].join("\n"),
    actionUrl: bookingCalendarUrl(booking,true), actionLabel: "Aggiungi a Google Calendar",
  };
}
