-- Run ONLY in a test project with the GENKS schema and availability rules.
-- This script creates no permanent data, contacts no payment provider and sends no email.
begin;
select set_config('request.jwt.claim.role','service_role',true);

do $$
declare
 result jsonb; order_id uuid; booking_id uuid; competing_id uuid; slot timestamptz; quote_id uuid; payment_id uuid;
 fake_session text:='cs_test_qa_'||gen_random_uuid(); fake_intent text:='pi_qa_'||gen_random_uuid(); fake_event text:='evt_qa_'||gen_random_uuid();
 i public.service_order_parts_v8%rowtype; p public.service_projects%rowtype;
 actor_email text:='genks-qa-'||gen_random_uuid()||'@example.invalid';
begin
 -- Use a future, unoccupied half-hour at the start of an active working window.
 select candidate into slot
 from generate_series(current_date+2,current_date+35,interval '1 day') as d(day)
 join public.availability_rules r on r.active and r.weekday=extract(dow from d.day)
 cross join lateral (select (d.day::date+r.start_time) at time zone 'Europe/Rome' as candidate) c
 where not exists (
  select 1 from public.bookings b
  where b.status in ('pending','approved_awaiting_payment','confirmed')
    and tstzrange(b.starts_at,b.blocked_until,'[)') &&
        tstzrange(candidate,candidate+make_interval(mins=>30+r.buffer_minutes),'[)')
 ) and not exists (
  select 1 from public.blackout_dates b
  where tstzrange(b.starts_at,b.ends_at,'[)') &&
        tstzrange(candidate,candidate+interval '30 minutes','[)')
 ) and (r.flexible_close or (r.end_time-r.start_time)>=interval '30 minutes' or r.ends_next_day)
 order by candidate limit 1;
 if slot is null then raise exception 'Test setup: no free studio slot'; end if;

 result:=public.reserve_service_cart_v16(
   jsonb_build_object('accepted','on','name','GENKS QA','email',actor_email,'phone','0000000000'),
   jsonb_build_object('version','2026-10-26-commerce-v8','paymentPolicy','studio-appointment-fixed20-v1',
    'requestId',gen_random_uuid(),'total',4999,'cardNow',0,'cashNow',2000,'balance',2999,
    'parts',jsonb_build_array(
     jsonb_build_object('title','Registrazione QA','total',2000,'dueNow',2000,'balance',0,'hours',0.5,
      'studioAmount',2000,'bookingAmount',2000,'bookingDeposit',2000,
      'selection',jsonb_build_object('kind','recording','payment','cash',
       'date',to_char(slot at time zone 'Europe/Rome','YYYY-MM-DD'),'time',to_char(slot at time zone 'Europe/Rome','HH24:MI'))),
     jsonb_build_object('title','Mix QA','total',2999,'dueNow',0,'balance',2999,'hours',0,'studioAmount',0,
      'selection',jsonb_build_object('kind','mix','payment','cash')))),
   repeat('Condizioni di test isolate. ',5),'Riepilogo fittizio');
 order_id:=(result->>'project_id')::uuid;
 select * into strict i from public.service_order_parts_v8 where project_id=order_id and position=0;
 booking_id:=i.booking_id;
 if not exists(select 1 from public.bookings b where b.id=booking_id and b.deposit_cents=2000
   and abs(extract(epoch from (b.hold_expires_at-public.genks_cash_hold_until(now(),b.starts_at))))<2) then
  raise exception 'Deposit or midpoint not stored'; end if;

 -- Force the timestamp past the deadline without moving the appointment.
 update public.bookings set hold_expires_at=now()-interval '1 minute' where id=booking_id;
 update public.service_order_parts_v8 set hold_until=now()-interval '1 minute' where id=i.id;
 perform public.expire_booking_holds();
 select * into strict p from public.service_projects where id=order_id;
 if p.status<>'in_progress' or p.price_cents<>2999 or not exists(
   select 1 from public.service_order_parts_v8 x where x.project_id=order_id and x.position=1 and x.total_cents=2999 and x.initial_cents=0
 ) or not exists(
   select 1 from public.service_order_parts_v8 x join public.bookings b on b.id=x.booking_id
   where x.id=i.id and x.studio_released_at is not null and x.total_cents=0 and b.status='cancelled'
 ) or not exists(select 1 from public.notification_outbox n where n.dedupe_key like 'studio-release-'||booking_id||'-%') then
  raise exception 'Expiry failed to preserve mix or remove studio amount'; end if;

 -- An unpaid repeated release is idempotent.
 result:=public.gestionale_set_deposit(booking_id,false);
 if result->>'status' is distinct from 'cancelled' then raise exception 'Repeated release failed: %',result; end if;

 insert into public.bookings(service_id,name,email,phone,starts_at,ends_at,status,price_cents,deposit_cents)
 select service_id,'GENKS QA concorrente','genks-qa-'||gen_random_uuid()||'@example.invalid','0000000000',starts_at,ends_at,'confirmed',2000,2000
 from public.bookings where id=booking_id returning id into competing_id;
 result:=public.gestionale_set_deposit(booking_id,true);
 if result->>'error' is distinct from 'slot_taken' then raise exception 'Expected slot_taken: %',result; end if;
 update public.bookings set status='cancelled' where id=competing_id;
 result:=public.gestionale_set_deposit(booking_id,true);
 if result->>'status' is distinct from 'confirmed' then raise exception 'Confirmation failed: %',result; end if;
 perform public.gestionale_set_deposit(booking_id,true);
 if (select count(*) from public.payments pay where pay.project_id=order_id and pay.provider_payment_id='genks-cassa-acconto-'||booking_id)<>1
    or not exists(select 1 from public.service_order_parts_v8 x where x.id=i.id and x.paid_cents=2000 and x.initial_paid_at is not null and x.studio_released_at is null)
 then raise exception 'Deposit was not registered exactly once'; end if;

 result:=public.gestionale_set_deposit(booking_id,false);
 if result->>'status' is distinct from 'cancelled' or not exists(
   select 1 from public.service_projects x where x.id=order_id and x.status='in_progress'
 ) or not exists(select 1 from public.service_order_parts_v8 x where x.project_id=order_id and x.position=1 and x.total_cents=2999) then
  raise exception 'Manual release changed the rest of the order'; end if;

 -- Simulate a successful Stripe webhook locally. No request goes to Stripe.
 result:=public.reserve_service_cart_v16(
   jsonb_build_object('accepted','on','name','GENKS QA carta','email','genks-qa-'||gen_random_uuid()||'@example.invalid','phone','0000000000'),
   jsonb_build_object('version','2026-10-26-commerce-v8','paymentPolicy','studio-appointment-fixed20-v1',
    'requestId',gen_random_uuid(),'total',2000,'cardNow',2000,'cashNow',0,'balance',0,
    'parts',jsonb_build_array(jsonb_build_object('title','Registrazione QA carta','total',2000,
     'dueNow',2000,'balance',0,'hours',0.5,'studioAmount',2000,'bookingDeposit',2000,
     'selection',jsonb_build_object('kind','recording','payment','card',
      'date',to_char(slot at time zone 'Europe/Rome','YYYY-MM-DD'),'time',to_char(slot at time zone 'Europe/Rome','HH24:MI'))))),
   repeat('Condizioni di test isolate. ',5),'Riepilogo carta fittizio');
 order_id:=(result->>'project_id')::uuid;
 quote_id:=(result->>'quote_id')::uuid;
 select * into strict i from public.service_order_parts_v8 where project_id=order_id;
 if not exists(select 1 from public.service_quotes q where q.id=quote_id and q.expires_at<=i.hold_until
   and q.expires_at>now()+interval '30 minutes' and q.expires_at<now()+interval '24 hours')
 then raise exception 'Card link expiry must respect both Stripe and the studio hold'; end if;
 update public.service_quotes set status='open',stripe_session_id=fake_session where id=quote_id;
 payment_id:=public.settle_service_cart_v16(quote_id,fake_session,fake_intent,2000,'EUR',false,fake_event,now());
 if payment_id is distinct from public.settle_service_cart_v16(quote_id,fake_session,fake_intent,2000,'EUR',false,fake_event,now())
    or not exists(select 1 from public.bookings b where b.id=i.booking_id and b.status='confirmed' and b.hold_expires_at is null)
    or not exists(select 1 from public.service_order_parts_v8 x where x.id=i.id and x.paid_cents=2000)
 then raise exception 'Card deposit was not settled and confirmed idempotently'; end if;
 -- Extra: carta già pagata + "Acconto pagato" dal gestionale = nessun doppio incasso; la scadenza non libera
 result:=public.gestionale_set_deposit(i.booking_id,true);
 if result->>'status' is distinct from 'confirmed' or (select count(*) from public.payments pay where pay.project_id=order_id)<>1
 then raise exception 'Card + Cassa confirm double counted: %',result; end if;
 update public.bookings set hold_expires_at=now()-interval '1 minute' where id=i.booking_id;
 perform public.expire_booking_holds();
 if not exists(select 1 from public.bookings b where b.id=i.booking_id and b.status='confirmed') then raise exception 'Paid card session was released'; end if;

 -- Nuova regola: sessione (20 € acconto) + mix pagati con carta → mix subito per intero, ordine in attesa finché non paga
 update public.bookings set status='cancelled' where id=i.booking_id;
 result:=public.reserve_service_cart_v16(
   jsonb_build_object('accepted','on','name','GENKS QA mista','email','genks-qa-'||gen_random_uuid()||'@example.invalid','phone','0000000000'),
   jsonb_build_object('version','2026-10-26-commerce-v8','paymentPolicy','studio-appointment-fixed20-v1',
    'requestId',gen_random_uuid(),'total',8999,'cardNow',7999,'cashNow',0,'balance',1000,
    'parts',jsonb_build_array(
     jsonb_build_object('title','Registrazione QA','total',3000,'dueNow',2000,'balance',1000,'hours',0.5,'studioAmount',3000,'bookingAmount',3000,'bookingDeposit',2000,
      'selection',jsonb_build_object('kind','recording','payment','card','date',to_char(slot at time zone 'Europe/Rome','YYYY-MM-DD'),'time',to_char(slot at time zone 'Europe/Rome','HH24:MI'))),
     jsonb_build_object('title','Mix QA','total',5999,'dueNow',5999,'balance',0,'hours',0,'studioAmount',0,
      'selection',jsonb_build_object('kind','mix','payment','card')))),
   repeat('Condizioni di test isolate. ',5),'Riepilogo misto');
 order_id:=(result->>'project_id')::uuid; quote_id:=(result->>'quote_id')::uuid;
 if (select status::text from public.service_projects where id=order_id)<>'awaiting_payment' then raise exception 'Card order should wait for payment'; end if;
 if (select amount_cents from public.service_quotes where id=quote_id)<>7999 then raise exception 'Card amount must be deposit + mix'; end if;
 update public.service_quotes set status='open',stripe_session_id=fake_session||'m' where id=quote_id;
 perform public.settle_service_cart_v16(quote_id,fake_session||'m',fake_intent||'m',7999,'EUR',false,fake_event||'m',now());
 if (select status::text from public.service_projects where id=order_id)<>'in_progress'
    or exists(select 1 from public.service_order_parts_v8 x where x.project_id=order_id and x.paid_cents<>x.initial_cents)
    or not exists(select 1 from public.service_order_parts_v8 x join public.bookings b on b.id=x.booking_id where x.project_id=order_id and b.status='confirmed' and x.paid_cents=2000 and x.total_cents-x.paid_cents=1000)
 then raise exception 'Mixed card order not settled correctly'; end if;

 -- Contanti: beat/mix a fine lavoro, nessun pagamento ora → ordine attivo subito
 result:=public.reserve_service_cart_v16(
   jsonb_build_object('accepted','on','name','GENKS QA contanti','email','genks-qa-'||gen_random_uuid()||'@example.invalid','phone','0000000000'),
   jsonb_build_object('version','2026-10-26-commerce-v8','paymentPolicy','studio-appointment-fixed20-v1',
    'requestId',gen_random_uuid(),'total',3499,'cardNow',0,'cashNow',0,'balance',3499,
    'parts',jsonb_build_array(jsonb_build_object('title','Beat QA','total',3499,'dueNow',0,'balance',3499,'hours',0,'studioAmount',0,'selection',jsonb_build_object('kind','custom','payment','cash')))),
   repeat('Condizioni di test isolate. ',5),'Riepilogo contanti');
 if (select status::text from public.service_projects where id=(result->>'project_id')::uuid)<>'in_progress' then raise exception 'Cash order should be active'; end if;
 raise notice 'PASS: expiration, active mix, slot_taken, Cassa actions, and automatic card confirmation';
end $$;

rollback;
