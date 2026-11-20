import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cinematicSandboxConfigured, cinematicSandboxRecipient } from '../src/lib/cinematic-sandbox.ts';

const preview = {
  VERCEL_ENV: 'preview',
  GENKS_PRIVATE_PREVIEW: 'true',
  GENKS_CINEMATIC_SANDBOX: 'true',
  STRIPE_SECRET_KEY: 'sk_test_example',
  STRIPE_WEBHOOK_SECRET: 'whsec_example',
  GENKS_STRIPE_ACCOUNT_ID: 'acct_example',
  RESEND_API_KEY: 're_example',
  RESEND_FROM_EMAIL: 'test@example.invalid',
  SUPABASE_SECRET_KEY: 'example',
  GENKS_CINEMATIC_SANDBOX_PROJECT_REF: 'isolated-example',
  NEXT_PUBLIC_SUPABASE_URL: 'https://isolated-example.supabase.co',
  GENKS_ADMIN_EMAIL: 'prod.genks@gmail.com',
};

test('enables Sandbox checkout only with isolated, private preview settings', () => {
  assert.equal(cinematicSandboxConfigured(preview), true);
  for (const change of [
    { VERCEL_ENV: 'production' },
    { GENKS_PRIVATE_PREVIEW: 'false' },
    { STRIPE_SECRET_KEY: 'sk_live_example' },
    { STRIPE_WEBHOOK_SECRET: undefined },
    { RESEND_API_KEY: undefined },
    {
      GENKS_CINEMATIC_SANDBOX_PROJECT_REF: 'xoayoldgiwhfnunantsh',
      NEXT_PUBLIC_SUPABASE_URL: 'https://xoayoldgiwhfnunantsh.supabase.co',
    },
  ]) assert.equal(cinematicSandboxConfigured({ ...preview, ...change }), false);
});

test('limits test receipt recipients to the GENKS owner', () => {
  assert.equal(cinematicSandboxRecipient('prod.genks@gmail.com'), true);
  assert.equal(cinematicSandboxRecipient('customer@example.invalid'), false);
});
