create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'admin');
create type public.beat_status as enum ('draft', 'published', 'archived', 'exclusive_sold');
create type public.order_status as enum ('pending', 'paid', 'failed', 'refunded', 'cancelled');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.booking_status as enum ('pending', 'approved_awaiting_payment', 'confirmed', 'completed', 'cancelled', 'rejected', 'no_show');
create type public.project_status as enum ('requested', 'quoted', 'awaiting_payment', 'paid', 'in_progress', 'review', 'delivered', 'cancelled');
create type public.exclusive_status as enum ('requested', 'contacted', 'negotiating', 'sold', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  display_name text,
  phone text,
  artist_name text,
  internal_notes text,
  marketing_consent boolean not null default false,
  segment text not null default 'NEW_CLIENT' check (segment in ('NEW_CLIENT','RETURNING_CLIENT','VIP_CLIENT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.beats (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  bpm integer not null check (bpm between 30 and 300),
  musical_key text not null,
  genre text not null,
  mood text not null,
  tags text[] not null default '{}',
  description text not null default '',
  cover_path text,
  preview_path text,
  visual_path text,
  status public.beat_status not null default 'draft',
  featured boolean not null default false,
  sort_order integer not null default 0,
  published_at timestamptz,
  prevent_lease_after_exclusive boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index beats_public_idx on public.beats(status, featured, sort_order, published_at desc);

create table public.beat_assets (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats(id) on delete cascade,
  kind text not null check (kind in ('cover','preview','visual','mp3','wav','stems','license')),
  bucket text not null,
  storage_path text not null,
  filename text not null,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique(bucket, storage_path)
);
create index beat_assets_beat_idx on public.beat_assets(beat_id, kind);

create table public.license_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  short_description text not null default '',
  full_description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  included_assets text[] not null default '{}',
  streams_limit bigint,
  download_limit integer,
  monetization_permissions text,
  music_video_permissions text,
  performances text,
  radio text,
  content_id_policy text,
  distribution_restrictions text,
  contract_text text,
  is_exclusive boolean not null default false,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.beat_license_prices (
  beat_id uuid not null references public.beats(id) on delete cascade,
  license_type_id uuid not null references public.license_types(id) on delete cascade,
  price_override_cents integer check (price_override_cents is null or price_override_cents >= 0),
  active boolean not null default true,
  primary key (beat_id, license_type_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('GK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  customer_id uuid references public.profiles(id) on delete set null,
  customer_email text not null,
  customer_name text,
  status public.order_status not null default 'pending',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'EUR',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders(customer_id, created_at desc);
create index orders_email_idx on public.orders(lower(customer_email));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  beat_id uuid references public.beats(id) on delete set null,
  license_type_id uuid references public.license_types(id) on delete set null,
  beat_title_snapshot text not null,
  beat_slug_snapshot text not null,
  license_name_snapshot text not null,
  license_terms_snapshot jsonb not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items(order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  booking_id uuid,
  project_id uuid,
  provider text not null default 'stripe',
  provider_payment_id text not null unique,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR',
  status public.payment_status not null default 'pending',
  raw_event_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete cascade,
  customer_email text not null,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  beat_id uuid references public.beats(id) on delete set null,
  license_type_id uuid references public.license_types(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(order_item_id)
);
create index entitlements_customer_idx on public.entitlements(customer_id, granted_at desc);
create index entitlements_email_idx on public.entitlements(lower(customer_email));

create table public.download_events (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.entitlements(id) on delete cascade,
  asset_id uuid not null references public.beat_assets(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.wishlist (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  beat_id uuid not null references public.beats(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, beat_id)
);

create table public.booking_services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  base_price_cents integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 60 check (slot_minutes between 15 and 480),
  buffer_minutes integer not null default 15 check (buffer_minutes between 0 and 240),
  active boolean not null default true,
  check (end_time > start_time)
);

create table public.blackout_dates (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (ends_at > starts_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('BKG-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  customer_id uuid references public.profiles(id) on delete set null,
  service_id uuid references public.booking_services(id) on delete set null,
  name text not null,
  artist_name text,
  email text not null,
  phone text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  reference_url text,
  status public.booking_status not null default 'pending',
  price_cents integer,
  deposit_cents integer,
  google_calendar_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index bookings_time_idx on public.bookings(starts_at, ends_at) where status in ('pending','approved_awaiting_payment','confirmed');

create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.service_projects (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('PRJ-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  customer_id uuid references public.profiles(id) on delete set null,
  name text not null,
  artist_name text,
  email text not null,
  phone text,
  track_title text not null,
  service text not null check (service in ('mix','master','mix_master')),
  description text not null,
  track_count integer not null default 1 check (track_count > 0),
  reference_links text[] not null default '{}',
  desired_deadline date,
  notes text,
  status public.project_status not null default 'requested',
  price_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.service_projects(id) on delete cascade,
  kind text not null check (kind in ('source','reference','delivery')),
  bucket text not null default 'project-files',
  storage_path text not null,
  filename text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.project_status_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.service_projects(id) on delete cascade,
  from_status public.project_status,
  to_status public.project_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.exclusive_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('EXC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  beat_id uuid not null references public.beats(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  message text,
  status public.exclusive_status not null default 'requested',
  agreed_price_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent','fixed')),
  amount integer not null check (amount > 0),
  active boolean not null default true,
  expires_at timestamptz,
  usage_limit integer,
  minimum_order_cents integer,
  eligible_license_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique(promo_code_id, order_id)
);

create table public.customer_tags (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (customer_id, tag)
);

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.payments add constraint payments_booking_fk foreign key (booking_id) references public.bookings(id) on delete set null;
alter table public.payments add constraint payments_project_fk foreign key (project_id) references public.service_projects(id) on delete set null;

create or replace function public.is_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  update public.orders
    set customer_id = new.id
    where customer_id is null and lower(customer_email) = lower(new.email);
  update public.entitlements
    set customer_id = new.id
    where customer_id is null and lower(customer_email) = lower(new.email);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.prevent_booking_overlap()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status in ('pending','approved_awaiting_payment','confirmed') and exists (
    select 1 from public.bookings b where b.id <> new.id
      and b.status in ('pending','approved_awaiting_payment','confirmed')
      and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
  ) then raise exception 'booking_conflict' using errcode = '23P01'; end if;
  return new;
end;
$$;
create trigger bookings_no_overlap before insert or update on public.bookings for each row execute function public.prevent_booking_overlap();

create or replace function public.validate_booking_availability()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  local_start timestamp;
  local_end timestamp;
  booking_weekday integer;
begin
  if new.status not in ('pending','approved_awaiting_payment','confirmed') then return new; end if;
  local_start := new.starts_at at time zone 'Europe/Rome';
  local_end := new.ends_at at time zone 'Europe/Rome';
  booking_weekday := extract(dow from local_start);
  if (local_start::date <> local_end::date) or not exists (
    select 1 from public.availability_rules r
    where r.active and r.weekday = booking_weekday
      and local_start::time >= r.start_time
      and local_end::time <= r.end_time
      and extract(epoch from (new.ends_at - new.starts_at))::integer % (r.slot_minutes * 60) = 0
  ) then raise exception 'booking_unavailable' using errcode = '23P02'; end if;
  if exists (
    select 1 from public.blackout_dates b
    where tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
  ) then raise exception 'booking_blackout' using errcode = '23P03'; end if;
  return new;
end;
$$;
create trigger bookings_validate_availability before insert or update on public.bookings for each row execute function public.validate_booking_availability();
revoke all on function public.validate_booking_availability() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['profiles','beats','beat_assets','license_types','beat_license_prices','orders','order_items','payments','entitlements','download_events','wishlist','booking_services','availability_rules','blackout_dates','bookings','booking_status_history','service_projects','project_files','project_status_history','exclusive_requests','promo_codes','promo_redemptions','customer_tags','site_settings','admin_audit_log'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy "public reads published beats" on public.beats for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "public reads active licenses" on public.license_types for select to anon, authenticated using (active or public.is_admin());
create policy "public reads active beat prices" on public.beat_license_prices for select to anon, authenticated using (active or public.is_admin());
create policy "public reads booking services" on public.booking_services for select to anon, authenticated using (active or public.is_admin());
create policy "public reads availability" on public.availability_rules for select to anon, authenticated using (active or public.is_admin());
create policy "public reads blackouts" on public.blackout_dates for select to anon, authenticated using (true);
create policy "users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id or public.is_admin());
create policy "users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "users read own orders" on public.orders for select to authenticated using (customer_id = (select auth.uid()) or public.is_admin());
create policy "users read own order items" on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id = order_id and (o.customer_id = (select auth.uid()) or public.is_admin())));
create policy "users read own entitlements" on public.entitlements for select to authenticated using (customer_id = (select auth.uid()) or public.is_admin());
create policy "users read own wishlist" on public.wishlist for select to authenticated using (customer_id = (select auth.uid()) or public.is_admin());
create policy "users insert own wishlist" on public.wishlist for insert to authenticated with check (customer_id = (select auth.uid()));
create policy "users delete own wishlist" on public.wishlist for delete to authenticated using (customer_id = (select auth.uid()));
create policy "users read own bookings" on public.bookings for select to authenticated using (customer_id = (select auth.uid()) or public.is_admin());
create policy "users read own projects" on public.service_projects for select to authenticated using (customer_id = (select auth.uid()) or public.is_admin());
create policy "users read own project files" on public.project_files for select to authenticated using (exists(select 1 from public.service_projects p where p.id = project_id and (p.customer_id = (select auth.uid()) or public.is_admin())));
create policy "users read own exclusive requests" on public.exclusive_requests for select to authenticated using (customer_id = (select auth.uid()) or public.is_admin());

do $$ declare t text; begin
  foreach t in array array['profiles','beats','beat_assets','license_types','beat_license_prices','orders','order_items','payments','entitlements','download_events','wishlist','booking_services','availability_rules','blackout_dates','bookings','booking_status_history','service_projects','project_files','project_status_history','exclusive_requests','promo_codes','promo_redemptions','customer_tags','site_settings','admin_audit_log'] loop
    execute format('create policy "admins manage %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

insert into public.license_types(code,name,short_description,price_cents,included_assets,display_order) values
('mp3','MP3 Lease','High quality MP3 non-exclusive license',2900,array['mp3'],10),
('wav','WAV Lease','MP3 and uncompressed WAV',4900,array['mp3','wav'],20),
('stems','Trackout Lease','MP3, WAV and track stems',9900,array['mp3','wav','stems'],30),
('exclusive','Exclusive License','Direct negotiation with GENKS',0,array['mp3','wav','stems'],40);
insert into public.booking_services(code,name,base_price_cents) values ('recording','Recording Session',4000);
insert into public.availability_rules(weekday,start_time,end_time,slot_minutes,buffer_minutes) values
(1,'15:00','22:00',60,15),(2,'15:00','22:00',60,15),(3,'15:00','22:00',60,15),(4,'15:00','22:00',60,15),(5,'15:00','22:00',60,15),(6,'10:00','20:00',60,15);
insert into public.site_settings(key,value) values
('commerce', '{"currency":"EUR","allow_leases_after_exclusive":false}'::jsonb),
('booking', '{"deposit_mode":"disabled","deposit_amount":0,"auto_confirm":false}'::jsonb),
('customer_segments', '{"returning_orders":2,"vip_spend_cents":50000}'::jsonb)
on conflict do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('covers','covers',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
('previews','previews',true,52428800,array['audio/mpeg','audio/mp4','audio/ogg','audio/wav']),
('beat-assets','beat-assets',false,2147483648,null),
('project-files','project-files',false,5368709120,null)
on conflict (id) do nothing;

create policy "public reads covers previews" on storage.objects for select to anon, authenticated using (bucket_id in ('covers','previews'));
create policy "admins manage storage" on storage.objects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "customers read project objects" on storage.objects for select to authenticated using (
  bucket_id = 'project-files' and exists (
    select 1 from public.project_files pf join public.service_projects sp on sp.id = pf.project_id
    where pf.storage_path = name and sp.customer_id = (select auth.uid())
  )
);

grant usage on schema public to anon, authenticated;
grant select on public.beats, public.license_types, public.beat_license_prices, public.booking_services, public.availability_rules, public.blackout_dates to anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name, phone, artist_name, marketing_consent) on public.profiles to authenticated;
grant select on public.orders, public.order_items, public.entitlements, public.bookings, public.service_projects, public.project_files, public.exclusive_requests to authenticated;
grant select, insert, delete on public.wishlist to authenticated;
