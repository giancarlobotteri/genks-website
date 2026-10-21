begin;
do $test$
declare i integer; v integer; q jsonb; ref text; pid uuid; payload jsonb; old_count bigint;
begin
 for i in 1..48 loop
  v:=case when i<=8 then 8999 when i<=24 then 13999 else 19999 end;
  if public.project_price_v3('mix',i)<>v then raise exception 'Wrong mix tier %',i; end if;
  v:=case when i<=8 then 11999 when i<=24 then 17999 else 23999 end;
  if public.project_price_v3('mix_master',i)<>v then raise exception 'Wrong bundle tier %',i; end if;
 end loop;
 if public.project_price_v3('master',1)<>3999 then raise exception 'Wrong master'; end if;
 begin perform public.project_price_v3('mix',49); raise exception 'Over 48 accepted'; exception when others then if sqlerrm<>'quote_required' then raise; end if; end;
 begin perform public.project_price_v3('master',2); raise exception 'Stem mastering accepted'; exception when others then if sqlerrm<>'quote_required' then raise; end if; end;
 select count(*) into old_count from public.studio_cash_agreements;
 payload:=jsonb_build_object('rateVersion','2026-10-21-v3','accepted','on','name','GENKS rollback test','email','contracts-test@example.invalid','service','mix','mode','studio','trackTitle','TEST rollback','description','Only transactional test, no email delivery','trackCount',24,'earlyStart',false,'withdrawalAcknowledged',false,'links','[]'::jsonb,'price_cents',1);
 ref:=public.reserve_cash_service('project',payload,'owner-test@example.invalid');
 select id into strict pid from public.service_projects where reference=ref and price_cents=13999;
 if not exists(select 1 from public.project_contracts where project_id=pid and amount_cents=13999 and revision_count=2 and not early_start_requested) then raise exception 'Contract snapshot missing'; end if;
 if not exists(select 1 from public.studio_cash_agreements where project_id=pid and amount_cents=13999 and revision_count=2 and rate_version='2026-10-21-v3' and received_at is null) then raise exception 'Wrong cash price or premature revenue'; end if;
 payload:=payload||'{"mode":"remote","service":"mix_master","trackCount":48,"earlyStart":true,"withdrawalAcknowledged":true}'::jsonb;
 q:=public.reserve_remote_project(payload,'owner-test@example.invalid');
 if (q->>'amount_cents')::integer<>23999 or (q->>'revision_count')::integer<>2 then raise exception 'Wrong remote quote'; end if;
 if exists(select 1 from public.studio_cash_agreements where project_id=(q->>'project_id')::uuid) then raise exception 'Remote cash agreement created'; end if;
 if not exists(select 1 from public.service_projects where id=(q->>'project_id')::uuid and status='awaiting_payment') then raise exception 'Unpaid project advanced'; end if;
 begin perform public.reserve_remote_project(payload||'{"withdrawalAcknowledged":false}'::jsonb,'owner-test@example.invalid'); raise exception 'Missing consent accepted'; exception when others then if sqlerrm<>'invalid_service_consent' then raise; end if; end;
 if (select count(*) from public.studio_cash_agreements)<>old_count+1 then raise exception 'Existing agreement changed'; end if;
 if has_table_privilege('anon','public.project_contracts','select') or has_table_privilege('authenticated','public.project_contracts','select') or has_function_privilege('anon','public.snapshot_project_contract_v3(uuid,jsonb)','execute') then raise exception 'Public contract access'; end if;
end $test$;
rollback;