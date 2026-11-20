const productionDatabaseHost = 'xoayoldgiwhfnunantsh.supabase.co';
const ownerEmail = 'prod.genks@gmail.com';

export function cinematicSandboxConfigured(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL_ENV !== 'preview' || env.GENKS_PRIVATE_PREVIEW !== 'true' ||
      env.GENKS_CINEMATIC_SANDBOX !== 'true') return false;
  if (!/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? '') ||
      !env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_') ||
      !env.GENKS_STRIPE_ACCOUNT_ID || !env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL ||
      !env.GENKS_CINEMATIC_TEST_SUPABASE_SECRET || !env.GENKS_CINEMATIC_SANDBOX_PROJECT_REF ||
      env.GENKS_ADMIN_EMAIL?.trim().toLowerCase() !== ownerEmail) return false;

  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    return url.origin === `https://${env.GENKS_CINEMATIC_SANDBOX_PROJECT_REF}.supabase.co` &&
      url.hostname !== productionDatabaseHost &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

export function cinematicSandboxRecipient(email: string) {
  return email.trim().toLowerCase() === ownerEmail;
}
