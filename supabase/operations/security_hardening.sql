-- Administrative access requires both the owner identity and a verified second factor.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select auth.jwt()->>'aal')='aal2',false) and exists(
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'
      and lower(coalesce((select auth.jwt()->>'email'),''))='prod.genks@gmail.com'
  );
$$;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated,service_role;

-- Public availability never needs the owner's private reason for an absence.
drop policy if exists "public reads blackouts" on public.blackout_dates;
revoke select on public.blackout_dates from public,anon,authenticated;
revoke select(reason) on public.blackout_dates from public,anon,authenticated;
grant select on public.blackout_dates to service_role;
-- Requests go through server validation, Google availability and shared abuse limits.
drop policy if exists "public submits valid booking requests" on public.bookings;
revoke insert on public.bookings from public,anon,authenticated;
revoke execute on function public.submit_booking(text,text,text,text,timestamptz,timestamptz,text,text) from public,anon,authenticated;

-- Qualify the OUTER storage row explicitly: project names must never authorize a file.
drop policy if exists "customers read released project objects" on storage.objects;
create policy "customers read released project objects" on storage.objects for select to authenticated using (
  storage.objects.bucket_id='project-files' and exists(
    select 1 from public.project_files pf join public.service_projects project on project.id=pf.project_id
    where pf.storage_path=storage.objects.name and pf.bucket=storage.objects.bucket_id
      and project.customer_id=(select auth.uid())
      and (pf.kind<>'delivery' or project.status='delivered')
  )
);
drop policy if exists "customers upload project sources" on storage.objects;
create policy "customers upload project sources" on storage.objects for insert to authenticated with check (
  storage.objects.bucket_id='project-files' and exists(
    select 1 from public.service_projects project
    where project.id::text=split_part(storage.objects.name,'/',1)
      and project.customer_id=(select auth.uid()) and project.status<>'cancelled'
  )
);

create schema if not exists genks_private;
revoke all on schema genks_private from public,anon,authenticated;
grant usage on schema genks_private to service_role;
create table if not exists genks_private.request_budgets(
  fingerprint text not null,window_start timestamptz not null,expires_at timestamptz not null,
  attempts integer not null default 1,primary key(fingerprint,window_start)
);
alter table genks_private.request_budgets enable row level security;
revoke all on genks_private.request_budgets from public,anon,authenticated;
grant select,insert,update,delete on genks_private.request_budgets to service_role;
create or replace function public.consume_request_budget(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare started timestamptz; v_attempts integer;
begin
  if p_key !~ '^[a-f0-9]{64}$' or p_limit not between 1 and 10000 or p_seconds not between 1 and 86400 then return false; end if;
  started:=to_timestamp(floor(extract(epoch from now())/p_seconds)*p_seconds);
  delete from genks_private.request_budgets where expires_at<=now();
  insert into genks_private.request_budgets as budget(fingerprint,window_start,expires_at)
  values(p_key,started,started+make_interval(secs=>p_seconds))
  on conflict(fingerprint,window_start) do update set attempts=least(budget.attempts+1,p_limit+1)
  returning budget.attempts into v_attempts;
  return v_attempts<=p_limit;
end;
$$;
revoke all on function public.consume_request_budget(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_request_budget(text,integer,integer) to service_role;
