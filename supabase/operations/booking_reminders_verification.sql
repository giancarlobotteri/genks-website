-- No network calls. All appointments, notifications and reminder changes roll back.
begin;
do $$
declare booking uuid; service uuid; start_time timestamptz; ids uuid[]; second_ids uuid[]; total integer;
begin
  select id into service from public.booking_services where code='recording' and active limit 1;
  start_time:=((current_date+14)+time '19:30') at time zone 'Europe/Rome';
  insert into public.bookings(reference,service_id,name,email,phone,starts_at,ends_at,status)
    values('BKG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),service,'Fixture promemoria','reminder-test@example.invalid','00000000',start_time,start_time+interval '1 hour','confirmed') returning id into booking;
  select count(*) into total from genks_private.booking_reminders where booking_id=booking and status='waiting';
  if total<>2 then raise exception 'Expected both 24h and 2h reminders'; end if;
  if not exists(select 1 from genks_private.booking_reminders where booking_id=booking and hours_before=24 and due_at=start_time-interval '24 hours') then raise exception 'Wrong 24h schedule'; end if;
  if not exists(select 1 from genks_private.booking_reminders where booking_id=booking and hours_before=2 and due_at=start_time-interval '2 hours') then raise exception 'Wrong 2h schedule'; end if;
  update public.bookings set starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day' where id=booking;
  if (select count(*) from genks_private.booking_reminders where booking_id=booking and status='cancelled')<>2 then raise exception 'Old schedule not cancelled'; end if;
  if (select count(*) from genks_private.booking_reminders where booking_id=booking and status='waiting')<>2 then raise exception 'New schedule missing'; end if;
  update public.site_settings set value='{"enabled":true}' where key='booking_reminders';
  update genks_private.booking_reminders set due_at=now()-interval '1 minute' where booking_id=booking and status='waiting';
  select array_agg(id) into ids from public.claim_booking_reminders(10);
  if array_length(ids,1)<>2 then raise exception 'Due claims missing'; end if;
  if (select count(*) from public.claim_booking_reminders(10))<>0 then raise exception 'Duplicate in-flight claim'; end if;
  perform public.finish_booking_reminder(ids[1],'failed',null);
  if (select count(*) from public.claim_booking_reminders(10))<>0 then raise exception 'Retry backoff ignored'; end if;
  update genks_private.booking_reminders set next_attempt_at=now() where id=ids[1];
  select array_agg(id) into second_ids from public.claim_booking_reminders(10);
  if second_ids[1]<>ids[1] then raise exception 'Retry must reuse the same idempotency identity'; end if;
  perform public.finish_booking_reminder(ids[1],'sent','test-no-email-sent');
  update public.bookings set status='cancelled' where id=booking;
  if exists(select 1 from genks_private.booking_reminders where booking_id=booking and sent_at is null and status in('waiting','processing')) then raise exception 'Cancelled booking retained reminders'; end if;
  if (select count(*) from public.claim_booking_reminders(10))<>0 then raise exception 'Cancelled booking claimed'; end if;
  insert into genks_private.reminder_dispatch_tickets values(encode(extensions.digest(repeat('c',64),'sha256'),'hex'),now()+interval '1 minute');
  if not public.consume_reminder_dispatch(repeat('c',64)) then raise exception 'Valid dispatch refused'; end if;
  if public.consume_reminder_dispatch(repeat('c',64)) then raise exception 'Dispatch replay accepted'; end if;
  if has_function_privilege('anon','public.claim_booking_reminders(integer)','EXECUTE') or has_function_privilege('authenticated','public.consume_reminder_dispatch(text)','EXECUTE') then raise exception 'Private worker exposed'; end if;
end $$;
rollback;
select 'PASS: 24h/2h timing, reschedule, cancellation, retry identity, locking and one-use worker authorization. No emails sent; fixtures rolled back.' as verification;
