-- Keep administrative annotations server-only. Existing row policies stay in place.
revoke select on table public.profiles from public, anon, authenticated;
revoke select (internal_notes, segment) on table public.profiles from public, anon, authenticated;
grant select (id, role, display_name, phone, artist_name, marketing_consent, created_at, updated_at)
  on table public.profiles to authenticated;
do $$
begin
  if has_column_privilege('authenticated','public.profiles','internal_notes','SELECT')
    or has_column_privilege('authenticated','public.profiles','segment','SELECT')
    or has_column_privilege('anon','public.profiles','internal_notes','SELECT') then
    raise exception 'Internal profile fields remain client-readable';
  end if;
  if not has_column_privilege('authenticated','public.profiles','role','SELECT')
    or not has_table_privilege('service_role','public.profiles','SELECT') then
    raise exception 'Required authenticated or server access is missing';
  end if;
end $$;
