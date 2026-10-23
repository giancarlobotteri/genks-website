-- Additive release. Existing orders, prices, contracts and checkout functions stay intact.
alter table public.service_projects drop constraint service_projects_service_check;
alter table public.service_projects add constraint service_projects_service_check check(service in ('mix','master','mix_master','studio_package'));

create table public.studio_package_credits (
 project_id uuid primary key references public.service_projects(id),
 minutes_included integer not null check(minutes_included in (180,300)),
 minutes_used integer not null default 0 check(minutes_used>=0 and minutes_used<=minutes_included),
 validity_days integer check(validity_days=90),
 updated_at timestamptz not null default now()
);
alter table public.studio_package_credits enable row level security;
revoke all on public.studio_package_credits from public,anon,authenticated;
grant all on public.studio_package_credits to service_role;

create function public.reserve_service_order_v7(p_data jsonb,p_quote jsonb,p_summary text,p_terms text,p_terms_version text,p_owner_email text)
returns jsonb language plpgsql set search_path='' as $$
declare p public.service_projects; q public.service_quotes; aid uuid; total integer; recipient text; first_song jsonb; n integer; method text; service text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server_only'; end if;
 method:=p_data->>'payment';recipient:=lower(trim(p_data->>'email'));
 if p_data->>'accepted' is distinct from 'on' or method is null or method not in ('card','cash')
 or p_data->>'mode' is null or p_data->>'mode' not in ('studio','remote') or method='cash' and p_data->>'mode'<>'studio'
 or p_data->>'rateVersion' is distinct from '2026-10-22-project-v6' or p_quote->>'version' is distinct from '2026-10-22-project-v6'
 or length(p_terms)<100 or length(p_summary)<10 or length(trim(p_data->>'name')) not between 2 and 120
 or recipient is null or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or (p_data->>'earlyStart')::boolean and not coalesce((p_data->>'withdrawalAcknowledged')::boolean,false)
 then raise exception 'invalid_order'; end if;
 if jsonb_typeof(p_quote->'songs') is distinct from 'array' or jsonb_typeof(p_quote->'lines') is distinct from 'array' then raise exception 'invalid_snapshot'; end if;
 n:=jsonb_array_length(p_quote->'songs');total:=(p_quote->>'totalCents')::integer;
 if n not between 0 and 20 or jsonb_array_length(p_quote->'lines') not between 1 and 100 or total<50
 or total is distinct from (p_data->>'expectedTotal')::integer
 or total is distinct from (select sum((l->>'quantity')::integer*(l->>'unitAmount')::integer)::integer from jsonb_array_elements(p_quote->'lines') l)
 or exists(select 1 from jsonb_array_elements(p_quote->'lines') l where (l->>'quantity')::integer not between 1 and 48 or (l->>'unitAmount')::integer<0)
 then raise exception 'invalid_total'; end if;
 if n=0 and (p_quote->>'packageCode' is distinct from 'hours' or total<>10999 or (p_quote->>'studioMinutes')::integer<>300) then raise exception 'invalid_hours_package'; end if;
 if n>0 and total is distinct from (select sum((s->>'amountCents')::integer)::integer from jsonb_array_elements(p_quote->'songs') s)+(case when (p_quote->>'rush')::boolean then 3000 else 0 end) then raise exception 'invalid_song_total'; end if;
 first_song:=p_quote->'songs'->0;service:=case when n=0 then 'studio_package' else first_song->>'service' end;
 insert into public.service_projects(customer_id,name,artist_name,email,phone,track_title,service,description,track_count,reference_links,notes,status,price_cents,songs,commerce_snapshot)
 values(nullif(p_data->>'customerId','')::uuid,trim(p_data->>'name'),nullif(p_data->>'artistName',''),recipient,nullif(p_data->>'phone',''),
 case when n=0 then p_quote->>'packageName' when n=1 then first_song->>'trackTitle' else n||' brani · '||left(first_song->>'trackTitle',130) end,
 service,coalesce(first_song->>'description',p_quote->>'packageName'),greatest(1,(select sum((s->>'trackCount')::integer)::integer from jsonb_array_elements(p_quote->'songs') s)),
 array(select jsonb_array_elements_text(coalesce(p_data->'links','[]'::jsonb))),
 'Modalità: '||(p_data->>'mode')||chr(10)||'Pagamento: '||method||chr(10)||coalesce(p_data->>'notes',''),
 case when method='card' then 'awaiting_payment'::public.project_status else 'in_progress'::public.project_status end,total,p_quote->'songs',p_quote) returning * into p;
 insert into public.project_contracts(project_id,terms_version,terms_body,early_start_requested,withdrawal_acknowledged,amount_cents,track_count,revision_count,first_version_hours)
 values(p.id,p_terms_version,p_terms||chr(10)||chr(10)||p_summary,coalesce((p_data->>'earlyStart')::boolean,false),coalesce((p_data->>'withdrawalAcknowledged')::boolean,false),total,p.track_count,case when n=0 then 0 else 2 end,case when (p_quote->>'rush')::boolean then 48 end);
 if (p_quote->>'studioMinutes')::integer>0 then
  insert into public.studio_package_credits(project_id,minutes_included,validity_days) values(p.id,(p_quote->>'studioMinutes')::integer,(p_quote->>'validityDays')::integer);
 end if;
 update public.notification_outbox set cancelled_at=now() where dedupe_key='request-'||p.reference||'-customer' and sent_at is null;
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
 values('contract-'||p.id,recipient,'GENKS · Riepilogo · '||p.reference,'Il riepilogo del tuo ordine.',p_summary||chr(10)||p_terms);
 if method='card' then
  insert into public.service_quotes(project_id,amount_cents,scope,revision_count,expires_at,fixed_price,commerce_snapshot)
  values(p.id,total,p_summary,case when n=0 then 0 else 2 end,now()+interval '2 hours',true,p_quote) returning * into q;
  return to_jsonb(q)||jsonb_build_object('reference',p.reference,'project_id',p.id);
 else
  insert into public.studio_cash_agreements(project_id,amount_cents,details,revision_count,customer_accepted_at,rate_version,fulfillment_mode)
  values(p.id,total,p_summary,case when n=0 then 0 else 2 end,now(),p_data->>'rateVersion','studio') returning id into aid;
  insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body) values
  ('cash-agree-'||aid,recipient,'GENKS · Prenotazione confermata · '||p.reference,'La tua prenotazione è confermata.',p_summary||chr(10)||'Pagamento in contanti presso lo studio. Nessun incasso ancora registrato.'),
  ('reservation-'||p.reference||'-admin',p_owner_email,'GENKS · Nuova prenotazione · '||p.reference,'Hai una nuova prenotazione',p_summary);
  return jsonb_build_object('reference',p.reference,'project_id',p.id);
 end if;
end $$;
revoke all on function public.reserve_service_order_v7(jsonb,jsonb,text,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_service_order_v7(jsonb,jsonb,text,text,text,text) to service_role;

create function public.reserve_recording_checkout_v7(p_data jsonb,p_summary text)
returns jsonb language plpgsql set search_path='' as $$
declare ref text; b public.bookings; q public.service_quotes;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_data->>'payment' is distinct from 'card' then raise exception 'server_only'; end if;
 -- Reuse the validated price, availability trigger, exclusion constraint and request limits atomically.
 if (p_data->>'startsAt')::timestamptz <= now()+interval '35 minutes' then raise exception 'booking_too_close'; end if;
 ref:=public.reserve_cash_service_v5('booking',p_data,'prod.genks@gmail.com');
 select * into strict b from public.bookings where reference=ref for update;
 update public.bookings set status='approved_awaiting_payment',hold_expires_at=now()+interval '35 minutes' where id=b.id;
 -- No cash receipt or confirmed appointment may leave this transaction before payment.
 delete from public.studio_cash_agreements where booking_id=b.id and received_at is null;
 update public.notification_outbox set cancelled_at=now() where sent_at is null and (dedupe_key='reservation-'||ref||'-admin' or dedupe_key like 'cash-agree-%' and body like '%'||ref||'%');
 insert into public.service_quotes(booking_id,amount_cents,scope,revision_count,expires_at,fixed_price)
 values(b.id,b.price_cents,p_summary,0,now()+interval '31 minutes',true) returning * into q;
 return to_jsonb(q)||jsonb_build_object('reference',ref);
end $$;
revoke all on function public.reserve_recording_checkout_v7(jsonb,text) from public,anon,authenticated;
grant execute on function public.reserve_recording_checkout_v7(jsonb,text) to service_role;

create function public.set_package_minutes_v7(p_id uuid,p_minutes integer,p_expected integer)
returns void language plpgsql set search_path='' as $$
declare c public.studio_package_credits; paid_at timestamptz;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server_only'; end if;
 select * into strict c from public.studio_package_credits where project_id=p_id for update;
 if exists(select 1 from public.service_projects where id=p_id and status='cancelled') then raise exception 'package_cancelled'; end if;
 if exists(select 1 from public.project_contracts where project_id=p_id and not early_start_requested and accepted_at>now()-interval '14 days') then raise exception 'early_start_not_requested'; end if;
 if c.minutes_used<>p_expected or p_minutes<0 or p_minutes>c.minutes_included then raise exception 'invalid_minutes'; end if;
 select min(p.paid_at) into paid_at from public.payments p where p.project_id=p_id and p.status='succeeded' and p.refunded_cents<p.amount_cents and not p.disputed;
 if paid_at is null then raise exception 'payment_required'; end if;
 if c.validity_days is not null and now()>paid_at+make_interval(days=>c.validity_days) then raise exception 'package_expired'; end if;
 update public.studio_package_credits set minutes_used=p_minutes,updated_at=now() where project_id=p_id;
end $$;
revoke all on function public.set_package_minutes_v7(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.set_package_minutes_v7(uuid,integer,integer) to service_role;
