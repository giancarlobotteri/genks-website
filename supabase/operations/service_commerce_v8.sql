-- Additive release. Existing contracts, quotes and prices remain untouched.
begin;
create table if not exists public.service_order_parts_v8 (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.service_projects(id),
 booking_id uuid references public.bookings(id), position integer not null, snapshot jsonb not null,
 total_cents integer not null check(total_cents>=50), initial_cents integer not null check(initial_cents>=0),
 balance_cents integer not null check(balance_cents>=0), paid_cents integer not null default 0 check(paid_cents>=0),
 method text not null check(method in ('card','cash')), hold_until timestamptz,initial_paid_at timestamptz,
 unique(project_id,position),check(initial_cents+balance_cents=total_cents),check(paid_cents<=total_cents)
);
alter table public.service_order_parts_v8 enable row level security;
revoke all on public.service_order_parts_v8 from public,anon,authenticated;
grant select,insert,update on public.service_order_parts_v8 to service_role;
create index if not exists service_order_parts_v8_project on public.service_order_parts_v8(project_id);
create table if not exists public.service_credit_bookings_v8(part_id uuid not null references public.service_order_parts_v8(id),booking_id uuid primary key references public.bookings(id),minutes integer not null check(minutes>0));
alter table public.service_credit_bookings_v8 enable row level security;
revoke all on public.service_credit_bookings_v8 from public,anon,authenticated;
grant select,insert on public.service_credit_bookings_v8 to service_role;

create or replace function public.reserve_service_cart_v8(p_data jsonb,p_quote jsonb,p_terms text,p_summary text)
returns jsonb language plpgsql set search_path='' as $$
declare p public.service_projects; q public.service_quotes; b public.bookings; part jsonb; sel jsonb; idx integer:=0;
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
    expiry:=least(now()+interval '24 hours',start_at-interval '24 hours');
    if expiry<=now() then raise exception 'cash_booking_too_close';end if;
   end if;
   insert into public.bookings(customer_id,service_id,name,artist_name,email,phone,starts_at,ends_at,notes,status,price_cents,deposit_cents,hold_expires_at)
   values(p.customer_id,(select id from public.booking_services where code='recording' and active limit 1),p.name,p.artist_name,p.email,p.phone,
   start_at,start_at+make_interval(mins=>round((part->>'hours')::numeric*60)::integer),p.reference||E'\n'||p_summary,
   'approved_awaiting_payment',(part->>'studioAmount')::integer,round((part->>'studioAmount')::numeric/2)::integer,expiry) returning * into b;
   update public.notification_outbox set cancelled_at=now() where sent_at is null and dedupe_key='request-'||b.reference||'-customer';
  end if;
  insert into public.service_order_parts_v8(project_id,booking_id,position,snapshot,total_cents,initial_cents,balance_cents,method,hold_until)
  values(p.id,b.id,idx,part,(part->>'total')::integer,(part->>'dueNow')::integer,(part->>'balance')::integer,sel->>'payment',expiry);
  idx:=idx+1;
 end loop;
 insert into public.project_contracts(project_id,terms_version,terms_body,early_start_requested,withdrawal_acknowledged,amount_cents,track_count,revision_count)
 values(p.id,'2026-10-26-v8',p_terms||E'\n\n'||p_summary,coalesce((p_data->>'earlyStart')::boolean,false),coalesce((p_data->>'withdrawalAcknowledged')::boolean,false),total,1,1);
 if upfront>=50 then
  insert into public.service_quotes(project_id,amount_cents,scope,revision_count,expires_at,fixed_price,commerce_snapshot)
  values(p.id,upfront,p_summary,1,card_expiry,true,p_quote||'{"stage":"initial"}'::jsonb) returning * into q;
 end if;
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body) values
 ('v8-order-'||p.id,p.email,'GENKS · Ordine ricevuto · '||p.reference,'Il tuo ordine e i prossimi passi',p_summary||E'\n\nCODICE ORDINE: '||p.reference||E'\nPresenta questo codice in studio per i pagamenti in contanti. Le sessioni restano in attesa finché non viene incassato l’anticipo. Riserva contanti: massimo 24 ore, comunque entro 24 ore prima della sessione.\n\n'||p_terms),
 ('v8-owner-'||p.id,'prod.genks@gmail.com','GENKS · Nuovo ordine · '||p.reference,'Hai una nuova prenotazione',p.name||E'\nEmail: '||p.email||E'\nTelefono: '||coalesce(p.phone,'')||E'\n'||p_summary||E'\nCodice: '||p.reference||E'\nControlla lo stato dell’anticipo prima di considerare confermata una sessione.');
 return jsonb_build_object('project_id',p.id,'reference',p.reference,'quote_id',q.id,'expires_at',q.expires_at);
end $$;

create or replace function public.settle_service_cart_v8(p_quote uuid,p_session text,p_payment text,p_amount integer,p_currency text,p_live boolean,p_event text,p_paid_at timestamptz)
returns uuid language plpgsql set search_path='' as $$
declare q public.service_quotes; p public.service_projects; pay public.payments; item public.service_order_parts_v8; review text; oldstatus public.booking_status;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server_only';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_payment,4912));
 select * into q from public.service_quotes where id=p_quote for update;
 if q.id is null or q.commerce_snapshot->>'version' is distinct from '2026-10-26-commerce-v8' or q.stripe_session_id is distinct from p_session or q.amount_cents<>p_amount or upper(p_currency)<>'EUR' then raise exception 'payment_mismatch';end if;
 select * into pay from public.payments where provider_payment_id=p_payment;
 if pay.id is not null then
  if pay.quote_id<>q.id or pay.amount_cents<>p_amount or pay.livemode<>p_live then raise exception 'payment_mismatch';end if;
  return pay.id;
 end if;
 select * into strict p from public.service_projects where id=q.project_id for update;
 if q.status not in ('open','creating') or q.expires_at<now() then review:='Pagamento ricevuto dopo la scadenza: verificare disponibilità o rimborso.';end if;
 if exists(select 1 from public.service_order_parts_v8 a join public.bookings b on b.id=a.booking_id where a.project_id=p.id and a.method='card' and (b.status='cancelled' or b.hold_expires_at<=now())) then review:='Orario non più riservato: verifica prima di confermare.';end if;
 insert into public.payments(project_id,quote_id,provider_payment_id,amount_cents,currency,status,raw_event_id,livemode,paid_at,review_reason)
 values(p.id,q.id,p_payment,p_amount,'EUR','succeeded',p_event,p_live,p_paid_at,review) returning * into pay;
 update public.service_quotes set status='paid' where id=q.id;
 if review is null then
  if q.commerce_snapshot->>'stage'='custom' then
   -- A custom request is a separate, explicit charge; never silently changes an existing balance.
   update public.service_projects set status='paid' where id=p.id;
  elsif q.commerce_snapshot->>'stage'='balance' then
   select * into strict item from public.service_order_parts_v8 where id=(q.commerce_snapshot->>'partId')::uuid and project_id=p.id for update;
   if item.paid_cents<item.initial_cents or item.total_cents-item.paid_cents<>p_amount then raise exception 'balance_mismatch';end if;
   update public.service_order_parts_v8 set paid_cents=total_cents where id=item.id;
  else
   for item in select * from public.service_order_parts_v8 where project_id=p.id and method='card' for update loop
    update public.service_order_parts_v8 set paid_cents=initial_cents,initial_paid_at=p_paid_at where id=item.id;
    if item.booking_id is not null then
     select status into oldstatus from public.bookings where id=item.booking_id for update;
     update public.bookings set status='confirmed',hold_expires_at=null where id=item.booking_id;
    end if;
   end loop;
   update public.service_projects set status=case when exists(select 1 from public.service_order_parts_v8 where project_id=p.id and paid_cents<initial_cents) then 'awaiting_payment'::public.project_status else 'in_progress'::public.project_status end where id=p.id;
  end if;
 end if;
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body) values
 ('payment-'||pay.id,p.email,'GENKS · Pagamento · '||p.reference,case when review is null then 'Pagamento ricevuto' else 'Pagamento da verificare' end,
 case when review is null then 'Ricevuto '||to_char(p_amount/100.0,'FM9999990.00')||' EUR. Pagamento verificato. '||case when q.commerce_snapshot->>'stage'='balance' then 'Saldo della voce indicata registrato.' else 'Gli appuntamenti pagati con carta sono confermati; quelli con anticipo in contanti restano in attesa del relativo incasso.' end else review end||E'\n\nIl riepilogo seguente riporta gli importi originariamente concordati. Le ricevute dei pagamenti successivi indicano gli incassi effettivi.\n'||p.notes||E'\nCODICE ORDINE: '||p.reference||E'\nPer i contanti passa in studio e presenta questo codice.');
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body) values
 ('v8-paid-owner-'||pay.id,'prod.genks@gmail.com','GENKS · Incasso · '||p.reference,'Hai una nuova prenotazione',
 coalesce(review,'Pagamento con carta verificato. Controlla gli stati delle singole sessioni e gli eventuali saldi.')||E'\n'||p.reference||E'\n'||p.notes);
 return pay.id;
end $$;

create or replace function public.receive_service_part_v8(p_part uuid,p_stage text)
returns uuid language plpgsql set search_path='' as $$
declare item public.service_order_parts_v8;p public.service_projects;amount integer;payid uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_stage not in ('initial','balance') then raise exception 'server_only';end if;
 select * into strict item from public.service_order_parts_v8 where id=p_part for update;
 select * into strict p from public.service_projects where id=item.project_id for update;
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
end $$;
create or replace function public.prepare_service_balance_v8(p_part uuid)
returns jsonb language plpgsql set search_path='' as $$
declare item public.service_order_parts_v8;p public.service_projects;q public.service_quotes;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server_only';end if;
 select * into strict item from public.service_order_parts_v8 where id=p_part for update;
 select * into strict p from public.service_projects where id=item.project_id;
 if item.paid_cents<item.initial_cents or item.paid_cents>=item.total_cents then raise exception 'balance_unavailable';end if;
 select * into q from public.service_quotes where project_id=p.id and commerce_snapshot->>'partId'=item.id::text and status in ('creating','open') order by created_at desc limit 1;
 if q.id is null then
  insert into public.service_quotes(project_id,amount_cents,scope,revision_count,expires_at,fixed_price,commerce_snapshot)
  values(p.id,item.total_cents-item.paid_cents,'Saldo · '||(item.snapshot->>'title')||' · '||p.reference,1,now()+interval '24 hours',true,
  jsonb_build_object('version','2026-10-26-commerce-v8','stage','balance','partId',item.id)) returning * into q;
 end if;
 return to_jsonb(q)||jsonb_build_object('email',p.email,'reference',p.reference);
end $$;
create or replace function public.schedule_service_credit_v8(p_part uuid,p_start timestamptz,p_minutes integer)
returns text language plpgsql set search_path='' as $$
declare item public.service_order_parts_v8;p public.service_projects;b public.bookings;used integer;counted integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server_only';end if;
 select * into strict item from public.service_order_parts_v8 where id=p_part for update;
 select * into strict p from public.service_projects where id=item.project_id;
 if item.snapshot->'selection'->>'packageCode' is distinct from 'hours' or item.paid_cents<item.initial_cents or item.initial_paid_at is null
 or p_start<=now() or p_start>item.initial_paid_at+interval '90 days' or p_minutes<15 or p_minutes%15<>0 then raise exception 'credit_unavailable';end if;
 select coalesce(sum(c.minutes),0),count(*) into used,counted from public.service_credit_bookings_v8 c join public.bookings booked on booked.id=c.booking_id where c.part_id=item.id and booked.status<>'cancelled';
 if counted>=2 or used+p_minutes>300 then raise exception 'credit_exhausted';end if;
 perform public.expire_booking_holds();
 insert into public.bookings(customer_id,service_id,name,artist_name,email,phone,starts_at,ends_at,notes,status,price_cents,deposit_cents,hold_expires_at)
 values(p.customer_id,(select id from public.booking_services where code='recording' and active limit 1),p.name,p.artist_name,p.email,p.phone,p_start,p_start+make_interval(mins=>p_minutes),
 p.reference||' · Ore del pacchetto già acquistate. Gestisci eventuale saldo dall’ordine, senza duplicare l’incasso.','confirmed',round(item.total_cents*p_minutes/300.0)::integer,round(item.initial_cents*p_minutes/300.0)::integer,null) returning * into b;
 insert into public.service_credit_bookings_v8(part_id,booking_id,minutes) values(item.id,b.id,p_minutes);
 update public.notification_outbox set cancelled_at=now() where sent_at is null and dedupe_key='request-'||b.reference||'-customer';
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body) values('v8-credit-'||b.id,p.email,'GENKS · Sessione confermata · '||b.reference,'La tua sessione è confermata',
 'Sessione dal Blocco 5 ore. Codice ordine '||p.reference||'. Appuntamento '||to_char(p_start at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')||' · durata '||p_minutes||' minuti. Ore già acquistate; nessun secondo addebito. Controlla il saldo dell’ordine.');
 return b.reference;
end $$;
revoke all on function public.reserve_service_cart_v8(jsonb,jsonb,text,text),public.settle_service_cart_v8(uuid,text,text,integer,text,boolean,text,timestamptz),public.receive_service_part_v8(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_service_cart_v8(jsonb,jsonb,text,text),public.settle_service_cart_v8(uuid,text,text,integer,text,boolean,text,timestamptz),public.receive_service_part_v8(uuid,text) to service_role;
revoke all on function public.schedule_service_credit_v8(uuid,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.schedule_service_credit_v8(uuid,timestamptz,integer) to service_role;
revoke all on function public.prepare_service_balance_v8(uuid) from public,anon,authenticated;
grant execute on function public.prepare_service_balance_v8(uuid) to service_role;
commit;
