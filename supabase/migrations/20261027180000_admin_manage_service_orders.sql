create or replace function public.admin_manage_service_order(p_project uuid,p_admin uuid,p_restore boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.service_projects%rowtype; b public.bookings%rowtype; has_payment boolean; events jsonb:='[]'::jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' or not exists(select 1 from public.profiles where id=p_admin and role='admin') then raise exception 'admin_required';end if;
 select * into strict p from public.service_projects where id=p_project for update;
 if p_restore then update public.service_projects set archived_at=null where id=p.id;
 else
  select exists(select 1 from public.payments where project_id=p.id and status='succeeded') or exists(select 1 from public.service_order_parts_v8 where project_id=p.id and paid_cents>0) into has_payment;
  if not has_payment then
   if exists(select 1 from public.service_quotes where project_id=p.id and status in('creating','open')) then raise exception 'active_payment';end if;
   for b in select distinct booked.* from public.bookings booked where booked.id in (
    select booking_id from public.service_order_parts_v8 where project_id=p.id and booking_id is not null
    union select c.booking_id from public.service_credit_bookings_v8 c join public.service_order_parts_v8 a on a.id=c.part_id where a.project_id=p.id
   ) loop
    if b.google_calendar_event_id is not null then events:=events||jsonb_build_array(jsonb_build_object('id',b.id,'event',b.google_calendar_event_id,'kind','booking'));end if;
    update public.bookings set status='cancelled',hold_expires_at=null,archived_at=now() where id=b.id;
    update public.notification_outbox set cancelled_at=now() where sent_at is null and cancelled_at is null and (position(b.reference in subject)>0 or position(b.reference in body)>0);
   end loop;
   if p.google_calendar_event_id is not null then events:=events||jsonb_build_array(jsonb_build_object('id',p.id,'event',p.google_calendar_event_id,'kind','project'));end if;
   update public.service_projects set status='cancelled' where id=p.id;
  end if;
  update public.service_projects set archived_at=now() where id=p.id;
  update public.notification_outbox set cancelled_at=now() where sent_at is null and cancelled_at is null and (position(p.reference in subject)>0 or position(p.reference in body)>0 or position(p.id::text in dedupe_key)>0);
 end if;
 insert into public.admin_audit_log(admin_id,action,entity_type,entity_id,payload) values(p_admin,case when p_restore then 'restore_service_order_visibility' else 'archive_service_order' end,'project',p.id::text,jsonb_build_object('reference',p.reference,'payments_preserved',true));
return jsonb_build_object('events',events);
end $$;
revoke all on function public.admin_manage_service_order(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_manage_service_order(uuid,uuid,boolean) to service_role;
CREATE OR REPLACE FUNCTION public.prepare_service_balance_v8(p_part uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare item public.service_order_parts_v8;p public.service_projects;q public.service_quotes;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server_only';end if;
 select * into strict item from public.service_order_parts_v8 where id=p_part for update;
 select * into strict p from public.service_projects where id=item.project_id for update;
 if p.archived_at is not null or p.status='cancelled' then raise exception 'order_archived';end if;
 if item.paid_cents<item.initial_cents or item.paid_cents>=item.total_cents then raise exception 'balance_unavailable';end if;
 select * into q from public.service_quotes where project_id=p.id and commerce_snapshot->>'partId'=item.id::text and status in ('creating','open') order by created_at desc limit 1;
 if q.id is null then
  insert into public.service_quotes(project_id,amount_cents,scope,revision_count,expires_at,fixed_price,commerce_snapshot)
  values(p.id,item.total_cents-item.paid_cents,'Saldo · '||(item.snapshot->>'title')||' · '||p.reference,1,now()+interval '24 hours',true,
  jsonb_build_object('version','2026-10-26-commerce-v8','stage','balance','partId',item.id)) returning * into q;
 end if;
 return to_jsonb(q)||jsonb_build_object('email',p.email,'reference',p.reference);
end $function$
;
CREATE OR REPLACE FUNCTION public.receive_service_part_v8(p_part uuid, p_stage text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare item public.service_order_parts_v8;p public.service_projects;amount integer;payid uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_stage not in ('initial','balance') then raise exception 'server_only';end if;
 select * into strict item from public.service_order_parts_v8 where id=p_part for update;
 select * into strict p from public.service_projects where id=item.project_id for update;
 if p.archived_at is not null or p.status='cancelled' then raise exception 'order_archived';end if;
 if exists(select 1 from public.service_quotes where project_id=p.id and commerce_snapshot->>'partId'=item.id::text and status in ('creating','open')) then raise exception 'balance_checkout_open';end if;
 if p_stage='initial' then
  if item.method<>'cash' or item.paid_cents>=item.initial_cents then raise exception 'already_paid';end if;
  if item.booking_id is not null and (item.hold_until<=now() or exists(select 1 from public.bookings where id=item.booking_id and status='cancelled')) then raise exception 'hold_expired';end if;
  amount:=item.initial_cents-item.paid_cents;
 else
  if item.paid_cents<item.initial_cents or item.paid_cents>=item.total_cents then raise exception 'invalid_balance';end if;
  amount:=item.total_cents-item.paid_cents;
 end if;
 insert into public.payments(project_id,provider,provider_payment_id,amount_cents,currency,status,livemode,paid_at,fee_cents)
 values(p.id,'cash','cash-v8-'||item.id||'-'||p_stage,amount,'EUR','succeeded',true,now(),0) returning id into payid;
 update public.service_order_parts_v8 set paid_cents=paid_cents+amount,initial_paid_at=coalesce(initial_paid_at,now()) where id=item.id;
 if item.booking_id is not null and p_stage='initial' then update public.bookings set status='confirmed',hold_expires_at=null where id=item.booking_id;end if;
 if not exists(select 1 from public.service_order_parts_v8 where project_id=p.id and paid_cents<initial_cents) then update public.service_projects set status='in_progress' where id=p.id;end if;
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body) values('cash-v8-'||item.id||'-'||p_stage,p.email,'GENKS · Incasso registrato · '||p.reference,'Pagamento in studio registrato',
 'Registrato incasso di '||to_char(amount/100.0,'FM9999990.00')||' EUR. Codice '||p.reference||'. '||case when p_stage='initial' and item.booking_id is not null then 'La sessione è confermata.' else '' end||E'\n'||p.notes);
 return payid;
end $function$
;
CREATE OR REPLACE FUNCTION public.schedule_service_credit_v8(p_part uuid, p_start timestamp with time zone, p_minutes integer)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare item public.service_order_parts_v8;p public.service_projects;b public.bookings;used integer;counted integer;credit_limit integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server_only';end if;
 select * into strict item from public.service_order_parts_v8 where id=p_part for update;
 select * into strict p from public.service_projects where id=item.project_id for update;
 if p.archived_at is not null or p.status='cancelled' then raise exception 'order_archived';end if;
 if item.snapshot->'selection'->>'packageCode' is distinct from 'hours' or item.paid_cents<item.initial_cents or item.initial_paid_at is null
 or p_start<=now() or p_start>item.initial_paid_at+interval '90 days' or p_minutes<15 or p_minutes%15<>0 then raise exception 'credit_unavailable';end if;
 select coalesce(sum(c.minutes),0),count(*) into used,counted from public.service_credit_bookings_v8 c join public.bookings booked on booked.id=c.booking_id where c.part_id=item.id and booked.status<>'cancelled';
 credit_limit:=coalesce((item.snapshot->>'creditMinutes')::integer,300);
 if credit_limit<300 or credit_limit>600 or credit_limit%60<>0 or p_minutes>480 then raise exception 'credit_unavailable';end if;
 if counted>=2 or used+p_minutes>credit_limit then raise exception 'credit_exhausted';end if;
 perform public.expire_booking_holds();
 insert into public.bookings(customer_id,service_id,name,artist_name,email,phone,starts_at,ends_at,notes,status,price_cents,deposit_cents,hold_expires_at)
 values(p.customer_id,(select id from public.booking_services where code='recording' and active limit 1),p.name,p.artist_name,p.email,p.phone,p_start,p_start+make_interval(mins=>p_minutes),
 p.reference||' · Ore del pacchetto già acquistate. Gestisci eventuale saldo dall’ordine, senza duplicare l’incasso.','confirmed',round(item.total_cents*p_minutes/credit_limit::numeric)::integer,round(item.initial_cents*p_minutes/credit_limit::numeric)::integer,null) returning * into b;
 insert into public.service_credit_bookings_v8(part_id,booking_id,minutes) values(item.id,b.id,p_minutes);
 update public.notification_outbox set cancelled_at=now() where sent_at is null and dedupe_key='request-'||b.reference||'-customer';
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body) values('v8-credit-'||b.id,p.email,'GENKS · Sessione confermata · '||b.reference,'La tua sessione è confermata',
 'Sessione dalle ore già acquistate. Codice ordine '||p.reference||'. Appuntamento '||to_char(p_start at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')||' · durata '||p_minutes||' minuti. Ore già acquistate; nessun secondo addebito. Controlla il saldo dell’ordine.');
 return b.reference;
end $function$


