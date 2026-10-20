begin;
do $$
declare bid uuid; aid uuid; owner_id uuid; sid uuid; first_notice uuid; payload jsonb; ref text;
begin
 if exists(select 1 from public.availability_rules where active and (end_time<>'00:00'::time or not ends_next_day or flexible_close or start_time<>case when weekday in(0,6) then '10:00'::time else '19:30'::time end)) then raise exception 'Wrong opening hours'; end if;
 if has_function_privilege('anon','public.set_booking_extra_time(uuid,uuid,integer,integer)','execute') or has_function_privilege('authenticated','public.set_booking_extra_time(uuid,uuid,integer,integer)','execute') then raise exception 'Extra time public'; end if;
 select id into owner_id from public.profiles where role='admin' limit 1;
 select id into sid from public.booking_services where code='recording';
 insert into public.bookings(reference,service_id,name,email,phone,starts_at,ends_at,status,price_cents,hold_expires_at)
 values('BKG-TEST-EXTRA',sid,'GENKS TEST extra','extra-test@example.invalid','0000000000','2026-09-28T19:30:00+02:00','2026-09-28T20:30:00+02:00','confirmed',2000,null) returning id into bid;
 insert into public.studio_cash_agreements(booking_id,amount_cents,details,rate_version) values(bid,2000,'Sessione iniziale 1 ora a 20 EUR','2026-10-20-v2') returning id into aid;
 first_notice:=public.set_booking_extra_time(bid,owner_id,30,0);
 if not exists(select 1 from public.studio_cash_agreements where id=aid and amount_cents=3000 and base_amount_cents=2000 and extra_minutes=30 and received_at is null) then raise exception 'Wrong overtime amount'; end if;
 if public.set_booking_extra_time(bid,owner_id,30,30) is not null then raise exception 'Duplicate adjustment'; end if;
 perform public.set_booking_extra_time(bid,owner_id,60,30);
 if not exists(select 1 from public.studio_cash_agreements where id=aid and amount_cents=4000 and extra_minutes=60) then raise exception 'Overtime accumulated twice'; end if;
 begin
  perform public.set_booking_extra_time(bid,owner_id,90,30); raise exception 'Stale edit accepted';
 exception when others then if sqlerrm<>'Reload current total' then raise; end if; end;
 perform public.set_booking_extra_time(bid,owner_id,15,60);
 begin
  perform public.manage_studio_cash_service('receive','booking',bid,owner_id,2000); raise exception 'Stale receipt accepted';
 exception when others then if sqlerrm<>'Cash total changed' then raise; end if; end;
 perform public.manage_studio_cash_service('receive','booking',bid,owner_id,2500);
 if not exists(select 1 from public.studio_cash_agreements where id=aid and amount_cents=2500 and received_at is not null) then raise exception 'Receipt amount wrong'; end if;
 begin
  perform public.set_booking_extra_time(bid,owner_id,60,15); raise exception 'Received cash changed';
 exception when others then if sqlerrm<>'Extra time not editable' then raise; end if; end;
 if not exists(select 1 from public.bookings where id=bid and ends_at='2026-09-28T20:30:00+02:00' and price_cents=2500) then raise exception 'Scheduled times changed'; end if;
 if not exists(select 1 from public.notification_outbox where dedupe_key='reservation-extra-'||first_notice and recipient='extra-test@example.invalid') then raise exception 'Customer summary missing'; end if;
 payload:=jsonb_build_object('rateVersion','2026-10-20-v2','accepted','on','name','GENKS TEST hours','email','hours-test@example.invalid','phone','0000000000','duration',1,'startsAt','2026-11-14T23:30:00+01:00');
 begin
  perform public.reserve_cash_service('booking',payload,'owner-test@example.invalid'); raise exception 'Midnight overrun accepted';
 exception when others then if sqlerrm<>'booking_unavailable' then raise; end if; end;
 ref:=public.reserve_cash_service('booking',jsonb_set(payload,'{startsAt}','"2026-11-14T23:00:00+01:00"'),'owner-test@example.invalid');
 if not exists(select 1 from public.bookings where reference=ref and ends_at='2026-11-15T00:00:00+01:00') then raise exception 'Midnight ending denied'; end if;
end $$;
rollback;
