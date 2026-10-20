begin;
do $$
declare payload jsonb; ref text; bid uuid; pid uuid; expected integer; service text;
begin
 if has_function_privilege('anon','public.reserve_cash_service(text,jsonb,text)','execute') or has_function_privilege('authenticated','public.reserve_cash_service(text,jsonb,text)','execute') then raise exception 'Public reservation RPC'; end if;
 if has_table_privilege('authenticated','public.studio_cash_agreements','select') then raise exception 'Public cash table'; end if;
 payload:=jsonb_build_object('rateVersion','2026-10-20-v2','accepted','on','name','GENKS TEST automatico','email','automatic-test@example.invalid','phone','0000000000','duration',2,'startsAt','2026-11-14T10:00:00+01:00');
 ref:=public.reserve_cash_service('booking',payload,'owner-test@example.invalid');
 select id into bid from public.bookings where reference=ref and status='confirmed' and price_cents=4000 and hold_expires_at is null;
 if bid is null then raise exception 'Booking was not automatically confirmed'; end if;
 if not exists(select 1 from public.studio_cash_agreements where booking_id=bid and amount_cents=4000 and received_at is null and agreed_by is null and customer_accepted_at is not null) then raise exception 'Incorrect cash snapshot'; end if;
 if (select count(*) from genks_private.booking_reminders where booking_id=bid and status='waiting')<>2 then raise exception 'Missing reminders'; end if;
 if (select count(*) from public.notification_outbox where dedupe_key='reservation-'||ref||'-admin')<>1 then raise exception 'Missing owner alert'; end if;
 if exists(select 1 from public.notification_outbox where dedupe_key='request-'||ref||'-customer' and cancelled_at is null) then raise exception 'Obsolete request receipt'; end if;
 begin
  perform public.reserve_cash_service('booking',payload,'owner-test@example.invalid');
  raise exception 'Overlap accepted';
 exception when exclusion_violation then null;
 when others then if sqlerrm not like '%booking_conflict%' then raise; end if;
 end;
 begin
  perform public.reserve_cash_service('booking',jsonb_set(payload,'{rateVersion}','"old"'),'owner-test@example.invalid');
  raise exception 'Stale price accepted';
 exception when others then if sqlerrm<>'price_changed' then raise; end if; end;
 begin
  perform public.reserve_cash_service('booking',payload-'accepted','owner-test@example.invalid');
  raise exception 'Consent missing accepted';
 exception when others then if sqlerrm<>'price_changed' then raise; end if; end;
 foreach service in array array['mix','master','mix_master'] loop
  expected:=case service when 'mix' then 10000 when 'master' then 4000 else 12000 end;
  payload:=jsonb_build_object('rateVersion','2026-10-20-v2','accepted','on','name','GENKS TEST automatico','email',service||'-test@example.invalid','service',service,'mode','remote','trackTitle','TEST · non inviare','description','Verifica interna senza invio email','trackCount',2,'links','[]'::jsonb,'price_cents',1);
  ref:=public.reserve_cash_service('project',payload,'owner-test@example.invalid');
  select id into pid from public.service_projects where reference=ref and status='in_progress' and price_cents=expected and agreed_deadline is null;
  if pid is null then raise exception 'Project wrong price/status'; end if;
  if not exists(select 1 from public.studio_cash_agreements where project_id=pid and amount_cents=expected and received_at is null and fulfillment_mode='remote' and revision_count is null) then raise exception 'Project snapshot incorrect'; end if;
 end loop;
end $$;
rollback;
