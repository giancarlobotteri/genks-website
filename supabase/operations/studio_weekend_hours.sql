begin;
alter table public.availability_rules add column flexible_close boolean not null default false;
create or replace function public.validate_booking_availability() returns trigger language plpgsql set search_path='' as $$
declare local_start timestamp; local_end timestamp; booking_buffer integer;
begin
  if tg_op='UPDATE' and old.status in ('pending','approved_awaiting_payment','confirmed') and new.status in ('pending','approved_awaiting_payment','confirmed') and new.starts_at=old.starts_at and new.ends_at=old.ends_at then new.blocked_until:=old.blocked_until; return new; end if;
  new.blocked_until:=new.ends_at;
  if new.status not in ('pending','approved_awaiting_payment','confirmed') then return new; end if;
  local_start:=new.starts_at at time zone 'Europe/Rome';
  local_end:=new.ends_at at time zone 'Europe/Rome';
  select max(r.buffer_minutes) into booking_buffer from public.availability_rules r
  cross join lateral (values(local_start::date),(local_start::date-1)) as d(day)
  where r.active and r.weekday=extract(dow from d.day)
    and local_start>=d.day+r.start_time
    and local_start<d.day+r.end_time+case when r.ends_next_day then interval '1 day' else interval '0' end
    and ((r.flexible_close and local_end<=local_start+interval '8 hours') or (not r.flexible_close and local_end<=d.day+r.end_time+case when r.ends_next_day then interval '1 day' else interval '0' end))
    and mod(extract(epoch from (local_start-(d.day+r.start_time)))::integer,r.slot_minutes*60)=0;
  if booking_buffer is null then raise exception 'booking_unavailable' using errcode='23P02'; end if;
  new.blocked_until:=new.ends_at+make_interval(mins=>booking_buffer);
  if exists(select 1 from public.blackout_dates b where tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')) then
    raise exception 'booking_blackout' using errcode='23P03';
  end if;
  return new;
end $$;

update public.availability_rules set start_time='10:00',end_time='00:00',ends_next_day=true,flexible_close=true,slot_minutes=30,active=true where weekday in(0,6);
insert into public.availability_rules(weekday,start_time,end_time,ends_next_day,flexible_close,slot_minutes,buffer_minutes) select 0,'10:00','00:00',true,true,30,15 where not exists(select 1 from public.availability_rules where weekday=0);
insert into public.site_settings(key,value) values('studio','{"street":"Via Quintina","locality":"Ponte San Giovanni","city":"Perugia","province":"PG","country":"IT","civic_number":null,"commercial_address_confirmed":false}') on conflict(key) do update set value=excluded.value;
commit;

