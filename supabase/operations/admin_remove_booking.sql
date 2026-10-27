-- Recoverable removal: retains payments and audit history, releases the booked time.
alter table public.bookings add column if not exists archived_at timestamptz;

create or replace function public.admin_remove_booking(p_booking uuid, p_admin uuid, p_restore boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
declare b public.bookings%rowtype;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='admin') then
  raise exception 'admin_required';
 end if;
 select * into b from public.bookings where id=p_booking for update;
 if not found then raise exception 'booking_not_found'; end if;
 if p_restore then
  -- Restore visibility only: a removed session must never reclaim an occupied slot.
  if b.archived_at is null then return; end if;
  update public.bookings set archived_at=null,updated_at=now() where id=p_booking;
 else
  if b.archived_at is not null then return; end if;
  if exists(select 1 from public.service_quotes q where q.status in('creating','open') and
    (q.booking_id=p_booking or q.project_id in
      (select project_id from public.service_order_parts_v8 where booking_id=p_booking
       union select p.project_id from public.service_order_parts_v8 p join public.service_credit_bookings_v8 c on c.part_id=p.id where c.booking_id=p_booking))) then
   raise exception 'active_payment';
  end if;
  update public.bookings set status='cancelled',archived_at=now(),hold_expires_at=null,updated_at=now() where id=p_booking;
  insert into public.booking_status_history(booking_id,from_status,to_status,changed_by,note)
   values(p_booking,b.status,'cancelled',p_admin,'Eliminata manualmente dal pannello; pagamenti conservati.');
  -- The status trigger cancels reminders. Suppress queued mail for this removed request.
  update public.notification_outbox set cancelled_at=now()
   where sent_at is null and cancelled_at is null and
    (position(b.reference in subject)>0 or position(b.reference in body)>0 or position(p_booking::text in dedupe_key)>0);
 end if;
 insert into public.admin_audit_log(admin_id,action,entity_type,entity_id,payload)
  values(p_admin,case when p_restore then 'restore_booking_visibility' else 'remove_booking' end,'booking',p_booking::text,
   jsonb_build_object('reference',b.reference,'previous_status',b.status,'payments_preserved',true));
end $$;
revoke all on function public.admin_remove_booking(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_remove_booking(uuid,uuid,boolean) to service_role;
