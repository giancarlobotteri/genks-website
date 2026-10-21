begin;
do $$
declare payload jsonb; quote jsonb; pid uuid; payment uuid; repeat_payment uuid; mode text;
begin
 if has_function_privilege('anon','public.reserve_remote_project(jsonb,text)','execute') or has_function_privilege('authenticated','public.reserve_remote_project(jsonb,text)','execute') then raise exception 'Public remote RPC'; end if;
 payload:=jsonb_build_object('rateVersion','2026-10-20-v2','accepted','on','name','GENKS TEST remote card','email','remote-card-test@example.invalid','service','mix','mode','remote','trackTitle','TEST non inviare','description','Test transazionale senza email o pagamenti reali','trackCount',150,'links','[]'::jsonb,'price_cents',1);
 quote:=public.reserve_remote_project(payload,'owner-test@example.invalid');
 pid:=(quote->>'project_id')::uuid;
 if (quote->>'amount_cents')::integer<>10000 or (quote->>'revision_count') is not null or (quote->>'agreed_deadline') is not null then raise exception 'Wrong fixed price scope'; end if;
 if not exists(select 1 from public.service_projects where id=pid and status='awaiting_payment' and price_cents=10000) then raise exception 'Unpaid project confirmed'; end if;
 if exists(select 1 from public.studio_cash_agreements where project_id=pid) then raise exception 'Online project created cash agreement'; end if;
 if exists(select 1 from public.notification_outbox where dedupe_key='request-'||(select reference from public.service_projects where id=pid)||'-customer' and cancelled_at is null) then raise exception 'Premature receipt'; end if;
 update public.service_quotes set stripe_session_id='cs_fixture_remote',status='open' where id=(quote->>'id')::uuid;
 payment:=public.fulfil_stripe_checkout('cs_fixture_remote','pi_fixture_remote',10000,'eur',false,'evt_fixture_remote',now(),null,(quote->>'id')::uuid);
 repeat_payment:=public.fulfil_stripe_checkout('cs_fixture_remote','pi_fixture_remote',10000,'eur',false,'evt_fixture_remote',now(),null,(quote->>'id')::uuid);
 if payment is distinct from repeat_payment or not exists(select 1 from public.service_projects where id=pid and status='paid') then raise exception 'Settlement not idempotent'; end if;
 foreach mode in array array['studio','recording',''] loop
  begin
   perform public.reserve_remote_project(jsonb_set(payload,'{mode}',to_jsonb(mode)),'owner-test@example.invalid');
   raise exception 'Non-remote project accepted';
  exception when others then if sqlerrm<>'remote_only' then raise; end if; end;
 end loop;
end $$;
rollback;
