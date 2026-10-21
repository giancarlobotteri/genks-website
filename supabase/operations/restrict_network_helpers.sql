-- Attempted 21 October 2026 after owner-authorized security review.
-- Hosted functions and schema are owned by supabase_admin. The available
-- postgres role cannot revoke that owner's PUBLIC grants. Migration API success
-- alone is NOT proof of revocation: the assertion below must also pass.
-- A provider administrator must apply these statements as the actual grantor.
revoke usage on schema net from public, anon, authenticated;
revoke execute on all functions in schema net from public, anon, authenticated;
grant usage on schema net to service_role;
grant execute on all functions in schema net to service_role;
do $$ begin
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='net' and p.proname in('http_get','http_post','http_delete')
    and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute')))
  then raise exception 'Network grants remain: execution by provider owner is required'; end if;
end $$;

