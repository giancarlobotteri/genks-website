CREATE OR REPLACE FUNCTION public.schedule_service_credit_v8(p_part uuid, p_start timestamp with time zone, p_minutes integer)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare item public.service_order_parts_v8;p public.service_projects;b public.bookings;used integer;counted integer;credit_limit integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server_only';end if;
 select * into strict item from public.service_order_parts_v8 where id=p_part for update;
 select * into strict p from public.service_projects where id=item.project_id;
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
;
revoke all on function public.schedule_service_credit_v8(uuid,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.schedule_service_credit_v8(uuid,timestamptz,integer) to service_role;

