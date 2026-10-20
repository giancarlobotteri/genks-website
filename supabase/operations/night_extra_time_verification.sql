begin;
do $$
declare bid uuid; aid uuid; owner_id uuid; sid uuid; notice_id uuid;
begin
 if has_function_privilege('anon','public.set_booking_extra_time_v2(uuid,uuid,integer,integer,integer,integer)','execute') or has_function_privilege('authenticated','public.set_booking_extra_time_v2(uuid,uuid,integer,integer,integer,integer)','execute') or has_function_privilege('service_role','public.set_booking_extra_time(uuid,uuid,integer,integer)','execute') then raise exception 'Wrong RPC permissions'; end if;
 select id into owner_id from public.profiles where role='admin' limit 1;
 select id into sid from public.booking_services where code='recording';
 insert into public.bookings(reference,service_id,name,email,phone,starts_at,ends_at,status,price_cents,hold_expires_at)
 values('BKG-TEST-NIGHT',sid,'GENKS TEST notte','night-test@example.invalid','0000000000','2026-09-28T19:30:00+02:00','2026-09-28T20:30:00+02:00','confirmed',2000,null) returning id into bid;
 insert into public.studio_cash_agreements(booking_id,amount_cents,details,rate_version) values(bid,2000,'Sessione iniziale 1 ora a 20 EUR','2026-10-20-v2') returning id into aid;
 notice_id:=public.set_booking_extra_time_v2(bid,owner_id,30,0,30,0);
 if not exists(select 1 from public.studio_cash_agreements where id=aid and amount_cents=4000 and extra_night_minutes=30 and received_at is null) then raise exception 'Night half-hour must cost 20 EUR total'; end if;
 perform public.set_booking_extra_time_v2(bid,owner_id,60,30,30,30);
 if not exists(select 1 from public.studio_cash_agreements where id=aid and amount_cents=5000 and base_amount_cents=2000) then raise exception 'Mixed bands wrong'; end if;
 perform public.set_booking_extra_time_v2(bid,owner_id,60,60,60,30);
 if not exists(select 1 from public.studio_cash_agreements where id=aid and amount_cents=6000) then raise exception 'Same total with new night split ignored'; end if;
 if public.set_booking_extra_time_v2(bid,owner_id,60,60,60,60) is not null then raise exception 'Repeated update duplicated'; end if;
 begin
  perform public.set_booking_extra_time_v2(bid,owner_id,60,60,30,30); raise exception 'Stale night split accepted';
 exception when others then if sqlerrm<>'Reload current total' then raise; end if; end;
 begin
  perform public.set_booking_extra_time_v2(bid,owner_id,30,60,60,60); raise exception 'Night exceeding total accepted';
 exception when others then if sqlerrm<>'Invalid extra minutes' then raise; end if; end;
 perform public.set_booking_extra_time_v2(bid,owner_id,15,60,10,60);
 if not exists(select 1 from public.studio_cash_agreements where id=aid and amount_cents=2833) then raise exception 'Rounding differs'; end if;
 perform public.manage_studio_cash_service('receive','booking',bid,owner_id,2833);
 begin
  perform public.set_booking_extra_time_v2(bid,owner_id,30,15,30,10); raise exception 'Paid total edited';
 exception when others then if sqlerrm<>'Extra time not editable' then raise; end if; end;
 if not exists(select 1 from public.notification_outbox where dedupe_key='reservation-extra-'||notice_id and body like '%40 EUR/ora totali%' and recipient='night-test@example.invalid') then raise exception 'Wrong customer email'; end if;
end $$;
rollback;
