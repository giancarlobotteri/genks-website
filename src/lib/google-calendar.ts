import "server-only";
import { createHash, createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_ROOT = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar";
let tokenCache: { value: string; expiresAt: number } | null = null;

export const hasGoogleCalendar = Boolean(
  process.env.GOOGLE_CALENDAR_ID &&
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
);

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

async function getAccessToken() {
  if (!hasGoogleCalendar) throw new Error("Google Calendar is not configured.");
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({ iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${claim}`;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key);
  const assertion = `${unsigned}.${base64url(signature)}`;
  const response = await fetch(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), cache: "no-store" });
  const result = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error_description || "Google Calendar authentication failed.");
  tokenCache = { value: result.access_token, expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000 };
  return tokenCache.value;
}

async function googleRequest(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  return fetch(`${API_ROOT}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers }, cache: "no-store" });
}

export async function getGoogleBusyRanges(timeMin: Date, timeMax: Date) {
  if (!hasGoogleCalendar) return [];
  const calendarId = process.env.GOOGLE_CALENDAR_ID!;
  const response = await googleRequest("/freeBusy", { method: "POST", body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), timeZone: "Europe/Rome", items: [{ id: calendarId }] }) });
  const result = await response.json() as { calendars?: Record<string, { busy?: Array<{ start: string; end: string }>; errors?: unknown[] }> };
  const calendar = result.calendars?.[calendarId];
  if (!response.ok || calendar?.errors?.length) throw new Error("Shared studio calendar is temporarily unavailable.");
  return (calendar?.busy ?? []).map((range) => ({ starts_at: range.start, ends_at: range.end }));
}

function stableEventId(prefix: string, sourceId: string) {
  return `${prefix}${createHash("sha256").update(sourceId).digest("hex").slice(0, 40)}`;
}

export async function createBookingCalendarEvent(input: { id: string; reference: string; startsAt: string; endsAt: string }) {
  if (!hasGoogleCalendar) return null;
  const eventId = stableEventId("b", input.id);
  const response = await googleRequest(`/calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!)}/events`, { method: "POST", body: JSON.stringify({
    id: eventId,
    summary: `Studio occupato · GENKS ${input.reference}`,
    description: `Prenotazione gestita da GENKS. Riferimento ${input.reference}.`,
    start: { dateTime: input.startsAt, timeZone: "Europe/Rome" },
    end: { dateTime: input.endsAt, timeZone: "Europe/Rome" },
    transparency: "opaque",
    visibility: "private",
    extendedProperties: { private: { source: "genks", booking_id: input.id } },
  }) });
  if (response.status === 409) return eventId;
  if (!response.ok) throw new Error("Could not create the shared calendar event.");
  const event = await response.json() as { id?: string };
  return event.id ?? eventId;
}

export async function createProjectDeadlineEvent(input: { id: string; reference: string; service: string; deadline: string }) {
  if (!hasGoogleCalendar) return null;
  const eventId = stableEventId("p", input.id);
  const nextDay = new Date(`${input.deadline}T12:00:00Z`); nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const response = await googleRequest(`/calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!)}/events`, { method: "POST", body: JSON.stringify({
    id: eventId,
    summary: `GENKS ${input.service.replaceAll("_", " & ")} · ${input.reference}`,
    description: `Scadenza progetto GENKS. Riferimento ${input.reference}.`,
    start: { date: input.deadline }, end: { date: nextDay.toISOString().slice(0, 10) },
    transparency: "transparent", visibility: "private",
    extendedProperties: { private: { source: "genks", project_id: input.id } },
  }) });
  if (response.status === 409) return eventId;
  if (!response.ok) throw new Error("Could not create the project calendar event.");
  const event = await response.json() as { id?: string };
  return event.id ?? eventId;
}

export async function deleteGoogleCalendarEvent(eventId: string | null | undefined) {
  if (!hasGoogleCalendar || !eventId) return;
  const response = await googleRequest(`/calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error("Could not remove the shared calendar event.");
}
