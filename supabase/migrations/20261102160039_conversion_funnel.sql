-- Optional first-party purchase-path statistics. No public table access.
create table public.genks_funnel_events (
 session_id uuid not null,
 step text not null check (step in ('service_selected','form_started','checkout_viewed','payment_started','payment_completed','cash_order','checkout_error')),
 service text not null check (service in ('mix','master','mix_master','recording','custom','production','beat_voice','masters','voice','hours','turnkey','cart')),
 device text not null check (device in ('mobile','desktop')),
 quote_id uuid,
 created_at timestamptz not null default now(),
 primary key(session_id,step,service)
);
alter table public.genks_funnel_events enable row level security;
revoke all on public.genks_funnel_events from public,anon,authenticated;
grant select,insert,delete on public.genks_funnel_events to service_role;
create index genks_funnel_time on public.genks_funnel_events(created_at);
create index genks_funnel_quote on public.genks_funnel_events(quote_id) where quote_id is not null;
create function public.genks_funnel_record(p_session uuid,p_step text,p_service text,p_device text,p_quote uuid default null)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 -- Shared lock makes the storage ceiling effective across simultaneous requests.
 perform pg_advisory_xact_lock(817240629);
 if exists(select 1 from public.genks_funnel_events where session_id=p_session and step=p_step and service=p_service) then return true;end if;
 if (select count(*) from public.genks_funnel_events where created_at>=date_trunc('day',now()))>=2000 then return false;end if;
 if (select count(*) from public.genks_funnel_events where session_id=p_session)>=50 then return false;end if;
 insert into public.genks_funnel_events(session_id,step,service,device,quote_id) values(p_session,p_step,p_service,p_device,p_quote);
 return true;
end $$;
revoke all on function public.genks_funnel_record(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.genks_funnel_record(uuid,text,text,text,uuid) to service_role;
create function public.genks_funnel_report(p_from date,p_to date,p_service text default '',p_device text default '')
returns jsonb language sql stable security invoker set search_path='' as $$
 with starts as (
 select distinct on(session_id) session_id,service,device,created_at from public.genks_funnel_events
 where step='service_selected' and created_at>=now()-interval '90 days'
 order by session_id,created_at,service
 ),cohort as (
 select * from starts where created_at>=(p_from::timestamp at time zone 'Europe/Rome') and created_at<((p_to+1)::timestamp at time zone 'Europe/Rome')
 and (p_service='' or service=p_service) and(p_device='' or device=p_device)
 ),flags as (
 select c.session_id,c.service,c.device,max(e.created_at) last_at,
 bool_or(e.step='form_started') f,bool_or(e.step='checkout_viewed') c,
 bool_or(e.step='payment_started') p,bool_or(e.step='payment_completed') paid,
 bool_or(e.step='cash_order') cash,bool_or(e.step='checkout_error') error
 from cohort c join public.genks_funnel_events e using(session_id) group by c.session_id,c.service,c.device
 ),journeys as (
 select *,case when paid then 5 when p and c and f then 4 when c and f then 3 when f then 2 else 1 end stage,
 last_at<now()-interval '30 minutes' mature from flags
 ),steps as (
 select n,count(*) filter(where j.stage>=n)::int reached,
 count(*) filter(where j.stage=n and j.mature and not j.cash and not j.paid)::int abandoned
 from generate_series(1,5)n left join journeys j on true group by n order by n
 )
 select jsonb_build_object(
 'rows',(select jsonb_agg(jsonb_build_object('step',(array['service_selected','form_started','checkout_viewed','payment_started','payment_completed'])[n],'reached',reached,'abandoned',abandoned) order by n) from steps),
 'sessions',(select count(*) from journeys),'active',(select count(*) from journeys where not mature and not paid and not cash),
 'cash',(select count(*) from journeys where cash),'errors',(select count(*) from journeys where error),
 'devices',coalesce((select jsonb_agg(to_jsonb(d)) from(select device,count(*)::int sessions,count(*) filter(where paid)::int paid from journeys group by device order by sessions desc)d),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(to_jsonb(d)) from(select service,count(*)::int sessions,count(*) filter(where paid)::int paid from journeys group by service order by sessions desc)d),'[]'::jsonb)
 );
$$;
revoke all on function public.genks_funnel_report(date,date,text,text) from public,anon,authenticated;
grant execute on function public.genks_funnel_report(date,date,text,text) to service_role;
comment on table public.genks_funnel_events is 'Optional consent v1; session identifiers, allowlisted steps/service/device only; no contact fields. Retained 90 days by existing maintenance task. Payments are server-verified; clients cannot submit payment steps.';

create function public.genks_funnel_reconcile() returns integer language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 insert into public.genks_funnel_events(session_id,step,service,device,quote_id)
 select e.session_id,'payment_completed',e.service,e.device,e.quote_id from public.genks_funnel_events e
 where e.step='payment_started' and e.created_at>now()-interval '90 days'
 and exists(select 1 from public.payments p where p.quote_id=e.quote_id and p.livemode=true and p.status='succeeded')
 on conflict do nothing;
 get diagnostics affected=row_count;return affected;
end $$;
revoke all on function public.genks_funnel_reconcile() from public,anon,authenticated;
grant execute on function public.genks_funnel_reconcile() to service_role;
