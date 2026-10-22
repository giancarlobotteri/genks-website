do $test$
declare fixture jsonb; result jsonb; pid uuid; method text; bad boolean:=false; booking_ref text;
begin
 begin
  perform public.set_public_discount('all','percent',10,'TEST globale',true);
  perform public.set_public_discount('master','percent',20,'TEST master',true);
  assert public.genks_discount_price(8999,array['mix','projects','services'])=8099,'global rounding';
  assert public.project_price_v3('master',1)=3199,'specific override';
  fixture:=jsonb_build_object('rateVersion','2026-10-21-v3','accepted','on','service','mix','mode','studio','name','GENKS offerte rollback','email','offers-rollback@example.invalid','earlyStart',false,'withdrawalAcknowledged',false,'expectedTotal',27497,
   'songs',jsonb_build_array(
    jsonb_build_object('service','mix','trackTitle','Primo','trackCount',8,'description','Descrizione primo brano','referenceLinks','','notes','','desiredDeadline',''),
    jsonb_build_object('service','master','trackTitle','Secondo','trackCount',1,'description','Descrizione secondo brano','referenceLinks','','notes','','desiredDeadline',''),
    jsonb_build_object('service','mix_master','trackTitle','Terzo','trackCount',24,'description','Descrizione terzo brano','referenceLinks','','notes','','desiredDeadline','')));
  foreach method in array array['cash','card'] loop
   result:=public.reserve_project_batch(fixture||jsonb_build_object('email',method||'-offers-rollback@example.invalid'),method,'prod.genks@gmail.com');
   pid:=(result->>'project_id')::uuid;
   assert (result->>'amount_cents')::integer=27497,'mixed service total';
   assert (select songs->1->>'service'='master' and (songs->1->>'amountCents')::integer=3199 from public.service_projects where id=pid),'song-specific service not preserved';
   if method='card' then
    update public.service_quotes set status='open',stripe_session_id='cs_offers_rollback_'||pid where id=(result->>'id')::uuid;
    perform public.fulfil_stripe_checkout(p_session=>'cs_offers_rollback_'||pid,p_payment=>'pi_offers_rollback_'||pid,p_amount=>27497,p_currency=>'eur',p_live=>false,p_event=>'evt_offers_rollback_'||pid,p_paid_at=>now(),p_order=>null,p_quote=>(result->>'id')::uuid);
    assert (select amount_cents=27497 from public.payments where project_id=pid),'wrong paid amount';
   else
    assert (select amount_cents=27497 from public.studio_cash_agreements where project_id=pid),'wrong cash amount';
   end if;
  end loop;
  begin perform public.reserve_project_batch(fixture||jsonb_build_object('expectedTotal',1),'card','prod.genks@gmail.com');
  exception when raise_exception then if sqlerrm='price_changed' then bad:=true; else raise; end if; end;
  assert bad,'changed total must be rejected';
  booking_ref:=public.reserve_cash_service('booking',jsonb_build_object('rateVersion','2026-10-20-v2','accepted','on','name','TEST offerte studio','email','recording-offers-rollback@example.invalid','phone','0000000000','duration',0.5,'startsAt','2026-11-25T20:00:00+01:00','expectedTotal',900),'prod.genks@gmail.com');
  assert (select price_cents=900 from public.bookings where reference=booking_ref),'wrong hourly offer';
  raise exception using errcode='P9999',message='rollback_success';
 exception when sqlstate 'P9999' then null; end;
end $test$;
select jsonb_build_object('active_offers',(select count(*) from public.site_settings s,lateral jsonb_array_elements(coalesce(s.value->'rules','[]'::jsonb)) r where s.key='public_discounts' and r->>'active'='true'),'test_projects',(select count(*) from public.service_projects where email like '%offers-rollback@example.invalid'),'anon_write',has_function_privilege('anon','public.set_public_discount(text,text,integer,text,boolean)','execute'),'customer_write',has_function_privilege('authenticated','public.set_public_discount(text,text,integer,text,boolean)','execute')) result;
