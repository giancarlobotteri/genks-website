-- The owner account is the only account eligible for the GENKS admin role.
-- Authentication credentials remain exclusively in Supabase Auth.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'prod.genks@gmail.com'
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, role, display_name)
  values (
    new.id,
    case when lower(new.email) = 'prod.genks@gmail.com' then 'admin'::public.app_role else 'customer'::public.app_role end,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set role = case when lower(new.email) = 'prod.genks@gmail.com' then 'admin'::public.app_role else public.profiles.role end;
  update public.orders set customer_id = new.id
    where customer_id is null and lower(customer_email) = lower(new.email);
  update public.entitlements set customer_id = new.id
    where customer_id is null and lower(customer_email) = lower(new.email);
  return new;
end;
$$;

update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id and lower(u.email) = 'prod.genks@gmail.com';

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
