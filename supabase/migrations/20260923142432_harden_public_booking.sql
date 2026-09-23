create policy "public submits valid booking requests"
on public.bookings
for insert
to anon, authenticated
with check (
  status = 'pending'
  and customer_id is not distinct from auth.uid()
  and service_id = (
    select id from public.booking_services
    where code = 'recording' and active
    limit 1
  )
  and starts_at > now()
  and ends_at > starts_at
  and ends_at - starts_at <= interval '8 hours'
  and char_length(trim(name)) between 2 and 120
  and char_length(trim(email)) between 3 and 320
  and position('@' in email) >= 2
  and char_length(trim(phone)) between 6 and 40
  and reference ~ '^BKG-[A-F0-9]{8}$'
  and char_length(coalesce(notes, '')) <= 2000
  and char_length(coalesce(reference_url, '')) <= 2048
);

grant insert (
  reference, customer_id, service_id, name, artist_name, email, phone,
  starts_at, ends_at, notes, reference_url
) on public.bookings to anon, authenticated;

create or replace function public.submit_booking(
  p_name text,
  p_artist_name text,
  p_email text,
  p_phone text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null,
  p_reference_url text default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reference text := 'BKG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_service_id uuid;
begin
  if char_length(trim(p_name)) not between 2 and 120
     or char_length(trim(p_email)) not between 3 and 320
     or position('@' in p_email) < 2
     or char_length(trim(p_phone)) not between 6 and 40
     or p_starts_at <= now()
     or p_ends_at <= p_starts_at
     or p_ends_at - p_starts_at > interval '8 hours'
     or char_length(coalesce(p_notes, '')) > 2000
     or char_length(coalesce(p_reference_url, '')) > 2048 then
    raise exception 'invalid_booking' using errcode = '22023';
  end if;

  select id into v_service_id
  from public.booking_services
  where code = 'recording' and active
  limit 1;

  if v_service_id is null then
    raise exception 'booking_service_unavailable' using errcode = '23P02';
  end if;

  insert into public.bookings (
    reference, customer_id, service_id, name, artist_name, email, phone,
    starts_at, ends_at, notes, reference_url
  ) values (
    v_reference, auth.uid(), v_service_id, trim(p_name), nullif(trim(p_artist_name), ''),
    lower(trim(p_email)), trim(p_phone), p_starts_at, p_ends_at,
    nullif(trim(p_notes), ''), nullif(trim(p_reference_url), '')
  );

  return v_reference;
end;
$$;

revoke all on function public.submit_booking(text,text,text,text,timestamptz,timestamptz,text,text) from public;
grant execute on function public.submit_booking(text,text,text,text,timestamptz,timestamptz,text,text) to anon, authenticated;
