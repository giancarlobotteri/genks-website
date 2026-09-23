-- Make the initial catalog purchasable and expose a narrowly scoped booking RPC.
update public.license_types
set is_exclusive = (code = 'exclusive'),
    active = true,
    updated_at = now()
where code in ('mp3', 'wav', 'stems', 'exclusive');

insert into public.beats (
  id, slug, title, bpm, musical_key, genre, mood, description,
  featured, status, sort_order, published_at
) values
  ('10000000-0000-4000-8000-000000000001','blue-hour','BLUE HOUR',140,'F min','Trap','Dark','Weightless keys. Heavy low end. A late-night pocket.',true,'published',10,now()),
  ('10000000-0000-4000-8000-000000000002','chrome-hearts','CHROME HEARTS',142,'C♯ min','Trap','Hard','Cold textures and a bassline built to cut through.',true,'published',20,now()),
  ('10000000-0000-4000-8000-000000000003','afterimage','AFTERIMAGE',96,'G min','R&B','Floating','Soft chords, blurred edges and room for a melody.',true,'published',30,now()),
  ('10000000-0000-4000-8000-000000000004','no-signal','NO SIGNAL',150,'C min','Drill','Hard','Sparse melody. Restless percussion. All forward motion.',false,'published',40,now()),
  ('10000000-0000-4000-8000-000000000005','low-tide','LOW TIDE',112,'D min','Afro','Melodic','An open groove with a darker melodic undercurrent.',false,'published',50,now()),
  ('10000000-0000-4000-8000-000000000006','night-drive','NIGHT DRIVE',132,'A min','Trap','Melodic','A slow-burning melody over rolling drums.',false,'published',60,now())
on conflict (id) do update set
  title = excluded.title,
  bpm = excluded.bpm,
  musical_key = excluded.musical_key,
  genre = excluded.genre,
  mood = excluded.mood,
  description = excluded.description,
  featured = excluded.featured,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.beat_license_prices (beat_id, license_type_id, active)
select b.id, l.id, true
from public.beats b
cross join public.license_types l
where b.id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006'
)
and l.code in ('mp3', 'wav', 'stems', 'exclusive')
on conflict (beat_id, license_type_id) do update set active = true;

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
security definer
set search_path = ''
as $$
declare
  v_reference text;
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
    customer_id, service_id, name, artist_name, email, phone,
    starts_at, ends_at, notes, reference_url
  ) values (
    auth.uid(), v_service_id, trim(p_name), nullif(trim(p_artist_name), ''),
    lower(trim(p_email)), trim(p_phone), p_starts_at, p_ends_at,
    nullif(trim(p_notes), ''), nullif(trim(p_reference_url), '')
  )
  returning reference into v_reference;

  return v_reference;
end;
$$;

revoke all on function public.submit_booking(text,text,text,text,timestamptz,timestamptz,text,text) from public;
grant execute on function public.submit_booking(text,text,text,text,timestamptz,timestamptz,text,text) to anon, authenticated;
