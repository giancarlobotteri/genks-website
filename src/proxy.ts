import { BEATS_ENABLED } from "@/config/features";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { privatePreview } from "@/lib/preview-mode";
import { contentSecurityPolicy } from "@/lib/security/csp";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const protect = (result: NextResponse) => {
    result.headers.set("Content-Security-Policy", csp);
    return result;
  };
  if (path.startsWith("/api/") && !["/api/stripe/webhook", "/api/internal/booking-reminders"].includes(path) && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || !origin || origin !== request.nextUrl.origin) {
      return protect(NextResponse.json({ error: "Origine della richiesta non autorizzata." }, { status: 403 }));
    }
  }
  if (!BEATS_ENABLED) {
    if (path === "/api/checkout") return protect(NextResponse.json({ error: "Il catalogo beat è in pausa." }, { status: 503, headers: { "Cache-Control": "no-store" } }));
    if (path === "/beats" || path.startsWith("/beats/") || path === "/carrello" || (path.startsWith("/checkout/") && path !== "/checkout/success")) {
      return protect(NextResponse.redirect(new URL("/services", request.url)));
    }
  }
  if (
    !(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_GENKS_SUPABASE_URL) ||
    !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_GENKS_SUPABASE_PUBLISHABLE_KEY)
  ) return protect(privatePreview ? new NextResponse("L’anteprima privata non è configurata.", { status: 503 }) : NextResponse.next({ request: { headers: requestHeaders } }));

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_GENKS_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_GENKS_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
          response = NextResponse.next({ request: { headers: requestHeaders } });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  // Reject admin requests before Next.js can render any child page or RSC payload.
  if (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/")) {
    const ownerEmail = (process.env.GENKS_ADMIN_EMAIL || "prod.genks@gmail.com").trim().toLowerCase();
    const profile = user?.email?.toLowerCase() === ownerEmail
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : null;
    if (!user?.email_confirmed_at || profile?.data?.role !== "admin") {
      const denied = path.startsWith("/api/")
        ? NextResponse.json({ error: "Accesso amministratore richiesto." }, { status: 401 })
        : NextResponse.redirect(new URL("/admin-access", request.url));
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      denied.headers.set("Cache-Control", "private, no-store");
      return protect(denied);
    }
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data?.currentLevel !== "aal2") {
      const denied = path.startsWith("/api/")
        ? NextResponse.json({ error: "Verifica in due passaggi richiesta." }, { status: 403 })
        : NextResponse.redirect(new URL("/admin-security", request.url));
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      denied.headers.set("Cache-Control", "private, no-store");
      return protect(denied);
    }
  }
  if (privatePreview) {
    const path = request.nextUrl.pathname;
    const publicEndpoints = path === "/admin-access" || path === "/login" || path === "/auth/confirm" || path === "/api/stripe/webhook" || path === "/api/calendar/feed" || path === "/robots.txt";
    if (!publicEndpoints) {
      const ownerEmail = (process.env.GENKS_ADMIN_EMAIL || "prod.genks@gmail.com").trim().toLowerCase();
      if (user?.email?.toLowerCase() !== ownerEmail) {
        if (path.startsWith("/api/")) return protect(new NextResponse("Anteprima privata", { status: 403 }));
        const login = new URL("/admin-access", request.url);
        if (user) login.searchParams.set("denied", "1");
        const redirect = NextResponse.redirect(login);
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return protect(redirect);
      }
    }
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "private, no-store");
  }
  return protect(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
