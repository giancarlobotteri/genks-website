begin;
alter table public.studio_cash_agreements add column if not exists extra_night_minutes integer not null default 0 check(extra_night_minutes between 0 and extra_minutes);
create or replace function public.set_booking_extra_time_v2(p_id uuid,p_admin uuid,p_minutes integer,p_expected_minutes integer,p_night_minutes integer,p_expected_night_minutes integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare b public.bookings; a public.studio_cash_agreements; base integer; total integer; notice_id uuid;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='admin') then raise exception 'Admin required'; end if;
 if p_minutes is null or p_minutes not between 0 and 1440 or p_night_minutes is null or p_night_minutes not between 0 and p_minutes then raise exception 'Invalid extra minutes'; end if;
 select * into b from public.bookings where id=p_id for update;
 if not found then raise exception 'Booking missing'; end if;
 select * into a from public.studio_cash_agreements where booking_id=p_id for update;
 if not found or a.received_at is not null or a.refunded_at is not null or b.status not in('confirmed','completed')
  or b.ends_at>now() or a.rate_version is distinct from '2026-10-20-v2' then raise exception 'Extra time not editable'; end if;
 if p_expected_minutes is distinct from a.extra_minutes or p_expected_night_minutes is distinct from a.extra_night_minutes then raise exception 'Reload current total'; end if;
 if exists(select 1 from public.payments where booking_id=p_id and status in('succeeded','refunded'))
  or exists(select 1 from public.service_quotes where booking_id=p_id and status in('creating','open','paid')) then raise exception 'Online payment exists'; end if;
 if p_minutes=a.extra_minutes and p_night_minutes=a.extra_night_minutes then return null; end if;
 base:=coalesce(a.base_amount_cents,a.amount_cents);
 total:=base+round(((p_minutes-p_night_minutes)*2000::numeric+p_night_minutes*4000::numeric)/60)::integer;
 update public.studio_cash_agreements set base_amount_cents=base,extra_minutes=p_minutes,extra_night_minutes=p_night_minutes,amount_cents=total where id=a.id;
 -- Scheduled times remain unchanged: this records actual overtime, including after midnight.
 update public.bookings set price_cents=total,updated_at=now() where id=p_id;
 update public.notification_outbox set cancelled_at=now() where dedupe_key='cash-agree-'||a.id and sent_at is null;
 insert into public.admin_audit_log(admin_id,action,entity_type,entity_id,payload)
 values(p_admin,'booking_extra_time','booking',p_id,jsonb_build_object('before_minutes',a.extra_minutes,'after_minutes',p_minutes,'before_night_minutes',a.extra_night_minutes,'after_night_minutes',p_night_minutes,'base_amount_cents',base,'amount_cents',total));
 notice_id:=gen_random_uuid();
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
 values('reservation-extra-'||notice_id,b.email,'GENKS · Totale sessione aggiornato · '||b.reference,'Riepilogo della tua sessione.',
 'Riferimento: '||b.reference||E'\nImporto prenotato: '||to_char(base/100.0,'FM999990.00')||E' EUR\nTempo extra effettivo registrato da GENKS: '||(p_minutes-p_night_minutes)||E' minuti prima di mezzanotte a 20 EUR/ora; '||p_night_minutes||E' minuti dopo mezzanotte a 40 EUR/ora totali. Dopo mezzanotte, ogni 30 minuti comportano 10 EUR in più rispetto alla tariffa ordinaria. Calcolo proporzionale ai minuti effettivi.\nSupplemento: '||to_char((total-base)/100.0,'FM999990.00')||E' EUR\nTotale aggiornato da pagare in contanti: '||to_char(total/100.0,'FM999990.00')||E' EUR\nNessun pagamento o addebito automatico è stato registrato con questo aggiornamento.');
 return notice_id;
end $$;
revoke all on function public.set_booking_extra_time_v2(uuid,uuid,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.set_booking_extra_time_v2(uuid,uuid,integer,integer,integer,integer) to service_role;

revoke all on function public.set_booking_extra_time(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
commit;
