export type CalendarEntry = { id: string; title: string; start: string; end?: string; allDay?: boolean; updated: string; location?: string };
const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
function fold(line: string) {
  const lines: string[] = []; let current = "";
  for (const char of line) {
    if (new TextEncoder().encode(current + char).length > 73) { lines.push(current); current = " " + char; }
    else current += char;
  }
  lines.push(current); return lines.join("\r\n");
}
export function renderCalendar(entries: CalendarEntry[], now = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GENKS//Studio//IT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:GENKS Studio", "X-WR-TIMEZONE:Europe/Rome", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"];
  for (const entry of entries) {
    lines.push("BEGIN:VEVENT", `UID:${escape(entry.id)}@prodbygenks.com`, `DTSTAMP:${stamp(now.toISOString())}`, `LAST-MODIFIED:${stamp(entry.updated)}`, `SUMMARY:${escape(entry.title)}`, "CLASS:PRIVATE");
    if (entry.location) lines.push(`LOCATION:${escape(entry.location)}`);
    if (entry.allDay) {
      const end = new Date(`${entry.start}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${entry.start.replaceAll("-", "")}`, `DTEND;VALUE=DATE:${end.toISOString().slice(0,10).replaceAll("-", "")}`, "TRANSP:TRANSPARENT");
    } else lines.push(`DTSTART:${stamp(entry.start)}`, `DTEND:${stamp(entry.end!)}`, "TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR"); return lines.map(fold).join("\r\n") + "\r\n";
}
