-- Transaction-only fixtures. Never flush notifications while this transaction is open.
-- All users, queued notifications and request counters are rolled back.
begin;
do $$ declare owner_id uuid; begin
  select id into owner_id from public.profiles where role='admin' limit 1;
  if owner_id is null then raise exception 'Missing owner'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'email','prod.genks@gmail.com','aal','aal1')::text,true);
  if public.is_admin() then raise exception 'Single factor grants admin'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'email','prod.genks@gmail.com','aal','aal2')::text,true);
  if not public.is_admin() then raise exception 'Verified owner denied'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'email','other@example.invalid','aal','aal2')::text,true);
  if public.is_admin() then raise exception 'Wrong identity grants admin'; end if;
end $$;
set local role service_role;
do $$ begin
  if public.consume_request_budget(repeat('a',64),2,600) is distinct from true then raise exception 'First request denied'; end if;
  if public.consume_request_budget(repeat('a',64),2,600) is distinct from true then raise exception 'Second request denied'; end if;
  if public.consume_request_budget(repeat('a',64),2,600) is distinct from false then raise exception 'Budget exceeded'; end if;
  if public.consume_request_budget(repeat('b',64),2,600) is distinct from true then raise exception 'Independent visitor denied'; end if;
end $$;
reset role;
do $$ declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); pa uuid:=gen_random_uuid(); pb uuid:=gen_random_uuid(); begin
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(a,a::text||'@security-test.invalid',now(),'{}'),(b,b::text||'@security-test.invalid',now(),'{}');
  insert into public.service_projects(id,customer_id,name,email,track_title,service,description) values(pa,a,'Security fixture A',a::text||'@security-test.invalid','Fixture','mix','Rolled back security test'),(pb,b,'Security fixture B',b::text||'@security-test.invalid','Fixture','mix','Rolled back security test');
  insert into public.project_files(project_id,kind,storage_path,filename,uploaded_by) values(pa,'source',pa::text||'/source.wav','source.wav',a),(pb,'source',pb::text||'/source.wav','source.wav',b);
  perform set_config('genks.test_pa',pa::text,true); perform set_config('genks.test_pb',pb::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',a,'email',a::text||'@security-test.invalid','aal','aal1')::text,true);
end $$;
set local role authenticated;
do $$ declare allowed boolean; predicate text; pa text:=current_setting('genks.test_pa'); pb text:=current_setting('genks.test_pb'); begin
  if (select count(*) from public.service_projects where id in(pa::uuid,pb::uuid))<>1 then raise exception 'Project row isolation failed'; end if;
  if (select count(*) from public.project_files where project_id in(pa::uuid,pb::uuid))<>1 then raise exception 'File row isolation failed'; end if;
  select qual into predicate from pg_policies where schemaname='storage' and policyname='customers read released project objects';
  execute format('select coalesce((%s),false) from (values($1::text,$2::text)) objects(bucket_id,name)',predicate) into allowed using 'project-files',pa||'/source.wav';
  if not allowed then raise exception 'Own source denied'; end if;
  execute format('select coalesce((%s),false) from (values($1::text,$2::text)) objects(bucket_id,name)',predicate) into allowed using 'project-files',pb||'/source.wav';
  if allowed then raise exception 'Other customer source exposed'; end if;
  execute format('select coalesce((%s),false) from (values($1::text,$2::text)) objects(bucket_id,name)',predicate) into allowed using 'project-files',pa||'/unregistered.wav';
  if allowed then raise exception 'Unregistered file exposed'; end if;
  select with_check into predicate from pg_policies where schemaname='storage' and policyname='customers upload project sources';
  execute format('select coalesce((%s),false) from (values($1::text,$2::text)) objects(bucket_id,name)',predicate) into allowed using 'project-files',pa||'/new.wav';
  if not allowed then raise exception 'Own upload denied'; end if;
  execute format('select coalesce((%s),false) from (values($1::text,$2::text)) objects(bucket_id,name)',predicate) into allowed using 'project-files',pb||'/new.wav';
  if allowed then raise exception 'Upload into other customer project allowed'; end if;
end $$;
rollback;
select 'PASS: admin MFA, atomic request limits, two-customer RLS and storage isolation. All fixtures rolled back.' as verification;
