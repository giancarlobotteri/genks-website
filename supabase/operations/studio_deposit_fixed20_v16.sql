
begin;

alter table public.service_order_parts_v8
  add column if not exists studio_released_at timestamptz,
  add column if not exists studio_released_cents integer not null default 0;

alter table public.service_order_parts_v8 drop constraint if exists service_order_parts_v8_total_cents_check;
alter table public.service_order_parts_v8 add constraint service_order_parts_v8_total_cents_check
  check (total_cents >= 50 or (total_cents >= 0 and studio_released_at is not null));

create or replace function public.studio_booking_touch_v16() returns trigger
language plpgsql set search_path='' as $
begin
 if new is distinct from old then new.updated_at:=clock_timestamp(); end if;
 return new;
end $;
drop trigger if exists studio_booking_touch_v16 on public.bookings;
create trigger studio_booking_touch_v16 before update on public.bookings
for each row execute function public.studio_booking_touch_v16();
drop trigger if exists studio_order_touch_v16 on public.service_projects;
create trigger studio_order_touch_v16 before update on public.service_projects
for each row execute function public.studio_booking_touch_v16();

create or replace function public.studio_part_touch_project_v16() returns trigger
language plpgsql set search_path='' as $$
begin
 update public.service_projects set updated_at=clock_timestamp() where id=new.project_id;
 return new;
end $$;
drop trigger if exists studio_part_touch_project_v16 on public.service_order_parts_v8;
create trigger studio_part_touch_project_v16 after insert or update on public.service_order_parts_v8
for each row execute function public.studio_part_touch_project_v16();

create or replace function public.studio_deposit_transition_v16(
 p_booking uuid,p_paid boolean,p_note text,p_expiry_only boolean
) returns jsonb language plpgsql set search_path='' as $$
declare
 item public.service_order_parts_v8; project public.service_projects; b public.bookings;
 old_status public.booking_status; remaining integer; adjustment integer; restored integer;
 received integer; reason text; event_time timestamptz:=clock_timestamp();
begin
 select * into item from public.service_order_parts_v8 where booking_id=p_booking for update;
 if not found then
  return jsonb_build_object('ok',false,'error',case when exists(select 1 from public.bookings where id=p_booking) then 'not_studio' else 'not_found' end);
 end if;
 select * into project from public.service_projects where id=item.project_id for update;
 select * into b from public.bookings where id=p_booking for update;
 if not found then return jsonb_build_object('ok',false,'error','not_found'); end if;
 if p_paid is null or project.archived_at is not null or project.status='cancelled'
    or project.commerce_snapshot->>'paymentPolicy' is distinct from 'studio-appointment-fixed20-v1'
    or b.deposit_cents is distinct from 2000 or b.status in ('rejected','completed','no_show')
 then return jsonb_build_object('ok',false,'error','not_studio'); end if;
 old_status:=b.status;

 if p_expiry_only and (
    b.status not in ('pending','approved_awaiting_payment')
    or b.hold_expires_at is null or b.hold_expires_at>event_time
    or item.paid_cents>=item.initial_cents
 ) then return jsonb_build_object('ok',true,'status',b.status,'deposit_cents',b.deposit_cents,'hold_expires_at',b.hold_expires_at); end if;

 if p_paid then
  if b.status='confirmed' and item.paid_cents>=2000 then
   return jsonb_build_object('ok',true,'status',b.status,'deposit_cents',b.deposit_cents,'hold_expires_at',b.hold_expires_at);
  end if;
  if b.starts_at<=event_time then return jsonb_build_object('ok',false,'error','slot_taken'); end if;
  begin
   update public.bookings set status='confirmed',hold_expires_at=null,updated_at=event_time where id=b.id returning * into b;
  exception when exclusion_violation or sqlstate '23P02' or sqlstate '23P03' then
   return jsonb_build_object('ok',false,'error','slot_taken');
  end;
  restored:=item.total_cents+item.studio_released_cents;
  received:=greatest(0,2000-item.paid_cents);
  if received>0 then
   insert into public.payments(project_id,provider,provider_payment_id,amount_cents,currency,status,livemode,paid_at,fee_cents)
   values(project.id,'cash','genks-cassa-acconto-'||b.id,received,'EUR','succeeded',true,event_time,0);
  end if;
  update public.service_order_parts_v8 set total_cents=restored,initial_cents=2000,balance_cents=restored-2000,
    paid_cents=item.paid_cents+received,initial_paid_at=coalesce(initial_paid_at,event_time),
    hold_until=null,studio_released_at=null,studio_released_cents=0 where id=item.id;
  update public.service_projects set price_cents=price_cents+item.studio_released_cents,updated_at=event_time where id=project.id;
  reason:='Acconto confermato dal gestionale';
 else
  if b.status='cancelled' and item.studio_released_at is not null then
   return jsonb_build_object('ok',true,'status',b.status,'deposit_cents',b.deposit_cents,'hold_expires_at',b.hold_expires_at);
  end if;
  -- Preserve money already received. A cancellation never creates an automatic refund.
  adjustment:=least(greatest(0,coalesce(b.price_cents,0)),greatest(0,item.total_cents-item.paid_cents));
  remaining:=item.total_cents-adjustment;
  update public.service_order_parts_v8 set total_cents=remaining,initial_cents=0,balance_cents=remaining,
    hold_until=null,studio_released_at=event_time,studio_released_cents=adjustment where id=item.id;
  update public.bookings set status='cancelled',hold_expires_at=null,updated_at=event_time where id=b.id returning * into b;
  update public.service_projects set price_cents=price_cents-adjustment,updated_at=event_time where id=project.id returning * into project;
  reason:=case when p_expiry_only then 'Riserva scaduta senza acconto' else 'Acconto non pagato: orario liberato dal gestionale' end;
  insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
  values('studio-release-'||b.id||'-'||extract(epoch from event_time),b.email,
    'GENKS · Sessione liberata · '||project.reference,'La sessione in studio è stata liberata',
    case when item.paid_cents=0 then 'L’acconto della sessione non risulta incassato. ' else 'La sessione è stata annullata. Gli importi già incassati sono registrati. ' end
    ||'L’orario del '||to_char(b.starts_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')
    ||' è di nuovo disponibile. La quota studio liberata non è più da versare. Gli eventuali altri servizi restano validi e si pagano a fine lavoro.'
    ||E'\nCodice ordine: '||project.reference
    ||E'\nTotale aggiornato: '||replace(to_char(project.price_cents/100.0,'FM999999990.00'),'.',',')||' €');
 end if;
 insert into public.booking_status_history(booking_id,from_status,to_status,note)
 values(b.id,old_status,b.status,concat_ws(' · ',reason,nullif(left(trim(p_note),500),'')));
 return jsonb_build_object('ok',true,'status',b.status,'deposit_cents',b.deposit_cents,'hold_expires_at',b.hold_expires_at);
end $$;

create or replace function public.gestionale_set_deposit(p_booking uuid,p_paid boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege; end if;
 return public.studio_deposit_transition_v16(p_booking,p_paid,p_note,false);
end $$;

revoke all on function public.studio_deposit_transition_v16(uuid,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.studio_deposit_transition_v16(uuid,boolean,text,boolean) to service_role;
revoke all on function public.gestionale_set_deposit(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.gestionale_set_deposit(uuid,boolean,text) to service_role;

create or replace function public.expire_booking_holds()
returns integer language plpgsql set search_path='' as $$
declare affected integer; booking_id uuid; result jsonb;
begin
 with expired as (
   update public.bookings b set status='cancelled',updated_at=now()
   where b.status in ('pending','approved_awaiting_payment') and b.hold_expires_at<=now()
     and not exists (
       select 1 from public.service_order_parts_v8 i join public.service_projects p on p.id=i.project_id
       where i.booking_id=b.id and p.commerce_snapshot->>'paymentPolicy'='studio-appointment-fixed20-v1'
     )
   returning b.id
 ) insert into public.booking_status_history(booking_id,to_status,note)
   select id,'cancelled','Riserva temporanea scaduta senza pagamento.' from expired;
 get diagnostics affected = row_count;
 for booking_id in
  select b.id from public.bookings b join public.service_order_parts_v8 i on i.booking_id=b.id
  join public.service_projects p on p.id=i.project_id
  where b.status in ('pending','approved_awaiting_payment') and b.hold_expires_at<=now()
   and p.commerce_snapshot->>'paymentPolicy'='studio-appointment-fixed20-v1' and i.paid_cents<i.initial_cents
 loop
  result:=public.studio_deposit_transition_v16(booking_id,false,null,true);
  if result->>'status'='cancelled' then affected:=affected+1; end if;
 end loop;
 return affected;
end $$;

CREATE OR REPLACE FUNCTION public.queue_service_status_notice()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare label text;
begin
 if tg_table_name='bookings' and new.status::text='cancelled' then
  if exists(select 1 from public.service_order_parts_v8 i where i.booking_id=new.id and i.studio_released_at is not null) then return new; end if;
 end if;
 if old.status=new.status or new.status::text in ('paid','confirmed','approved_awaiting_payment','awaiting_payment','delivered') then return new; end if;
 label:=case new.status::text when 'cancelled' then 'annullata' when 'rejected' then 'non accettata' when 'in_progress' then 'in lavorazione' when 'review' then 'in revisione' when 'completed' then 'completata' when 'no_show' then 'mancata presentazione' when 'pending' then 'in valutazione' when 'quoted' then 'preventivo in definizione' else 'aggiornata' end;
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
 values('status-'||tg_table_name||'-'||new.id||'-'||new.status||'-'||extract(epoch from clock_timestamp()),new.email,'Aggiornamento GENKS '||new.reference,'La tua richiesta è stata aggiornata.',
 'Richiesta '||new.reference||': '||label||'. Per chiarimenti rispondi a questa email. Un eventuale rimborso viene gestito e comunicato separatamente.');
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.reserve_service_cart_v16(p_data jsonb, p_quote jsonb, p_terms text, p_summary text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.service_projects; q public.service_quotes; b public.bookings; part jsonb; sel jsonb; idx integer:=0; linked_part uuid;
 new_policy boolean := coalesce(p_quote->>'paymentPolicy'='studio-appointment-fixed20-v1',false);
 total integer; upfront integer; start_at timestamptz; expiry timestamptz; card_expiry timestamptz:=now()+interval '31 minutes';
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server_only'; end if;
 if not new_policy then raise exception 'invalid_payment_policy'; end if;
 if p_quote->>'version' is distinct from '2026-10-26-commerce-v8' or p_data->>'accepted' is distinct from 'on'
 or jsonb_typeof(p_quote->'parts') is distinct from 'array' or jsonb_array_length(p_quote->'parts') not between 1 and 20
 or length(trim(coalesce(p_data->>'name','')))<2 or position('@' in coalesce(p_data->>'email',''))<2 or length(p_terms)<100
 then raise exception 'invalid_order'; end if;
 total:=(p_quote->>'total')::integer;upfront:=(p_quote->>'cardNow')::integer;
 if p_quote->>'requestId' is null then raise exception 'request_id_required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_quote->>'requestId',8126));
 select * into p from public.service_projects where commerce_snapshot->>'requestId'=p_quote->>'requestId';
 if p.id is not null then
  if p.commerce_snapshot->>'paymentPolicy' is distinct from 'studio-appointment-fixed20-v1' then raise exception 'invalid_payment_policy'; end if;
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
 p_summary,1,p_summary,case when new_policy then 'in_progress'::public.project_status else 'awaiting_payment'::public.project_status end,total,'[]',p_quote) returning * into p;
 update public.notification_outbox set cancelled_at=now() where sent_at is null and dedupe_key='request-'||p.reference||'-customer';
 for part in select value from jsonb_array_elements(p_quote->'parts') loop
  sel:=part->'selection';b.id:=null;expiry:=null;
  if (part->>'hours')::numeric>0 and coalesce(sel->>'date','')<>'' then
   start_at:=((sel->>'date')||' '||(sel->>'time'))::timestamp at time zone 'Europe/Rome';
   if new_policy then
    expiry:=public.genks_cash_hold_until(now(),start_at);
    if expiry is null or start_at<=now()+interval '35 minutes' then raise exception 'booking_too_close';end if;
    if sel->>'payment'='card' then
     if expiry<now()+interval '32 minutes' then raise exception 'card_booking_too_close';end if;
     card_expiry:=least(expiry,case when card_expiry=now()+interval '31 minutes' then now()+interval '23 hours 59 minutes' else card_expiry end);
    end if;
   elsif sel->>'payment'='card' then
    if start_at<=now()+interval '35 minutes' then raise exception 'booking_too_close';end if;
    expiry:=now()+interval '35 minutes';
   else
    if start_at<=now()+interval '35 minutes' then raise exception 'cash_booking_too_close';end if;
    expiry:=public.genks_cash_hold_until(now(),start_at);
    if expiry<=now() then raise exception 'cash_booking_too_close';end if;
   end if;
   if (part->>'dueNow')::integer is distinct from 2000 or (part->>'total')::integer<2000 then raise exception 'invalid_booking_deposit';end if;
   insert into public.bookings(customer_id,service_id,name,artist_name,email,phone,starts_at,ends_at,notes,status,price_cents,deposit_cents,hold_expires_at)
   values(p.customer_id,(select id from public.booking_services where code='recording' and active limit 1),p.name,p.artist_name,p.email,p.phone,
   start_at,start_at+make_interval(mins=>round((part->>'hours')::numeric*60)::integer),p.reference||E'\n'||p_summary,
   'approved_awaiting_payment',coalesce((part->>'bookingAmount')::integer,(part->>'studioAmount')::integer),2000,expiry) returning * into b;
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
 ('v8-order-'||p.id,p.email,'GENKS · Ordine ricevuto · '||p.reference,'Il tuo ordine e i prossimi passi',p_summary||E'\n\nCODICE ORDINE: '||p.reference||case when new_policy then E'\nIl saldo si paga a fine lavoro. L’acconto conferma soltanto la sessione di studio.\n\n' else E'\nPresenta questo codice in studio per i pagamenti in contanti. Le sessioni restano in attesa finché non viene incassato l’anticipo. Riserva contanti: versa l’importo iniziale indicato nel riepilogo entro metà del tempo tra richiesta e inizio sessione. Senza anticipo registrato l’orario si libera automaticamente.\n\n' end||p_terms),
 ('v8-owner-'||p.id,'prod.genks@gmail.com','GENKS · Nuovo ordine · '||p.reference,'Hai una nuova prenotazione',p.name||E'\nEmail: '||p.email||E'\nTelefono: '||coalesce(p.phone,'')||E'\n'||p_summary||E'\nCodice: '||p.reference||E'\nControlla lo stato dell’anticipo prima di considerare confermata una sessione.');
 return jsonb_build_object('project_id',p.id,'reference',p.reference,'quote_id',q.id,'expires_at',q.expires_at);
end $function$;

CREATE OR REPLACE FUNCTION public.settle_service_cart_v16(p_quote uuid, p_session text, p_payment text, p_amount integer, p_currency text, p_live boolean, p_event text, p_paid_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
 if p.commerce_snapshot->>'paymentPolicy' is distinct from 'studio-appointment-fixed20-v1' then raise exception 'invalid_payment_policy'; end if;
 if q.status not in ('open','creating') or q.expires_at<p_paid_at then review:='Pagamento ricevuto dopo la scadenza: verificare disponibilità o rimborso.';end if;
 if (q.commerce_snapshot->>'stage' is distinct from 'balance' or p.commerce_snapshot->>'paymentPolicy' is distinct from 'studio-appointment-fixed20-v1') and exists(select 1 from public.service_order_parts_v8 a join public.bookings b on b.id=a.booking_id where a.project_id=p.id and a.method='card' and (a.studio_released_at is not null or (a.initial_cents>0 and (b.status='cancelled' or b.hold_expires_at<p_paid_at or a.paid_cents>0)))) then review:='Orario non più riservato: verifica prima di confermare.';end if;
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
   for item in select * from public.service_order_parts_v8 where project_id=p.id and method='card' and initial_cents>0 for update loop
    update public.service_order_parts_v8 set paid_cents=initial_cents,initial_paid_at=p_paid_at where id=item.id;
    if item.booking_id is not null then
     select status into oldstatus from public.bookings where id=item.booking_id for update;
     update public.bookings set status='confirmed',hold_expires_at=null,updated_at=now() where id=item.booking_id;
    end if;
   end loop;
   update public.service_projects set status=case when p.commerce_snapshot->>'paymentPolicy'='studio-appointment-fixed20-v1' then 'in_progress'::public.project_status when exists(select 1 from public.service_order_parts_v8 where project_id=p.id and paid_cents<initial_cents) then 'awaiting_payment'::public.project_status else 'in_progress'::public.project_status end where id=p.id;
  end if;
 end if;
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body) values
 ('payment-'||pay.id,p.email,'GENKS · Pagamento · '||p.reference,case when review is null then 'Pagamento ricevuto' else 'Pagamento da verificare' end,
 case when review is null then 'Ricevuto '||to_char(p_amount/100.0,'FM9999990.00')||' EUR. Pagamento verificato. '||case when q.commerce_snapshot->>'stage'='balance' then 'Saldo della voce indicata registrato.' when p.commerce_snapshot->>'paymentPolicy'='studio-appointment-fixed20-v1' then 'Acconto verificato: gli orari di studio pagati con carta sono confermati.' else 'Gli appuntamenti pagati con carta sono confermati; quelli con anticipo in contanti restano in attesa del relativo incasso.' end else review end||E'\n\nIl riepilogo seguente riporta gli importi originariamente concordati. Le ricevute dei pagamenti successivi indicano gli incassi effettivi.\n'||p.notes||E'\nCODICE ORDINE: '||p.reference||E'\nPer i contanti passa in studio e presenta questo codice.');
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body) values
 ('v8-paid-owner-'||pay.id,'prod.genks@gmail.com','GENKS · Incasso · '||p.reference,'Hai una nuova prenotazione',
 coalesce(review,'Pagamento con carta verificato. Controlla gli stati delle singole sessioni e gli eventuali saldi.')||E'\n'||p.reference||E'\n'||p.notes);
 return pay.id;
end $function$;


revoke all on function public.reserve_service_cart_v16(jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.reserve_service_cart_v16(jsonb,jsonb,text,text) to service_role;
revoke all on function public.settle_service_cart_v16(uuid,text,text,integer,text,boolean,text,timestamp with time zone) from public,anon,authenticated;
grant execute on function public.settle_service_cart_v16(uuid,text,text,integer,text,boolean,text,timestamp with time zone) to service_role;
commit;
