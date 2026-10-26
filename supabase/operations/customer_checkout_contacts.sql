create table public.customer_checkout_contacts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 2 and 120),
 artist_name text not null default '' check(char_length(artist_name)<=120),
 phone text not null default '' check(char_length(phone)<=40),
 updated_at timestamptz not null default now()
);
alter table public.customer_checkout_contacts enable row level security;
revoke all on public.customer_checkout_contacts from public,anon,authenticated;
grant select,insert,update,delete on public.customer_checkout_contacts to authenticated;
create policy "contact owner reads" on public.customer_checkout_contacts for select to authenticated using((select auth.uid())=user_id);
create policy "contact owner creates" on public.customer_checkout_contacts for insert to authenticated with check((select auth.uid())=user_id);
create policy "contact owner edits" on public.customer_checkout_contacts for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "contact owner removes" on public.customer_checkout_contacts for delete to authenticated using((select auth.uid())=user_id);
