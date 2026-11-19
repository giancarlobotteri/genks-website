// Integration boundaries. Requests (sessions, mix/master, custom beats, packages, licences) go to the
// server (api/request.ts): queued in Supabase and emailed with Resend, to the customer and to GENKS.
// Content and cart live in the browser; the studio calendar is read live (src/lib/real-availability.ts).
import { demoContent } from "./data/fixtures.ts";
import { demoId } from "./lib/validate.ts";
import type { CartItem, DemoRequest, DemoRequestKind, StudioContent } from "./types.ts";

export interface ContentRepository { load(): StudioContent; save(content: StudioContent): void; reset(): StudioContent }
export interface RequestGateway { submit(kind: DemoRequestKind, summary: string, data: Record<string, string>): DemoRequest; list(): DemoRequest[]; clear(): void }
export interface CartStore { load(): CartItem[]; save(items: CartItem[]): void }

const KEYS = { content: "genks:vs:content:v1", cart: "genks:vs:cart:v1", requests: "genks:vs:requests:v1" };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: keep in memory */ }
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const localContent: ContentRepository = {
  load() {
    // the catalogue and the price list of the site (no local edits: older browsers may still hold
    // content saved by the former in-browser editor, which is ignored and cleared)
    try { window.localStorage.removeItem(KEYS.content); } catch { /* storage unavailable */ }
    return clone(demoContent);
  },
  save(content) { write(KEYS.content, content); },
  reset() {
    try { window.localStorage.removeItem(KEYS.content); } catch { /* ignore */ }
    return clone(demoContent);
  },
};

export const localRequests: RequestGateway = {
  submit(kind, summary, data) {
    const req: DemoRequest = { id: demoId(kind === "order" ? "ORD-LOCAL" : "REQ-LOCAL"), kind, summary, data, createdAt: new Date().toISOString() };
    write(KEYS.requests, [req, ...read<DemoRequest[]>(KEYS.requests, [])].slice(0, 100));
    window.dispatchEvent(new Event("genks:vs:requests"));
    return req;
  },
  list: () => read<DemoRequest[]>(KEYS.requests, []),
  clear() { write(KEYS.requests, []); window.dispatchEvent(new Event("genks:vs:requests")); },
};

export const localCart: CartStore = {
  load: () => read<CartItem[]>(KEYS.cart, []),
  save: items => write(KEYS.cart, items),
};

const isLocalHost = () => typeof window !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

/**
 * Send a request to GENKS: the customer gets a confirmation email, GENKS a notice with every detail.
 * (A local `vite preview` has no server: there the request is only kept in this browser.)
 */
export async function sendRequest(kind: DemoRequestKind, summary: string, data: Record<string, string>): Promise<DemoRequest> {
  let r: Response;
  try {
    r = await fetch("/api/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, summary, data }) });
  } catch {
    throw new Error("Connessione non riuscita. Controlla la rete e riprova.");
  }
  if (r.status === 404 && isLocalHost()) return localRequests.submit(kind, summary, data);
  const j = (await r.json().catch(() => ({}))) as { reference?: string; error?: string };
  if (!r.ok || !j.reference) throw new Error(j.error ?? "Invio non riuscito. Riprova tra poco o scrivici a assistenza@prodbygenks.com.");
  return { id: j.reference, kind, summary, data, createdAt: new Date().toISOString() };
}
