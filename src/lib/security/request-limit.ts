import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Scope = "service" | "checkout" | "login" | "magic-link" | "availability" | "chat" | "chat-provider" | "quote";
const budgets: Record<Scope, [number, number, number]> = {
  chat:[20,600,200],"chat-provider":[450,86400,450],quote:[60,600,1000],service: [8, 3600, 200], checkout: [15, 600, 300], login: [12, 600, 300],
  "magic-link": [4, 600, 60], availability: [120, 600, 2000],
};
// Shared database counters work across server instances. No raw IP or email is stored.
export async function allowPublicRequest(scope: Scope): Promise<boolean> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return false;
  const requestHeaders = await headers();
  // Vercel replaces x-forwarded-for at its ingress; ignore user-supplied values locally.
  const forwarded = process.env.VERCEL === "1" ? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() : "127.0.0.1";
  const address = forwarded && isIP(forwarded) ? forwarded : "unavailable";
  const fingerprint = (value: string) => createHmac("sha256", secret).update(`genks-rate-v1:${scope}:${value}`).digest("hex");
  const [limit, seconds, total] = budgets[scope];
  const db = createSupabaseAdminClient();
  try {
    const global = await db.rpc("consume_request_budget", { p_key: fingerprint("global"), p_limit: total, p_seconds: seconds });
    if (global.error || global.data !== true) return false;
    const result = await db.rpc("consume_request_budget", { p_key: fingerprint(address), p_limit: limit, p_seconds: seconds });
    return !result.error && result.data === true;
  } catch { return false; }
}
