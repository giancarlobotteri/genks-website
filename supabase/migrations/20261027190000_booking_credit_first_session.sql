CREATE OR REPLACE FUNCTION public.reserve_service_cart_v8(p_data jsonb, p_quote jsonb, p_terms text, p_summary text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.service_projects; q public.service_quotes; b public.bookings; part jsonb; sel jsonb; idx integer:=0; linked_part uuid;
 total integer; upfront integer; start_at timestamptz; expiry timestamptz; card_expiry timestamptz:=now()+interval '31 minutes';
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server_only'; end if;
 if p_quote->>'version' is distinct from '2026-10-26-commerce-v8' or p_data->>'accepted' is distinct from 'on'
 or jsonb_typeof(p_quote->'parts') is distinct from 'array' or jsonb_array_length(p_quote->'parts') not between 1 and 20
 or length(trim(coalesce(p_data->>'name','')))<2 or position('@' in coalesce(p_data->>'email',''))<2 or length(p_terms)<100
 then raise exception 'invalid_order'; end if;
 total:=(p_quote->>'total')::integer;upfront:=(p_quote->>'cardNow')::integer;
 if p_quote->>'requestId' is null then raise exception 'request_id_required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_quote->>'requestId',8126));
 select * into p from public.service_projects where commerce_snapshot->>'requestId'=p_quote->>'requestId';
 if p.id is not null then
  if p.email<>lower(p_data->>'email') or p.price_cents<>total then raise exception 'request_id_mismatch';end if;
  select * into q from public.service_quotes where project_id=p.id order by created_at desc limit 1;
  if q.id is not null and (q.status not in ('creating','open') or q.expires_at<now()) then raise exception 'request_expired_or_paid';end if;
  return jsonb_build_object('project_id',p.id,'reference',p.reference,'quote_id',q.id,'expires_at',q.expires_at);
 end if;
 if total not between 50 and 2000000 or upfront<0 or total<>(select sum((v->>'total')::integer) from jsonb_array_elements(p_quote->'parts') v)
 or total<>upfront+(p_quote->>'cashNow')::integer+(p_quote->>'balance')::integer then raise exception 'invalid_total'; end if;
 perform public.expire_booking_holds();
 insert into public.service_projects(customer_id,name,artist_name,email,phone,track_title,service,description,track_count,notes,status,price_cents,songs,commerce_snapshot)
 values(nullif(p_data->>'customerId','')::uuid,p_data->>'name',nullif(p_data->>'artistName',''),lower(p_data->>'email'),p_data->>'phone',
 case when jsonb_array_length(p_quote->'parts')=1 then p_quote->'parts'->0->>'title' else 'Carrello servizi GENKS' end,
 case when p_quote->'parts'->0->'selection'->>'kind' in ('mix','master','mix_master') then p_quote->'parts'->0->'selection'->>'kind' else 'studio_package' end,
 p_summary,1,p_summary,'awaiting_payment',total,'[]',p_quote) returning * into p;
 update public.notification_outbox set cancelled_at=now() where sent_at is null and dedupe_key='request-'||p.reference||'-customer';
 for part in select value from jsonb_array_elements(p_quote->'parts') loop
  sel:=part->'selection';b.id:=null;expiry:=null;
  if (part->>'hours')::numeric>0 and coalesce(sel->>'date','')<>'' then
   start_at:=((sel->>'date')||' '||(sel->>'time'))::timestamp at time zone 'Europe/Rome';
   if sel->>'payment'='card' then
    if start_at<=now()+interval '35 minutes' then raise exception 'booking_too_close';end if;
    expiry:=now()+interval '35 minutes';
   else
    if start_at<=now()+interval '35 minutes' then raise exception 'cash_booking_too_close';end if;
    expiry:=public.genks_cash_hold_until(now(),start_at);
    if expiry<=now() then raise exception 'cash_booking_too_close';end if;
   end if;
   insert into public.bookings(customer_id,service_id,name,artist_name,email,phone,starts_at,ends_at,notes,status,price_cents,deposit_cents,hold_expires_at)
   values(p.customer_id,(select id from public.booking_services where code='recording' and active limit 1),p.name,p.artist_name,p.email,p.phone,
   start_at,start_at+make_interval(mins=>round((part->>'hours')::numeric*60)::integer),p.reference||E'\n'||p_summary,
   'approved_awaiting_payment',coalesce((part->>'bookingAmount')::integer,(part->>'studioAmount')::integer),round(coalesce((part->>'bookingAmount')::numeric,(part->>'studioAmount')::numeric)/2)::integer,expiry) returning * into b;
   update public.notification_outbox set cancelled_at=now() where sent_at is null and dedupe_key='request-'||b.reference||'-customer';
  end if;
  insert into public.service_order_parts_v8(project_id,booking_id,position,snapshot,total_cents,initial_cents,balance_cents,method,hold_until)
  values(p.id,b.id,idx,part,(part->>'total')::integer,(part->>'dueNow')::integer,(part->>'balance')::integer,sel->>'payment',expiry) returning id into linked_part;
  if sel->>'packageCode'='hours' and b.id is not null then
   insert into public.service_credit_bookings_v8(part_id,booking_id,minutes) values(linked_part,b.id,round((part->>'hours')::numeric*60)::integer);
  end if;
  idx:=idx+1;
 end loop;
 insert into public.project_contracts(project_id,terms_version,terms_body,early_start_requested,withdrawal_acknowledged,amount_cents,track_count,revision_count)
 values(p.id,coalesce(p_quote->>'termsVersion','2026-10-26-v8'),p_terms||E'\n\n'||p_summary,coalesce((p_data->>'earlyStart')::boolean,false),coalesce((p_data->>'withdrawalAcknowledged')::boolean,false),total,1,1);
 if upfront>=50 then
  insert into public.service_quotes(project_id,amount_cents,scope,revision_count,expires_at,fixed_price,commerce_snapshot)
  values(p.id,upfront,p_summary,1,card_expiry,true,p_quote||'{"stage":"initial"}'::jsonb) returning * into q;
 end if;
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body) values
 ('v8-order-'||p.id,p.email,'GENKS · Ordine ricevuto · '||p.reference,'Il tuo ordine e i prossimi passi',p_summary||E'\n\nCODICE ORDINE: '||p.reference||E'\nPresenta questo codice in studio per i pagamenti in contanti. Le sessioni restano in attesa finché non viene incassato l’anticipo. Riserva contanti: versa il 50% entro metà del tempo tra richiesta e inizio sessione. Senza anticipo registrato l’orario si libera automaticamente.\n\n'||p_terms),
 ('v8-owner-'||p.id,'prod.genks@gmail.com','GENKS · Nuovo ordine · '||p.reference,'Hai una nuova prenotazione',p.name||E'\nEmail: '||p.email||E'\nTelefono: '||coalesce(p.phone,'')||E'\n'||p_summary||E'\nCodice: '||p.reference||E'\nControlla lo stato dell’anticipo prima di considerare confermata una sessione.');
 return jsonb_build_object('project_id',p.id,'reference',p.reference,'quote_id',q.id,'expires_at',q.expires_at);
end $function$
;
