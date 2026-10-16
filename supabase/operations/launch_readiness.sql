-- Apply with the Supabase migration API. No historical orders are deleted.
begin;

alter table public.orders add column if not exists checkout_consents jsonb;

alter table public.payments add column if not exists livemode boolean not null default false;
alter table public.payments add column if not exists paid_at timestamptz;
alter table public.payments add column if not exists refunded_cents integer not null default 0 check (refunded_cents >= 0);
alter table public.payments add column if not exists fee_cents integer;
alter table public.payments add column if not exists review_reason text;
alter table public.payments add column if not exists disputed boolean not null default false;
alter table public.bookings add column if not exists hold_expires_at timestamptz default (now() + interval '48 hours');
alter table public.bookings add column if not exists blocked_until timestamptz;
update public.bookings set blocked_until=ends_at+interval '15 minutes' where blocked_until is null;
alter table public.bookings alter column blocked_until set not null;
alter table public.availability_rules add column if not exists ends_next_day boolean not null default false;
alter table public.availability_rules drop constraint availability_rules_check;
alter table public.availability_rules add constraint availability_rules_valid_window check ((not ends_next_day and end_time>start_time) or (ends_next_day and end_time<=start_time));
alter table public.service_projects add column if not exists agreed_deadline date;
alter table public.service_projects add column if not exists delivery_url text;

create table public.service_quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id),
  project_id uuid references public.service_projects(id),
  amount_cents integer not null check (amount_cents >= 50),
  currency text not null default 'EUR' check (currency = 'EUR'),
  scope text not null check (length(trim(scope)) >= 10),
  revision_count integer not null default 1 check (revision_count between 0 and 50),
  agreed_deadline date,
  stripe_session_id text unique,
  checkout_url text,
  status text not null default 'creating' check (status in ('creating','open','paid','expired','cancelled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(booking_id, project_id) = 1)
);
create unique index service_quotes_active_booking on public.service_quotes(booking_id) where status in ('creating','open');
create unique index service_quotes_active_project on public.service_quotes(project_id) where status in ('creating','open');
alter table public.payments add column if not exists quote_id uuid references public.service_quotes(id);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  recipient text not null,
  subject text not null,
  heading text not null,
  body text not null,
  action_url text,
  action_label text,
  attempts integer not null default 0,
  last_error text,
  locked_until timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notification_outbox_pending on public.notification_outbox(created_at) where sent_at is null;

create table public.stripe_event_log (
  id text primary key,
  event_type text not null,
  livemode boolean not null,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.stripe_event_log enable row level security;
revoke all on public.stripe_event_log from public,anon,authenticated;
grant all on public.stripe_event_log to service_role;

create or replace function public.queue_service_receipt() returns trigger language plpgsql set search_path='' as $$
begin
  insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
  values('request-'||new.reference||'-customer',new.email,'Richiesta GENKS '||new.reference,'Richiesta ricevuta.',
    'La richiesta '||new.reference||' è stata salvata. GENKS valuterà i dettagli e ti invierà un preventivo prima di qualsiasi pagamento. Nessun addebito è stato effettuato.') on conflict(dedupe_key) do nothing;
  return new;
end $$;
create trigger queue_booking_receipt after insert on public.bookings for each row execute function public.queue_service_receipt();
create trigger queue_project_receipt after insert on public.service_projects for each row execute function public.queue_service_receipt();
revoke all on function public.queue_service_receipt() from public,anon,authenticated;
grant execute on function public.queue_service_receipt() to service_role;

create table public.payment_adjustments (
  provider_refund_id text primary key,
  payment_id uuid not null references public.payments(id),
  amount_cents integer not null check (amount_cents > 0),
  occurred_at timestamptz not null
);
create table public.business_costs (
  id uuid primary key default gen_random_uuid(),
  description text not null check (length(trim(description)) >= 2),
  amount_cents integer not null check (amount_cents > 0),
  incurred_on date not null,
  category text not null check (category in ('studio','software','marketing','collaborators','other')),
  created_at timestamptz not null default now()
);
alter table public.service_quotes enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.payment_adjustments enable row level security;
alter table public.business_costs enable row level security;
revoke all on public.service_quotes, public.notification_outbox, public.payment_adjustments, public.business_costs from public, anon, authenticated;
grant all on public.service_quotes, public.notification_outbox, public.payment_adjustments, public.business_costs to service_role;

insert into public.site_settings(key,value) values ('launch', '{"legal_ready":false,"seller_ready":false,"seller_name":"Gian Carlo Botteri","brand":"GENKS","country":"IT"}') on conflict do nothing;

-- A real exclusion constraint closes the race between two simultaneous requests.
alter table public.bookings add constraint bookings_time_exclusion
  exclude using gist (tstzrange(starts_at, blocked_until, '[)') with &&)
  where (status in ('pending','approved_awaiting_payment','confirmed'));

create or replace function public.validate_booking_availability() returns trigger language plpgsql set search_path='' as $$
declare local_start timestamp; local_end timestamp; booking_buffer integer;
begin
  new.blocked_until:=new.ends_at;
  if new.status not in ('pending','approved_awaiting_payment','confirmed') then return new; end if;
  local_start:=new.starts_at at time zone 'Europe/Rome';
  local_end:=new.ends_at at time zone 'Europe/Rome';
  select max(r.buffer_minutes) into booking_buffer from public.availability_rules r
  cross join lateral (values(local_start::date),(local_start::date-1)) as d(day)
  where r.active and r.weekday=extract(dow from d.day)
    and local_start>=d.day+r.start_time
    and local_end<=d.day+r.end_time+case when r.ends_next_day then interval '1 day' else interval '0' end
    and mod(extract(epoch from (local_start-(d.day+r.start_time)))::integer,r.slot_minutes*60)=0;
  if booking_buffer is null then raise exception 'booking_unavailable' using errcode='23P02'; end if;
  new.blocked_until:=new.ends_at+make_interval(mins=>booking_buffer);
  if exists(select 1 from public.blackout_dates b where tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')) then
    raise exception 'booking_blackout' using errcode='23P03';
  end if;
  return new;
end $$;
revoke all on function public.validate_booking_availability() from public,anon,authenticated;
grant execute on function public.validate_booking_availability() to service_role;

-- Weekday availability supplied by the owner. Weekend windows are confirmed separately.
update public.availability_rules set start_time='19:30',end_time='01:00',ends_next_day=true,slot_minutes=30 where weekday between 1 and 5;

create or replace function public.expire_booking_holds() returns integer language plpgsql set search_path='' as $$
declare affected integer;
begin
  with expired as (
    update public.bookings set status='cancelled',updated_at=now()
    where status in ('pending','approved_awaiting_payment') and hold_expires_at <= now()
    returning id
  ) insert into public.booking_status_history(booking_id,to_status,note)
    select id,'cancelled','Riserva temporanea scaduta senza pagamento.' from expired;
  get diagnostics affected = row_count;
  return affected;
end $$;

create or replace function public.limit_service_requests() returns trigger language plpgsql set search_path='' as $$
declare recent integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(new.email), 1642));
  if tg_table_name='bookings' then
    select count(*) into recent from public.bookings where lower(email)=lower(new.email) and created_at>now()-interval '1 hour';
  else
    select count(*) into recent from public.service_projects where lower(email)=lower(new.email) and created_at>now()-interval '1 hour';
  end if;
  if recent>=3 then raise exception 'request_rate_limit'; end if;
  return new;
end $$;
create trigger service_request_limit before insert on public.bookings for each row execute function public.limit_service_requests();
create trigger service_request_limit before insert on public.service_projects for each row execute function public.limit_service_requests();

create or replace function public.prepare_service_quote(p_type text,p_id uuid,p_amount integer,p_scope text,p_revisions integer,p_deadline date)
returns public.service_quotes language plpgsql set search_path='' as $$
declare q public.service_quotes; current_status text; expiry timestamptz; already_paid boolean;
begin
  if p_type='booking' then
    select status::text,least(starts_at,now()+interval '24 hours') into current_status,expiry from public.bookings where id=p_id for update;
    if current_status is null or current_status not in ('pending','approved_awaiting_payment') then raise exception 'request_not_payable'; end if;
  elsif p_type='project' then
    select status::text,now()+interval '24 hours' into current_status,expiry from public.service_projects where id=p_id for update;
    if current_status is null or current_status not in ('requested','quoted','awaiting_payment') then raise exception 'request_not_payable'; end if;
    if p_deadline is null or p_deadline<current_date then raise exception 'agreed_deadline_required'; end if;
  else raise exception 'invalid_type'; end if;
  select exists(select 1 from public.payments where (booking_id=p_id or project_id=p_id) and status in ('succeeded','refunded')) into already_paid;
  if already_paid then raise exception 'request_already_paid'; end if;
  select * into q from public.service_quotes where (booking_id=p_id or project_id=p_id) and status in ('creating','open') for update;
  if q.id is not null then
    if q.amount_cents=p_amount and q.scope=p_scope and q.revision_count=p_revisions and q.agreed_deadline is not distinct from p_deadline and q.expires_at>now()+interval '31 minutes' then return q; end if;
    raise exception 'expire_previous_quote_first';
  end if;
  if expiry <= now()+interval '31 minutes' then raise exception 'booking_too_close'; end if;
  insert into public.service_quotes(booking_id,project_id,amount_cents,scope,revision_count,agreed_deadline,expires_at)
    values(case when p_type='booking' then p_id end,case when p_type='project' then p_id end,p_amount,p_scope,p_revisions,p_deadline,expiry) returning * into q;
  if p_type='booking' then update public.bookings set hold_expires_at=expiry,price_cents=p_amount,status='approved_awaiting_payment' where id=p_id;
  else update public.service_projects set price_cents=p_amount,agreed_deadline=p_deadline,status='awaiting_payment' where id=p_id; end if;
  return q;
end $$;

-- Fulfilment and payment registration are one transaction. A repeated event never
-- rewinds progress, restores revoked downloads, or resets a refund.
create or replace function public.fulfil_stripe_checkout(p_session text,p_payment text,p_amount integer,p_currency text,p_live boolean,p_event text,p_paid_at timestamptz,p_order uuid default null,p_quote uuid default null)
returns uuid language plpgsql set search_path='' as $$
declare o public.orders; q public.service_quotes; pay public.payments; target_status text; recipient text; reference text; review text;
begin
  if num_nonnulls(p_order,p_quote)<>1 then raise exception 'payment_target_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_payment, 4912));
  select * into pay from public.payments where provider_payment_id=p_payment;
  if pay.id is not null then
    if pay.order_id is distinct from p_order or pay.quote_id is distinct from p_quote or pay.amount_cents<>p_amount or pay.currency<>upper(p_currency) or pay.livemode<>p_live then raise exception 'payment_mismatch'; end if;
    return pay.id;
  end if;
  if p_order is not null then
    select * into o from public.orders where id=p_order for update;
    if o.id is null or o.stripe_checkout_session_id is distinct from p_session or o.total_cents<>p_amount or lower(o.currency)<>lower(p_currency) then raise exception 'payment_mismatch'; end if;
    if o.status='refunded' then raise exception 'order_already_refunded'; end if;
    insert into public.payments(order_id,provider_payment_id,amount_cents,currency,status,raw_event_id,livemode,paid_at)
      values(o.id,p_payment,p_amount,upper(p_currency),'succeeded',p_event,p_live,p_paid_at) returning * into pay;
    update public.orders set status='paid',paid_at=coalesce(paid_at,p_paid_at),stripe_payment_intent_id=p_payment where id=o.id;
    insert into public.entitlements(customer_id,customer_email,order_item_id,beat_id,license_type_id)
      select o.customer_id,o.customer_email,i.id,i.beat_id,i.license_type_id from public.order_items i where i.order_id=o.id on conflict(order_item_id) do nothing;
  else
    select * into q from public.service_quotes where id=p_quote for update;
    if q.id is null or q.stripe_session_id is distinct from p_session or q.amount_cents<>p_amount or lower(q.currency)<>lower(p_currency) then raise exception 'payment_mismatch'; end if;
    if q.booking_id is not null then
      select status::text,email,b.reference into target_status,recipient,reference from public.bookings b where id=q.booking_id for update;
      if target_status not in ('pending','approved_awaiting_payment') then review='Pagamento ricevuto per una sessione non più in attesa: verificare prima di confermare.'; end if;
      if exists(select 1 from public.bookings where id=q.booking_id and hold_expires_at<=now()) then review='Pagamento ricevuto dopo la scadenza della riserva: verificare la disponibilità.'; end if;
    else
      select status::text,email,p.reference into target_status,recipient,reference from public.service_projects p where id=q.project_id for update;
      if target_status not in ('requested','quoted','awaiting_payment') then review='Pagamento ricevuto per un progetto non più in attesa: verificare.'; end if;
    end if;
    if q.status not in ('creating','open') then review='Pagamento ricevuto su un preventivo sostituito o annullato: verificare o rimborsare.'; end if;
    insert into public.payments(booking_id,project_id,quote_id,provider_payment_id,amount_cents,currency,status,raw_event_id,livemode,paid_at,review_reason)
      values(q.booking_id,q.project_id,q.id,p_payment,p_amount,upper(p_currency),'succeeded',p_event,p_live,p_paid_at,review) returning * into pay;
    update public.service_quotes set status='paid' where id=q.id;
    if review is null then
      if q.booking_id is not null then
        update public.bookings set status='confirmed',hold_expires_at=null,updated_at=now() where id=q.booking_id;
        insert into public.booking_status_history(booking_id,from_status,to_status,note) values(q.booking_id,target_status::public.booking_status,'confirmed','Pagamento Stripe verificato.');
      else
        update public.service_projects set status='paid',updated_at=now() where id=q.project_id;
        insert into public.project_status_history(project_id,from_status,to_status) values(q.project_id,target_status::public.project_status,'paid');
      end if;
    end if;
    insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
      values('payment-'||pay.id,recipient,'Pagamento GENKS '||reference,
        case when review is null then 'Pagamento confermato.' else 'Pagamento ricevuto, verifica in corso.' end,
        case when review is null then 'Il pagamento è confermato. Conserva il riferimento '||reference||'. GENKS ti ricontatterà per i prossimi passaggi del lavoro concordato.' else 'Il pagamento è stato ricevuto. GENKS sta verificando la richiesta e ti contatterà prima della conferma del servizio.' end)
      on conflict(dedupe_key) do nothing;
  end if;
  return pay.id;
end $$;

create or replace function public.record_stripe_refund(p_payment text,p_refund text,p_amount integer,p_at timestamptz)
returns void language plpgsql set search_path='' as $$
declare pay public.payments; refunded integer;
begin
  select * into pay from public.payments where provider_payment_id=p_payment for update;
  if pay.id is null then raise exception 'payment_not_recorded'; end if;
  insert into public.payment_adjustments(provider_refund_id,payment_id,amount_cents,occurred_at)
    values(p_refund,pay.id,p_amount,p_at) on conflict(provider_refund_id) do nothing;
  select coalesce(sum(amount_cents),0) into refunded from public.payment_adjustments where payment_id=pay.id;
  if refunded>pay.amount_cents then raise exception 'refund_exceeds_payment'; end if;
  update public.payments set refunded_cents=refunded,status=case when refunded=amount_cents then 'refunded'::public.payment_status else status end,updated_at=now() where id=pay.id;
  if refunded=pay.amount_cents then
    if pay.order_id is not null then
      update public.orders set status='refunded',refunded_at=coalesce(refunded_at,p_at) where id=pay.order_id;
      update public.entitlements set revoked_at=coalesce(revoked_at,now()) where order_item_id in(select id from public.order_items where order_id=pay.order_id);
    end if;
    if pay.booking_id is not null then update public.bookings set status='cancelled',updated_at=now() where id=pay.booking_id; end if;
    if pay.project_id is not null then update public.service_projects set status='cancelled',updated_at=now() where id=pay.project_id; end if;
  end if;
end $$;

create or replace function public.claim_notification(p_id uuid) returns setof public.notification_outbox language sql set search_path='' as $$
  update public.notification_outbox set locked_until=now()+interval '5 minutes',attempts=attempts+1
  where id=p_id and sent_at is null and (locked_until is null or locked_until<now()) returning *;
$$;

create or replace function public.catalog_launch_report() returns jsonb language sql set search_path='' as $$
  with offers as (
    select b.title,l.code,array_remove(array[
      case when coalesce(trim(l.contract_text),'')='' or l.contract_text ilike '%BOZZA DA COMPLETARE%' then 'Contratto da completare' end,
      case when not exists(select 1 from storage.objects s where s.bucket_id='previews' and s.name=b.preview_path) then 'Anteprima mancante' end,
      case when cardinality(l.included_assets)=0 then 'Formati non configurati' end
    ] || array(select 'File '||upper(wanted.asset_kind)||' mancante' from unnest(l.included_assets) as wanted(asset_kind)
      where wanted.asset_kind not in ('mp3','wav','stems') or not exists(
        select 1 from public.beat_assets a join storage.objects s on s.bucket_id=a.bucket and s.name=a.storage_path
        where a.beat_id=b.id and a.kind=wanted.asset_kind and a.bucket='beat-assets' and a.size_bytes>0
      )),null) as problems
    from public.beat_license_prices p join public.beats b on b.id=p.beat_id join public.license_types l on l.id=p.license_type_id
    where b.status='published' and p.active and l.active and not l.is_exclusive
  ) select jsonb_build_object('total',(select count(*) from offers),'ready',(select count(*) from offers where cardinality(problems)=0),
    'blocked',coalesce((select jsonb_agg(to_jsonb(x)) from(select * from offers where cardinality(problems)>0 order by title,code limit 30)x),'[]'::jsonb));
$$;
revoke all on function public.catalog_launch_report() from public,anon,authenticated;
grant execute on function public.catalog_launch_report() to service_role;

create or replace function public.deliver_service_project(p_id uuid,p_url text) returns void language plpgsql set search_path='' as $$
declare p public.service_projects;
begin
  select * into p from public.service_projects where id=p_id for update;
  if p.id is null or p.status not in ('review','delivered') or p_url not like 'https://%' then raise exception 'project_not_deliverable'; end if;
  if not exists(select 1 from public.payments where project_id=p_id and status='succeeded' and refunded_cents<amount_cents and not disputed and review_reason is null) then raise exception 'project_payment_required'; end if;
  update public.service_projects set status='delivered',delivery_url=p_url,updated_at=now() where id=p_id;
  insert into public.project_status_history(project_id,from_status,to_status) values(p_id,p.status,'delivered');
  insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body,action_url,action_label)
    values('delivery-'||p.id||'-'||md5(p_url),p.email,'Consegna GENKS '||p.reference,'Il tuo progetto è pronto.',
      'I file finali di '||p.track_title||' sono pronti. Conserva il riferimento '||p.reference||'. Puoi trovare il collegamento anche nella sezione Progetti accedendo con questa email.',p_url,'Apri i file del progetto') on conflict(dedupe_key) do nothing;
end $$;

create or replace function public.create_studio_blackout(p_start timestamptz,p_end timestamptz,p_reason text) returns void language plpgsql set search_path='' as $$
begin
  lock table public.bookings in share row exclusive mode;
  if p_end<=p_start or exists(select 1 from public.bookings where status in ('pending','approved_awaiting_payment','confirmed') and tstzrange(starts_at,ends_at,'[)') && tstzrange(p_start,p_end,'[)')) then raise exception 'blackout_conflicts_with_booking'; end if;
  insert into public.blackout_dates(starts_at,ends_at,reason) values(p_start,p_end,p_reason);
end $$;
revoke all on function public.deliver_service_project(uuid,text),public.create_studio_blackout(timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.deliver_service_project(uuid,text),public.create_studio_blackout(timestamptz,timestamptz,text) to service_role;

-- All privileged operations are callable only by the server, never by visitors.
revoke all on function public.expire_booking_holds(),public.limit_service_requests(),public.prepare_service_quote(text,uuid,integer,text,integer,date),public.fulfil_stripe_checkout(text,text,integer,text,boolean,text,timestamptz,uuid,uuid),public.record_stripe_refund(text,text,integer,timestamptz),public.claim_notification(uuid) from public,anon,authenticated;
grant execute on function public.expire_booking_holds(),public.limit_service_requests(),public.prepare_service_quote(text,uuid,integer,text,integer,date),public.fulfil_stripe_checkout(text,text,integer,text,boolean,text,timestamptz,uuid,uuid),public.record_stripe_refund(text,text,integer,timestamptz),public.claim_notification(uuid) to service_role;
commit;
