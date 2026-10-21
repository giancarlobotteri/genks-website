begin;
do $$
declare payload jsonb; ref text; bid uuid; hours numeric; invalid_hours numeric;
begin
 if has_function_privilege('anon','public.reserve_cash_service(text,jsonb,text)','execute') or has_function_privilege('authenticated','public.reserve_cash_service(text,jsonb,text)','execute') then raise exception 'Public reservation RPC'; end if;
 foreach hours in array array[0.25,0.5,1.25,8] loop
  begin
   payload:=jsonb_build_object('rateVersion','2026-10-20-v2','accepted','on','name','GENKS TEST quarters','email','quarters-test@example.invalid','phone','0000000000','duration',hours,'startsAt','2027-01-02T10:00:00+01:00');
   ref:=public.reserve_cash_service('booking',payload,'owner-test@example.invalid');
   select id into bid from public.bookings where reference=ref and status='confirmed' and price_cents=hours*2000 and ends_at-starts_at=make_interval(mins=>(hours*60)::integer);
   if bid is null then raise exception 'Wrong duration or price: %',hours; end if;
   if not exists(select 1 from public.studio_cash_agreements where booking_id=bid and amount_cents=hours*2000 and received_at is null) then raise exception 'Wrong cash snapshot'; end if;
   begin
    perform public.reserve_cash_service('booking',payload,'owner-test@example.invalid');
    raise exception 'Overlap accepted';
   exception when exclusion_violation then null;
   when others then if sqlerrm not like '%booking_conflict%' then raise; end if; end;
   raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
 end loop;
 foreach invalid_hours in array array[0,0.1,0.3,8.25] loop
  begin
   perform public.reserve_cash_service('booking',jsonb_set(payload,'{duration}',to_jsonb(invalid_hours)),'owner-test@example.invalid');
   raise exception 'Invalid duration accepted';
  exception when others then if sqlerrm<>'invalid_duration' then raise; end if; end;
 end loop;
 payload:=jsonb_set(jsonb_set(payload,'{duration}','0.5'),'{startsAt}','"2027-01-02T23:30:00+01:00"');
 begin
 ref:=public.reserve_cash_service('booking',payload,'owner-test@example.invalid');
 if not exists(select 1 from public.bookings where reference=ref and ends_at='2027-01-03T00:00:00+01:00') then raise exception 'Midnight boundary'; end if;
 raise sqlstate 'Z0001';
 exception when sqlstate 'Z0001' then null; end;
 begin
  perform public.reserve_cash_service('booking',jsonb_set(payload,'{duration}','0.75'),'owner-test@example.invalid');
  raise exception 'After midnight accepted';
 exception when others then if sqlerrm<>'booking_unavailable' then raise; end if; end;
end $$;
rollback;
