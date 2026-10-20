import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { privatePreview } from "@/lib/preview-mode";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/") && path !== "/api/stripe/webhook" && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || !origin || origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Origine della richiesta non autorizzata." }, { status: 403 });
    }
  }
  if (
    !(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_GENKS_SUPABASE_URL) ||
    !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_GENKS_SUPABASE_PUBLISHABLE_KEY)
  ) return privatePreview ? new NextResponse("L’anteprima privata non è configurata.", { status: 503 }) : NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_GENKS_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_GENKS_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
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
    if (!user || profile?.data?.role !== "admin") {
      const denied = path.startsWith("/api/")
        ? NextResponse.json({ error: "Accesso amministratore richiesto." }, { status: 401 })
        : NextResponse.redirect(new URL("/admin-access", request.url));
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      denied.headers.set("Cache-Control", "private, no-store");
      return denied;
    }
  }
  if (privatePreview) {
    const path = request.nextUrl.pathname;
    const publicEndpoints = path === "/admin-access" || path === "/login" || path === "/auth/confirm" || path === "/api/stripe/webhook" || path === "/api/calendar/feed" || path === "/robots.txt";
    if (!publicEndpoints) {
      const ownerEmail = (process.env.GENKS_ADMIN_EMAIL || "prod.genks@gmail.com").trim().toLowerCase();
      if (user?.email?.toLowerCase() !== ownerEmail) {
        if (path.startsWith("/api/")) return new NextResponse("Anteprima privata", { status: 403 });
        const login = new URL("/admin-access", request.url);
        if (user) login.searchParams.set("denied", "1");
        const redirect = NextResponse.redirect(login);
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
      }
    }
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
