do $test$
declare method text; location text; service text; n integer; songs jsonb; data jsonb; result jsonb; pid uuid; expected integer; actual integer; failed boolean;
begin
 foreach method in array array['card','cash'] loop
  foreach location in array array['studio','remote'] loop
   if method='cash' and location='remote' then continue; end if;
   foreach service in array array['mix','master','mix_master'] loop
    foreach n in array array[1,2,20] loop
     begin
      select jsonb_agg(jsonb_build_object('trackTitle','TEST batch rollback '||i,'trackCount',case when service='master' then 1 when mod(i,2)=0 then 9 else 1 end,'description','Descrizione di prova senza invii o pagamenti reali.','notes','Note del brano '||i,'referenceLinks','https://example.invalid/'||i,'desiredDeadline','','amountCents',1) order by i) into songs from generate_series(1,n) i;
      data:=jsonb_build_object('songs',songs,'rateVersion','2026-10-21-v3','accepted','on','mode',location,'service',service,'name','GENKS batch rollback','email','batch-rollback@example.invalid','earlyStart',false,'withdrawalAcknowledged',false);
      result:=public.reserve_project_batch(data,method,'prod.genks@gmail.com');pid:=(result->>'project_id')::uuid;
      select sum(public.project_price_v3(service,(x->>'trackCount')::integer))::integer into expected from jsonb_array_elements(songs) x;
      assert (result->>'amount_cents')::integer=expected,'wrong aggregate price';
      assert (select jsonb_array_length(p.songs)=n and p.price_cents=expected from public.service_projects p where id=pid),'wrong persisted songs';
      assert (select amount_cents=expected and terms_version='2026-10-22-v5' and terms_body like '%ciascun brano%' from public.project_contracts where project_id=pid),'wrong contract snapshot';
      assert (select body like '%BRANI E IMPORTI DELLA RICHIESTA%' from public.notification_outbox where dedupe_key='contract-'||pid),'wrong email snapshot';
      if method='card' then
       assert (select status::text='awaiting_payment' from public.service_projects where id=pid),'premature confirmation';
       assert (select amount_cents=expected from public.service_quotes where id=(result->>'id')::uuid),'wrong Stripe quote';
       assert not exists(select 1 from public.studio_cash_agreements where project_id=pid),'cash agreement for card';
       update public.service_quotes set stripe_session_id='cs_batch_rollback_'||pid,status='open' where id=(result->>'id')::uuid;
       perform public.fulfil_stripe_checkout(p_session=>'cs_batch_rollback_'||pid,p_payment=>'pi_batch_rollback_'||pid,p_amount=>expected,p_currency=>'eur',p_live=>false,p_event=>'evt_batch_rollback_'||pid,p_paid_at=>now(),p_order=>null,p_quote=>(result->>'id')::uuid);
       assert (select status::text='paid' from public.service_projects where id=pid),'payment did not confirm all songs';
       assert (select amount_cents=expected from public.payments where project_id=pid),'wrong recorded payment total';
      else
       assert (select amount_cents=expected and base_amount_cents=expected and received_at is null from public.studio_cash_agreements where project_id=pid),'wrong cash agreement';
      end if;
      raise exception using errcode='P9999',message='rollback_success';
     exception when sqlstate 'P9999' then null;
     end;
    end loop;
   end loop;
  end loop;
 end loop;
end $test$;
select jsonb_build_object('test_rows_remaining',(select count(*) from public.service_projects where email='batch-rollback@example.invalid'),'rls',(select relrowsecurity from pg_class where oid='public.service_projects'::regclass),'anon_execute',has_function_privilege('anon','public.reserve_project_batch(jsonb,text,text)','execute'),'customer_execute',has_function_privilege('authenticated','public.reserve_project_batch(jsonb,text,text)','execute'),'server_execute',has_function_privilege('service_role','public.reserve_project_batch(jsonb,text,text)','execute')) result;
