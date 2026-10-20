-- All requests, emails, cash records and histories are rolled back. No emails or payments sent.
begin;
do $$
declare owner_id uuid; bid uuid; pid uuid; aid uuid; stamp timestamptz; denied boolean:=false; start_at timestamptz;
begin
 select id into owner_id from public.profiles where role='admin' limit 1;
 start_at:=((current_date+14)+time '19:30') at time zone 'Europe/Rome';
 insert into public.bookings(reference,service_id,name,email,phone,starts_at,ends_at)
 select 'BKG-CASH-FIXTURE',id,'Cash fixture','cash-fixture@example.invalid','0000000',start_at,start_at+interval '1 hour' from public.booking_services where code='recording' and active limit 1 returning id into bid;
 aid:=public.manage_studio_cash_service('agree','booking',bid,owner_id,10000,'Fixture: sessione e importo concordati');
 if (select status from public.bookings where id=bid)<>'confirmed' then raise exception 'Booking not confirmed'; end if;
 if (select count(*) from genks_private.booking_reminders where booking_id=bid and status='waiting')<>2 then raise exception 'Missing booking reminders'; end if;
 if exists(select 1 from public.studio_cash_agreements where id=aid and received_at is not null) then raise exception 'Agreement must not invent revenue'; end if;
 perform public.manage_studio_cash_service('receive','booking',bid,owner_id);
 select received_at into stamp from public.studio_cash_agreements where id=aid;
 if stamp is null then raise exception 'Receipt missing'; end if;
 perform public.manage_studio_cash_service('receive','booking',bid,owner_id);
 if (select count(*) from public.notification_outbox where dedupe_key='cash-receive-'||aid)<>1 then raise exception 'Duplicate receipt notification'; end if;
 perform public.manage_studio_cash_service('refund','booking',bid,owner_id);
 if (select refunded_at from public.studio_cash_agreements where id=aid) is null then raise exception 'Cash refund missing'; end if;
 if exists(select 1 from genks_private.booking_reminders where booking_id=bid and status='waiting') then raise exception 'Cancelled cash session retains reminders'; end if;
 insert into public.service_projects(name,email,track_title,service,description) values('Cash fixture','cash-fixture@example.invalid','Fixture song','mix','Transactional verification only') returning id into pid;
 aid:=public.manage_studio_cash_service('agree','project',pid,owner_id,15000,'Fixture: mix concordato con una revisione',1,current_date+15);
 update public.service_projects set status='review' where id=pid;
 begin perform public.manage_studio_cash_service('deliver','project',pid,owner_id,p_url=>'https://example.invalid/private-fixture'); exception when others then denied:=true; end;
 if not denied then raise exception 'Unpaid project delivered'; end if;
 perform public.manage_studio_cash_service('receive','project',pid,owner_id);
 perform public.manage_studio_cash_service('deliver','project',pid,owner_id,p_url=>'https://example.invalid/private-fixture');
 if (select status from public.service_projects where id=pid)<>'delivered' then raise exception 'Paid cash project not delivered'; end if;
 if has_function_privilege('anon','public.manage_studio_cash_service(text,text,uuid,uuid,integer,text,integer,date,text)','EXECUTE') or has_function_privilege('authenticated','public.manage_studio_cash_service(text,text,uuid,uuid,integer,text,integer,date,text)','EXECUTE') or has_table_privilege('authenticated','public.studio_cash_agreements','SELECT') then raise exception 'Private cash records exposed'; end if;
end $$;
rollback;
select 'PASS: cash agreement is not revenue; confirmed calendar/reminders, one receipt, cash refund, paid-only delivery and private permissions verified. All fixtures rolled back.' as verification;
