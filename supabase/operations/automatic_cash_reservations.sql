begin;
alter table public.studio_cash_agreements alter column agreed_by drop not null;
alter table public.studio_cash_agreements alter column revision_count drop not null;
alter table public.studio_cash_agreements add column if not exists customer_accepted_at timestamptz;
alter table public.studio_cash_agreements add column if not exists rate_version text;
alter table public.studio_cash_agreements add column if not exists fulfillment_mode text check(fulfillment_mode in ('studio','remote'));
update public.booking_services set base_price_cents=2000 where code='recording';

-- One transaction reserves capacity, snapshots the price, and queues both notifications.
-- Only the server may call this function; it never records cash as received.
create or replace function public.reserve_cash_service(p_type text,p_data jsonb,p_owner_email text)
returns text language plpgsql security invoker set search_path='' as $$
declare b public.bookings; p public.service_projects; aid uuid; sid uuid; rate integer;
 hours integer; amount integer; details text; ref text; recipient text; target uuid;
 start_at timestamptz; end_at timestamptz; mode text; service text; person text;
begin
 if p_data->>'rateVersion' is distinct from '2026-10-20-v2' or p_data->>'accepted' is distinct from 'on' then raise exception 'price_changed'; end if;
 recipient:=lower(trim(p_data->>'email')); person:=trim(p_data->>'name');
 if length(person) not between 2 and 120 or recipient is null or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or p_owner_email is null or p_owner_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_request'; end if;
 if p_type='booking' then
  hours:=(p_data->>'duration')::integer;
  if hours not in(1,2,3,4,6,8) then raise exception 'invalid_duration'; end if;
  select id,base_price_cents into sid,rate from public.booking_services where code='recording' and active for share;
  if sid is null or rate<>2000 then raise exception 'price_changed'; end if;
  amount:=rate*hours; start_at:=(p_data->>'startsAt')::timestamptz; end_at:=start_at+make_interval(hours=>hours);
  if start_at is null or start_at<=now() or start_at>now()+interval '1 year' or length(trim(coalesce(p_data->>'phone',''))) not between 6 and 40 then raise exception 'invalid_request'; end if;
  perform public.expire_booking_holds();
  insert into public.bookings(reference,customer_id,service_id,name,artist_name,email,phone,starts_at,ends_at,notes,reference_url,status,price_cents,deposit_cents,hold_expires_at)
  values('BKG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),nullif(p_data->>'customerId','')::uuid,sid,person,nullif(p_data->>'artistName',''),recipient,p_data->>'phone',start_at,end_at,nullif(p_data->>'notes',''),nullif(p_data->>'referenceUrl',''),'confirmed',amount,0,null)
  returning * into b;
  ref:=b.reference;target:=b.id;mode:='studio';
  details:='Registrazione in studio · '||hours||' ore × 20,00 EUR/ora. Totale '||to_char(amount/100.0,'FM999990.00')||' EUR. Pagamento in contanti presso lo studio. Appuntamento: '||to_char(start_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')||' – '||to_char(end_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')||' (ora italiana).';
 else
  if p_type<>'project' then raise exception 'invalid_type'; end if;
  service:=p_data->>'service';mode:=p_data->>'mode';
  amount:=case service when 'mix' then 10000 when 'master' then 4000 when 'mix_master' then 12000 end;
  if amount is null or mode is null or mode not in('studio','remote') or length(trim(coalesce(p_data->>'trackTitle',''))) not between 1 and 160
   or length(trim(coalesce(p_data->>'description',''))) not between 10 and 4000 or (p_data->>'trackCount')::integer not between 1 and 200 then raise exception 'invalid_request'; end if;
  insert into public.service_projects(customer_id,name,artist_name,email,phone,track_title,service,description,track_count,reference_links,desired_deadline,notes,status,price_cents)
  values(nullif(p_data->>'customerId','')::uuid,person,nullif(p_data->>'artistName',''),recipient,nullif(p_data->>'phone',''),p_data->>'trackTitle',service,p_data->>'description',(p_data->>'trackCount')::integer,array(select jsonb_array_elements_text(coalesce(p_data->'links','[]'::jsonb))),nullif(p_data->>'desiredDeadline','')::date,concat('Modalità: ',mode,E'\n',p_data->>'notes'),'in_progress',amount)
  returning * into p;
  ref:=p.reference;target:=p.id;
  details:=replace(service,'_',' + ')||' · 1 brano: '||(p_data->>'trackTitle');
  details:=details||'. Totale '||to_char(amount/100.0,'FM999990.00')||' EUR. Modalità: '||case mode when 'remote' then 'a distanza' else 'in studio' end||'. Prenotazione confermata; invio file, consegna e revisioni da concordare prima dell’avvio. Pagamento in contanti presso lo studio, anche per il lavoro a distanza. Nessuna data di consegna è confermata con questa prenotazione.';
 end if;
 insert into public.studio_cash_agreements(booking_id,project_id,amount_cents,details,revision_count,customer_accepted_at,rate_version,fulfillment_mode)
 values(case when p_type='booking' then target end,case when p_type='project' then target end,amount,details,case when p_type='booking' then 0 end,now(),'2026-10-20-v2',mode) returning id into aid;
 -- The legacy request receipt is created by an insert trigger: replace it before any worker can see it.
 update public.notification_outbox set cancelled_at=now() where dedupe_key='request-'||ref||'-customer' and sent_at is null;
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
 values('cash-agree-'||aid,recipient,'GENKS · Prenotazione confermata · '||ref,'La tua prenotazione è confermata.',details||E'\nRiferimento: '||ref||E'\nNessun pagamento è stato ancora registrato. Per cambi o cancellazioni rispondi a questa email.'),
 ('reservation-'||ref||'-admin',p_owner_email,'GENKS · Nuova prenotazione · '||ref,'Nuova prenotazione confermata.',person||E'\n'||details||E'\nEmail cliente: '||recipient||E'\nTelefono: '||coalesce(p_data->>'phone','')||E'\nRiferimento: '||ref||E'\nNon serve approvare la prenotazione. Registra il pagamento soltanto dopo aver ricevuto i contanti.');
 return ref;
end $$;
revoke all on function public.reserve_cash_service(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.reserve_cash_service(text,jsonb,text) to service_role;
commit;
