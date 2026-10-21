do $test$
declare mode text; service text; result jsonb; pid uuid; expected integer;
begin
 foreach mode in array array['studio','remote'] loop
  foreach service in array array['mix','master','mix_master'] loop
   begin
    result:=public.reserve_remote_project(jsonb_build_object(
     'rateVersion','2026-10-21-v3','accepted','on','mode',mode,'payment','card',
     'service',service,'trackCount',1,'name','GENKS TEST rollback',
     'email','studio-card-rollback@example.invalid','trackTitle','TEST rollback carta studio',
     'description','Verifica transazionale senza pagamenti o invio email.',
     'earlyStart',false,'withdrawalAcknowledged',false,'links','[]'::jsonb
    ),'prod.genks@gmail.com');
    pid:=(result->>'project_id')::uuid;
    expected:=case service when 'mix' then 8999 when 'master' then 3999 else 11999 end;
    assert (result->>'amount_cents')::integer=expected, 'incorrect price';
    assert (select status::text='awaiting_payment' and notes like 'Modalità: '||mode||'%' from public.service_projects where id=pid), 'incorrect mode or paid status';
    assert (select terms_version='2026-10-21-v4' and terms_body like '%sia fisicamente in studio%' from public.project_contracts where project_id=pid), 'incorrect terms';
    assert not exists(select 1 from public.studio_cash_agreements where project_id=pid), 'cash agreement for card';
    assert not exists(select 1 from public.payments where project_id=pid), 'payment created before checkout';
    if mode='studio' then assert result->>'scope' like '%Fisicamente in studio.%', 'incorrect studio scope'; end if;
    raise exception using errcode='P9999',message='rollback_success';
   exception when sqlstate 'P9999' then null;
   end;
  end loop;
 end loop;
end $test$;
select jsonb_build_object('test_rows_remaining',(select count(*) from public.service_projects where email='studio-card-rollback@example.invalid'),'anon_can_reserve',has_function_privilege('anon','public.reserve_remote_project(jsonb,text)','execute'),'authenticated_can_reserve',has_function_privilege('authenticated','public.reserve_remote_project(jsonb,text)','execute'),'server_can_reserve',has_function_privilege('service_role','public.reserve_remote_project(jsonb,text)','execute')) result;
