-- Integration checks run inside a rolled-back transaction: no emails or payments
-- are sent and no fixture data survives.
begin;
do $$
declare b uuid; b2 uuid; p uuid; q public.service_quotes; pay uuid; n uuid; c integer; d date; o uuid; item uuid; beat public.beats; license public.license_types;
begin
  d:=current_date+14;
  d:=d+((8-extract(dow from d)::integer)%7);
  insert into public.bookings(name,email,phone,starts_at,ends_at) values('Collaudo tecnico','test@genks.invalid','000000',((d+'19:30'::time) at time zone 'Europe/Rome'),((d+'20:30'::time) at time zone 'Europe/Rome')) returning id into b;
  begin
    insert into public.bookings(name,email,phone,starts_at,ends_at) values('Collaudo buffer','buffer@genks.invalid','000000',((d+'20:30'::time) at time zone 'Europe/Rome'),((d+'21:30'::time) at time zone 'Europe/Rome'));
    raise exception 'TEST_FAILED: buffer allowed';
  exception when exclusion_violation then null; end;
  insert into public.bookings(name,email,phone,starts_at,ends_at) values('Collaudo mezzanotte','night@genks.invalid','000000',((d+'23:30'::time) at time zone 'Europe/Rome'),(((d+1)+'00:30'::time) at time zone 'Europe/Rome')) returning id into b2;
  select * into q from public.prepare_service_quote('booking',b,100,'Sessione di prova completa',0,null);
  update public.service_quotes set stripe_session_id='cs_genks_sql_test_booking',status='open' where id=q.id;
  begin
    perform public.fulfil_stripe_checkout('cs_genks_sql_test_booking','pi_genks_sql_test_booking',999,'eur',false,'evt_genks_sql_wrong',now(),null,q.id);
    raise exception 'TEST_FAILED: amount mismatch accepted';
  exception when raise_exception then if sqlerrm not like '%payment_mismatch%' then raise; end if; end;
  pay:=public.fulfil_stripe_checkout('cs_genks_sql_test_booking','pi_genks_sql_test_booking',100,'eur',false,'evt_genks_sql_booking',now(),null,q.id);
  if (select status from public.bookings where id=b)<>'confirmed' then raise exception 'TEST_FAILED: booking not confirmed'; end if;
  update public.bookings set status='completed' where id=b;
  perform public.fulfil_stripe_checkout('cs_genks_sql_test_booking','pi_genks_sql_test_booking',100,'eur',false,'evt_genks_sql_booking_duplicate',now(),null,q.id);
  if (select status from public.bookings where id=b)<>'completed' then raise exception 'TEST_FAILED: duplicate rewound booking'; end if;
  perform public.record_stripe_refund('pi_genks_sql_test_booking','re_genks_sql_partial',25,now());
  perform public.record_stripe_refund('pi_genks_sql_test_booking','re_genks_sql_partial',25,now());
  if (select refunded_cents from public.payments where id=pay)<>25 then raise exception 'TEST_FAILED: duplicate refund counted twice'; end if;
  perform public.record_stripe_refund('pi_genks_sql_test_booking','re_genks_sql_remaining',75,now());
  perform public.fulfil_stripe_checkout('cs_genks_sql_test_booking','pi_genks_sql_test_booking',100,'eur',false,'evt_genks_sql_booking_after_refund',now(),null,q.id);
  if (select status from public.bookings where id=b)<>'completed' then raise exception 'TEST_FAILED: historical completed booking changed after refund'; end if;

  insert into public.service_projects(name,email,track_title,service,description) values('Collaudo progetto','project@genks.invalid','Prova tecnica','mix','Descrizione di prova') returning id into p;
  select * into q from public.prepare_service_quote('project',p,500,'Mix con consegna WAV concordata',2,d);
  update public.service_quotes set stripe_session_id='cs_genks_sql_test_project',status='open' where id=q.id;
  perform public.fulfil_stripe_checkout('cs_genks_sql_test_project','pi_genks_sql_test_project',500,'eur',false,'evt_genks_sql_project',now(),null,q.id);
  update public.service_projects set status='in_progress' where id=p;
  perform public.fulfil_stripe_checkout('cs_genks_sql_test_project','pi_genks_sql_test_project',500,'eur',false,'evt_genks_sql_project_dup',now(),null,q.id);
  if (select status from public.service_projects where id=p)<>'in_progress' then raise exception 'TEST_FAILED: project rewound'; end if;
  update public.service_projects set status='review' where id=p;
  perform public.deliver_service_project(p,'https://example.invalid/private-delivery');
  if (select status from public.service_projects where id=p)<>'delivered' then raise exception 'TEST_FAILED: project not delivered'; end if;

  insert into public.service_projects(name,email,track_title,service,description) values('Collaudo tardivo','late@genks.invalid','Prova tardiva','master','Descrizione di prova') returning id into p;
  select * into q from public.prepare_service_quote('project',p,500,'Master concordato in WAV',1,d);
  update public.service_quotes set stripe_session_id='cs_genks_sql_test_late',status='expired' where id=q.id;
  update public.service_projects set status='cancelled' where id=p;
  pay:=public.fulfil_stripe_checkout('cs_genks_sql_test_late','pi_genks_sql_test_late',500,'eur',false,'evt_genks_sql_late',now(),null,q.id);
  if (select status from public.service_projects where id=p)<>'cancelled' or (select review_reason from public.payments where id=pay) is null then raise exception 'TEST_FAILED: late payment not flagged'; end if;

  select * into beat from public.beats limit 1;
  select * into license from public.license_types where code='mp3';
  insert into public.orders(customer_email,subtotal_cents,total_cents,stripe_checkout_session_id) values('buyer@genks.invalid',100,100,'cs_genks_sql_test_order') returning id into o;
  insert into public.order_items(order_id,beat_id,license_type_id,beat_title_snapshot,beat_slug_snapshot,license_name_snapshot,license_terms_snapshot,unit_price_cents)
    values(o,beat.id,license.id,beat.title,beat.slug,license.name,'{"contractText":"Test","includedAssets":["mp3"]}',100) returning id into item;
  perform public.fulfil_stripe_checkout('cs_genks_sql_test_order','pi_genks_sql_test_order',100,'eur',false,'evt_genks_sql_order',now(),o,null);
  if not exists(select 1 from public.entitlements where order_item_id=item) then raise exception 'TEST_FAILED: delivery not granted'; end if;
  perform public.record_stripe_dispute('pi_genks_sql_test_order',true);
  if not exists(select 1 from public.entitlements where order_item_id=item and revoked_at is not null) then raise exception 'TEST_FAILED: disputed download not blocked'; end if;
  perform public.record_stripe_dispute('pi_genks_sql_test_order',false);
  if not exists(select 1 from public.entitlements where order_item_id=item and revoked_at is null) then raise exception 'TEST_FAILED: won dispute did not restore download'; end if;
  update public.entitlements set revoked_at=now(),revocation_reason=null where order_item_id=item;
  perform public.record_stripe_dispute('pi_genks_sql_test_order',false);
  if exists(select 1 from public.entitlements where order_item_id=item and revoked_at is null) then raise exception 'TEST_FAILED: manual revocation overwritten'; end if;
  perform public.record_stripe_refund('pi_genks_sql_test_order','re_genks_sql_order',100,now());
  perform public.fulfil_stripe_checkout('cs_genks_sql_test_order','pi_genks_sql_test_order',100,'eur',false,'evt_genks_sql_order_dup',now(),o,null);
  if exists(select 1 from public.entitlements where order_item_id=item and revoked_at is null) then raise exception 'TEST_FAILED: refunded download reactivated'; end if;

  select id into n from public.notification_outbox where dedupe_key='request-'||(select reference from public.bookings where id=b)||'-customer';
  select count(*) into c from public.claim_notification(n);
  if c<>1 then raise exception 'TEST_FAILED: notification not claimed'; end if;
  select count(*) into c from public.claim_notification(n);
  if c<>0 then raise exception 'TEST_FAILED: concurrent email claim allowed'; end if;
  raise notice 'GENKS integration assertions passed: overnight bookings, buffers, payment matching, idempotency, refunds, late quotes, delivery, notification locks.';
end $$;
rollback;
select 'GENKS database integration checks passed; all fixtures rolled back' as result;
