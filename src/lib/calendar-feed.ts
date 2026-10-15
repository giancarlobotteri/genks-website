import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export function calendarFeedToken() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret).update("genks-private-calendar-feed-v1").digest("hex");
}
export function calendarFeedAllowed(token: string | null) {
  const expected = calendarFeedToken();
  if (!expected || !token || !/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
