// Integration boundaries for the FREE prototype.
// The local implementations below use browser storage and mock data ONLY.
// Production needs server-side replacements: admin auth, database, secure storage,
// payment provider + webhooks, email and authorised licence downloads.
import { demoContent } from "./data/fixtures.ts";
import { demoAvailability, type DemoDay } from "./lib/availability.ts";
import { demoId } from "./lib/validate.ts";
import type { CartItem, DemoRequest, DemoRequestKind, StudioContent } from "./types.ts";

export interface ContentRepository { load(): StudioContent; save(content: StudioContent): void; reset(): StudioContent }
export interface AvailabilityProvider { list(from: Date): DemoDay[] }
export interface RequestGateway { submit(kind: DemoRequestKind, summary: string, data: Record<string, string>): DemoRequest; list(): DemoRequest[]; clear(): void }
export interface CartStore { load(): CartItem[]; save(items: CartItem[]): void }
/** Checkout never charges anything in the prototype: it only records a simulated order. */
export interface CheckoutGateway { simulate(summary: string, data: Record<string, string>): { status: "simulated"; order: DemoRequest } }

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
    const c = read<StudioContent | null>(KEYS.content, null);
    return c && c.version === 1 && Array.isArray(c.beats) ? c : clone(demoContent);
  },
  save(content) { write(KEYS.content, content); },
  reset() {
    try { window.localStorage.removeItem(KEYS.content); } catch { /* ignore */ }
    return clone(demoContent);
  },
};

export const localAvailability: AvailabilityProvider = { list: from => demoAvailability(from) };

export const localRequests: RequestGateway = {
  submit(kind, summary, data) {
    const req: DemoRequest = { id: demoId(kind === "order" ? "ORD-DEMO" : "REQ-DEMO"), kind, summary, data, createdAt: new Date().toISOString() };
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

export const simulatedCheckout: CheckoutGateway = {
  simulate(summary, data) {
    return { status: "simulated", order: localRequests.submit("order", summary, data) };
  },
};
