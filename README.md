# GENKS — beat store and studio platform

Production-oriented Next.js 16 application for the GENKS storefront, beat licensing, customer Library, recording requests, Mix/Master projects and protected administration.

## Local start

Requires Node.js 22 or newer.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Required external services

Copy every relevant value from `.env.example` into `.env.local`.

- Supabase: project URL, publishable key and secret/service key.
- Stripe: secret key and webhook signing secret. Use test-mode keys first.
- Resend: API key and an approved sender address.
- Public contact URLs: Instagram, TikTok, YouTube and WhatsApp number.

No secret may use a `NEXT_PUBLIC_` prefix. Only the Supabase project URL, publishable key and public contact URLs belong in the browser bundle.

## Database, RLS and storage

The complete initial schema is in `supabase/migrations/20260923094419_initial_genks_platform.sql`.

Apply it to a fresh Supabase project with the Supabase CLI or SQL editor. It creates the commerce, booking, service-project, promotion, settings and audit tables; RLS policies; public `covers`/`previews` buckets; and private `beat-assets`/`project-files` buckets.

After creating the owner in Supabase Auth, make that user an administrator in both trusted locations:

```sql
update public.profiles set role = 'admin' where id = '<AUTH_USER_UUID>';
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where id = '<AUTH_USER_UUID>';
```

Then sign out and back in so the JWT receives the new trusted `app_metadata` claim. Never put the role in user metadata.

## Stripe webhook

Point Stripe to `/api/stripe/webhook` and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `charge.refunded`.

The webhook verifies Stripe's signature, records payment IDs idempotently, marks orders paid and creates entitlements. The success page alone never unlocks files.

For local Stripe testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Main flows

- Storefront: `/`, `/beats`, and shareable `/beats/[slug]` pages.
- Services: `/services`, recording request, Mix/Master request, custom beat contact and Exclusive request.
- Account: passwordless magic-link login and protected Library, orders, bookings and projects.
- Admin: `/admin` dashboard, beats and resumable storage uploads, licenses, orders, customers, bookings, projects, Exclusive requests, promotions, analytics and settings.
- Downloads: server verifies ownership, creates a short-lived signed URL and records the event.

The bundled beats and audio are clearly marked demo content. Real releases are created from Admin after Supabase is connected.

## Large uploads

The Admin upload form sends files directly to Supabase Storage. Files above 6 MB use the TUS resumable endpoint, so WAV/stems do not pass through the Next.js server. Public preview files and covers go to public buckets; masters and stems go to the private `beat-assets` bucket.

## Legal status

Routes under `/legal/*` contain centralized, explicitly marked placeholders. They are structure only and must be replaced with approved Privacy, Cookie, Terms, Licensing and Booking/Cancellation documents before public launch.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Without external credentials, the branded demo storefront builds and runs, but checkout, email, authenticated Library, Admin and persistent requests intentionally remain unavailable instead of pretending to succeed.
