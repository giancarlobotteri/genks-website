begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
-- Additional least-privilege hardening where the connection owns the extension.
-- Managed Supabase net objects may be owned by supabase_admin: REVOKE can warn
-- without changing effective privileges. Verify ACLs explicitly. Keep net out
-- of exposed Data API schemas; worker tickets and public RPCs are separately protected.
revoke usage on schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
create schema if not exists genks_private;
create table if not exists genks_private.booking_reminders(
  id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id) on delete cascade,
  starts_at timestamptz not null,ends_at timestamptz not null,recipient text not null,
  hours_before integer not null check(hours_before in(24,2)),due_at timestamptz not null,
  status text not null default 'waiting' check(status in('waiting','processing','sent','cancelled','expired','failed')),
  attempts integer not null default 0,next_attempt_at timestamptz not null default now(),locked_until timestamptz,
  sent_at timestamptz,email_id text,last_error text,created_at timestamptz not null default now()
);
create index if not exists booking_reminders_due on genks_private.booking_reminders(due_at) where status in('waiting','processing');
create table if not exists genks_private.reminder_dispatch_tickets(fingerprint text primary key,expires_at timestamptz not null);
create table if not exists genks_private.reminder_scheduler_state(
  id boolean primary key default true check(id),last_checked_at timestamptz,last_dispatch_at timestamptz,
  last_success_at timestamptz,last_request_id bigint,last_http_status integer,last_failures integer not null default 0
);
alter table genks_private.booking_reminders enable row level security;
alter table genks_private.reminder_dispatch_tickets enable row level security;
alter table genks_private.reminder_scheduler_state enable row level security;
revoke all on genks_private.booking_reminders,genks_private.reminder_dispatch_tickets,genks_private.reminder_scheduler_state from public,anon,authenticated;
grant usage on schema genks_private to service_role;
grant all on genks_private.booking_reminders,genks_private.reminder_dispatch_tickets,genks_private.reminder_scheduler_state to service_role;
insert into genks_private.reminder_scheduler_state(id) values(true) on conflict do nothing;
insert into public.site_settings(key,value) values('booking_reminders','{"enabled":false}') on conflict do nothing;

create or replace function genks_private.sync_booking_reminders() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and (old.status,old.starts_at,old.ends_at,old.email,old.name) is not distinct from (new.status,new.starts_at,new.ends_at,new.email,new.name) then return new; end if;
  update genks_private.booking_reminders set status='cancelled',locked_until=null
    where booking_id=new.id and sent_at is null and status in('waiting','processing','failed');
  if new.status='confirmed' and new.starts_at>now() then
    insert into genks_private.booking_reminders(booking_id,starts_at,ends_at,recipient,hours_before,due_at)
    select new.id,new.starts_at,new.ends_at,lower(new.email),hours,new.starts_at-make_interval(hours=>hours)
    from (values(24),(2)) as offsets(hours) where new.starts_at-make_interval(hours=>hours)>now();
  end if;
  return new;
end $$;
revoke all on function genks_private.sync_booking_reminders() from public,anon,authenticated;
drop trigger if exists booking_reminders_sync on public.bookings;
create trigger booking_reminders_sync after insert or update of status,starts_at,ends_at,email,name on public.bookings
for each row execute function genks_private.sync_booking_reminders();

create or replace function public.claim_booking_reminders(p_limit integer default 10)
returns table(id uuid,booking_id uuid,recipient text,hours_before integer,starts_at timestamptz,ends_at timestamptz)
language plpgsql set search_path='' as $$
begin
  if not coalesce((select (value->>'enabled')::boolean from public.site_settings where key='booking_reminders'),false) then return; end if;
  update genks_private.booking_reminders r set status='expired',locked_until=null,last_error='Finestra del promemoria trascorsa: invio omesso.'
    where r.status in('waiting','processing') and r.due_at<now()-interval '30 minutes';
  return query with due as (
    select r.id from genks_private.booking_reminders r join public.bookings b on b.id=r.booking_id
    where r.status in('waiting','processing') and r.due_at<=now() and r.due_at>=now()-interval '30 minutes'
      and r.next_attempt_at<=now() and (r.locked_until is null or r.locked_until<now()) and r.attempts<6
      and b.status='confirmed' and b.starts_at>now() and b.starts_at=r.starts_at and b.ends_at=r.ends_at and lower(b.email)=r.recipient
    order by r.due_at,r.id limit greatest(1,least(p_limit,10)) for update of r skip locked
  ) update genks_private.booking_reminders r set status='processing',attempts=r.attempts+1,locked_until=now()+interval '2 minutes'
    from due where r.id=due.id returning r.id,r.booking_id,r.recipient,r.hours_before,r.starts_at,r.ends_at;
end $$;
create or replace function public.finish_booking_reminder(p_id uuid,p_result text,p_email_id text default null)
returns boolean language plpgsql set search_path='' as $$
begin
  if p_result='sent' then
    update genks_private.booking_reminders set status=case when status='cancelled' then 'cancelled' else 'sent' end,
      sent_at=now(),email_id=p_email_id,locked_until=null,last_error=null where id=p_id and sent_at is null;
  elsif p_result='cancelled' then
    update genks_private.booking_reminders set status='cancelled',locked_until=null where id=p_id and sent_at is null;
  elsif p_result='failed' then
    update genks_private.booking_reminders set status=case when attempts>=6 then 'failed' else 'waiting' end,locked_until=null,
      next_attempt_at=now()+make_interval(mins=>least(16,power(2,attempts)::integer)),last_error='Invio non confermato. Controllare quota email e Resend.'
      where id=p_id and status='processing' and sent_at is null;
  else return false; end if;
  return found;
end $$;
create or replace function public.consume_reminder_dispatch(p_ticket text) returns boolean language plpgsql set search_path='' as $$
begin
  if p_ticket !~ '^[a-f0-9]{64}$' then return false; end if;
  delete from genks_private.reminder_dispatch_tickets where fingerprint=encode(extensions.digest(p_ticket,'sha256'),'hex') and expires_at>now();
  return found;
end $$;
create or replace function public.record_reminder_dispatch(p_failures integer) returns void language sql set search_path='' as $$
  update genks_private.reminder_scheduler_state set last_success_at=case when p_failures=0 then now() else last_success_at end,last_failures=p_failures where id;
$$;
create or replace function public.booking_reminder_report() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('enabled',coalesce((select (value->>'enabled')::boolean from public.site_settings where key='booking_reminders'),false),
  'waiting',(select count(*) from genks_private.booking_reminders where status='waiting'),
  'sent',(select count(*) from genks_private.booking_reminders where sent_at is not null),
  'failed',(select count(*) from genks_private.booking_reminders where status in('failed','expired') or last_error is not null),
  'scheduler',(select to_jsonb(s) from genks_private.reminder_scheduler_state s where id));
$$;
revoke all on function public.claim_booking_reminders(integer),public.finish_booking_reminder(uuid,text,text),public.consume_reminder_dispatch(text),public.record_reminder_dispatch(integer),public.booking_reminder_report() from public,anon,authenticated;
grant execute on function public.claim_booking_reminders(integer),public.finish_booking_reminder(uuid,text,text),public.consume_reminder_dispatch(text),public.record_reminder_dispatch(integer),public.booking_reminder_report() to service_role;

create or replace function genks_private.dispatch_booking_reminders(p_force boolean default false) returns bigint language plpgsql set search_path='' as $$
declare ticket text; request_id bigint; previous bigint;
begin
  select last_request_id into previous from genks_private.reminder_scheduler_state where id;
  update genks_private.reminder_scheduler_state set last_checked_at=now(),last_http_status=coalesce((select status_code from net._http_response where id=previous),last_http_status) where id;
  delete from genks_private.reminder_dispatch_tickets where expires_at<now();
  if not p_force and not coalesce((select (value->>'enabled')::boolean from public.site_settings where key='booking_reminders'),false) then return null; end if;
  if not p_force and not exists(select 1 from genks_private.booking_reminders where status in('waiting','processing') and due_at<=now() and due_at>=now()-interval '30 minutes' and next_attempt_at<=now() and (locked_until is null or locked_until<now()))
    and exists(select 1 from genks_private.reminder_scheduler_state where id and last_dispatch_at>now()-interval '15 minutes') then return null; end if;
  ticket:=encode(extensions.gen_random_bytes(32),'hex');
  insert into genks_private.reminder_dispatch_tickets values(encode(extensions.digest(ticket,'sha256'),'hex'),now()+interval '2 minutes');
  select net.http_post(url:='https://www.prodbygenks.com/api/internal/booking-reminders',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('ticket',ticket),timeout_milliseconds:=60000) into request_id;
  update genks_private.reminder_scheduler_state set last_dispatch_at=now(),last_request_id=request_id where id;
  return request_id;
end $$;
revoke all on function genks_private.dispatch_booking_reminders(boolean) from public,anon,authenticated,service_role;
select cron.schedule('genks-booking-reminders','* * * * *','select genks_private.dispatch_booking_reminders();');
commit;
