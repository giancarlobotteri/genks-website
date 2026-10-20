export function contentSecurityPolicy(nonce: string, development = false) {
  if (!/^[A-Za-z0-9+/=]+$/.test(nonce)) throw new Error("Invalid CSP nonce");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self'",
    "media-src 'self' blob: data: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com",
    "worker-src 'self' blob:",
    "frame-src 'none'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'",
    "form-action 'self' https://wa.me https://checkout.stripe.com",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
