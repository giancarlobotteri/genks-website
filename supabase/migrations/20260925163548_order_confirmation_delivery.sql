alter table public.orders
  add column if not exists confirmation_email_id text,
  add column if not exists confirmation_email_attempted_at timestamptz,
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists confirmation_email_last_error text;

comment on column public.orders.confirmation_email_id is
  'Provider message id returned by Resend for the paid order confirmation.';
comment on column public.orders.confirmation_email_sent_at is
  'Set only after Resend accepts the paid order confirmation.';
