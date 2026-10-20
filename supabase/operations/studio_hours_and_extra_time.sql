begin;
update public.availability_rules set start_time=case when weekday in(0,6) then '10:00'::time else '19:30'::time end,
 end_time='00:00',ends_next_day=true,flexible_close=false where active;

alter table public.studio_cash_agreements add column if not exists base_amount_cents integer;
alter table public.studio_cash_agreements add column if not exists extra_minutes integer not null default 0 check(extra_minutes between 0 and 1440);
update public.studio_cash_agreements set base_amount_cents=amount_cents where booking_id is not null and base_amount_cents is null;

create or replace function public.set_booking_extra_time(p_id uuid,p_admin uuid,p_minutes integer,p_expected_minutes integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare b public.bookings; a public.studio_cash_agreements; base integer; total integer; notice_id uuid;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='admin') then raise exception 'Admin required'; end if;
 if p_minutes is null or p_minutes not between 0 and 1440 then raise exception 'Invalid extra minutes'; end if;
 select * into b from public.bookings where id=p_id for update;
 if not found then raise exception 'Booking missing'; end if;
 select * into a from public.studio_cash_agreements where booking_id=p_id for update;
 if not found or a.received_at is not null or a.refunded_at is not null or b.status not in('confirmed','completed')
  or b.ends_at>now() or a.rate_version is distinct from '2026-10-20-v2' then raise exception 'Extra time not editable'; end if;
 if p_expected_minutes is distinct from a.extra_minutes then raise exception 'Reload current total'; end if;
 if exists(select 1 from public.payments where booking_id=p_id and status in('succeeded','refunded'))
  or exists(select 1 from public.service_quotes where booking_id=p_id and status in('creating','open','paid')) then raise exception 'Online payment exists'; end if;
 if p_minutes=a.extra_minutes then return null; end if;
 base:=coalesce(a.base_amount_cents,a.amount_cents);
 total:=base+round(p_minutes*2000::numeric/60)::integer;
 update public.studio_cash_agreements set base_amount_cents=base,extra_minutes=p_minutes,amount_cents=total where id=a.id;
 -- Scheduled times remain unchanged: this records actual overtime, including after midnight.
 update public.bookings set price_cents=total,updated_at=now() where id=p_id;
 update public.notification_outbox set cancelled_at=now() where dedupe_key='cash-agree-'||a.id and sent_at is null;
 insert into public.admin_audit_log(admin_id,action,entity_type,entity_id,payload)
 values(p_admin,'booking_extra_time','booking',p_id,jsonb_build_object('before_minutes',a.extra_minutes,'after_minutes',p_minutes,'base_amount_cents',base,'amount_cents',total));
 notice_id:=gen_random_uuid();
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
 values('reservation-extra-'||notice_id,b.email,'GENKS · Totale sessione aggiornato · '||b.reference,'Riepilogo della tua sessione.',
 'Riferimento: '||b.reference||E'\nImporto prenotato: '||to_char(base/100.0,'FM999990.00')||E' EUR\nTempo extra effettivo registrato da GENKS: '||p_minutes||E' minuti, alla tariffa di 20 EUR/ora.\nSupplemento: '||to_char((total-base)/100.0,'FM999990.00')||E' EUR\nTotale aggiornato da pagare in contanti: '||to_char(total/100.0,'FM999990.00')||E' EUR\nNessun pagamento o addebito automatico è stato registrato con questo aggiornamento.');
 return notice_id;
end $$;
revoke all on function public.set_booking_extra_time(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.set_booking_extra_time(uuid,uuid,integer,integer) to service_role;
-- An old open tab must not record a different amount after another tab adds overtime.
do $patch$
declare definition text;
begin
 definition:=pg_get_functiondef('public.manage_studio_cash_service(text,text,uuid,uuid,integer,text,integer,date,text)'::regprocedure);
 if position('Cash total changed' in definition)=0 then
  if position('elsif p_action=''receive'' then' in definition)=0 then raise exception 'Receipt function changed'; end if;
  definition:=replace(definition,'elsif p_action=''receive'' then','elsif p_action=''receive'' then if p_amount is distinct from a.amount_cents then raise exception ''Cash total changed''; end if;');
  execute definition;
 end if;
end $patch$;
commit;
