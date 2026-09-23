import "server-only";

export const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const hasStripe = Boolean(
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET,
);

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
