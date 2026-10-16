begin;
alter table public.notification_outbox add column cancelled_at timestamptz;
alter table public.entitlements add column revocation_reason text;

create or replace function public.claim_notification(p_id uuid) returns setof public.notification_outbox language sql set search_path='' as $$
  update public.notification_outbox set locked_until=now()+interval '5 minutes',attempts=attempts+1
  where id=p_id and sent_at is null and cancelled_at is null and (locked_until is null or locked_until<now()) returning *;
$$;

create or replace function public.record_stripe_refund(p_payment text,p_refund text,p_amount integer,p_at timestamptz)
returns void language plpgsql set search_path='' as $$
declare pay public.payments; refunded integer; recipient text; reference text;
begin
  select * into pay from public.payments where provider_payment_id=p_payment for update;
  if pay.id is null then raise exception 'payment_not_recorded'; end if;
  if exists(select 1 from public.payment_adjustments where provider_refund_id=p_refund and (payment_id<>pay.id or amount_cents<>p_amount)) then raise exception 'refund_mismatch'; end if;
  insert into public.payment_adjustments(provider_refund_id,payment_id,amount_cents,occurred_at)
    values(p_refund,pay.id,p_amount,p_at) on conflict(provider_refund_id) do nothing;
  select coalesce(sum(amount_cents),0) into refunded from public.payment_adjustments where payment_id=pay.id;
  if refunded>pay.amount_cents then raise exception 'refund_exceeds_payment'; end if;
  update public.payments set refunded_cents=refunded,status=case when refunded=amount_cents then 'refunded'::public.payment_status else status end,
    review_reason=case when refunded=amount_cents and not disputed then null else review_reason end,updated_at=now() where id=pay.id;
  if pay.order_id is not null then select customer_email,o.order_number into recipient,reference from public.orders o where id=pay.order_id;
  elsif pay.booking_id is not null then select email,b.reference into recipient,reference from public.bookings b where id=pay.booking_id;
  else select email,p.reference into recipient,reference from public.service_projects p where id=pay.project_id; end if;
  if recipient is not null then
    insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
      values('refund-'||p_refund,recipient,'Rimborso GENKS '||reference,'Rimborso registrato.',
        'È stato registrato un rimborso di '||to_char(p_amount/100.0,'FM999999990.00')||' '||pay.currency||' per '||reference||'. I tempi di accredito dipendono dal metodo di pagamento e dalla banca.') on conflict(dedupe_key) do nothing;
  end if;
  if refunded=pay.amount_cents then
    if pay.order_id is not null then
      update public.orders set status='refunded',refunded_at=coalesce(refunded_at,p_at) where id=pay.order_id;
      update public.entitlements set revoked_at=coalesce(revoked_at,now()),revocation_reason='refund' where order_item_id in(select id from public.order_items where order_id=pay.order_id);
    end if;
    if pay.booking_id is not null then update public.bookings set status='cancelled',updated_at=now() where id=pay.booking_id and status not in ('completed','no_show'); end if;
    if pay.project_id is not null then update public.service_projects set status='cancelled',updated_at=now() where id=pay.project_id and status<>'delivered'; end if;
    update public.notification_outbox set cancelled_at=now(),last_error='Superata dal rimborso integrale.' where dedupe_key='payment-'||pay.id and sent_at is null;
  end if;
end $$;

create or replace function public.record_stripe_dispute(p_payment text,p_blocked boolean) returns uuid language plpgsql set search_path='' as $$
declare pay public.payments;
begin
  select * into pay from public.payments where provider_payment_id=p_payment for update;
  if pay.id is null then return null; end if;
  update public.payments set disputed=p_blocked,
    review_reason=case when p_blocked then 'Contestazione Stripe: controlla e rispondi dalla dashboard Stripe.' when review_reason like 'Contestazione Stripe:%' then null else review_reason end where id=pay.id;
  if pay.order_id is not null then
    if p_blocked then
      update public.entitlements set revoked_at=now(),revocation_reason='dispute' where revoked_at is null and order_item_id in(select id from public.order_items where order_id=pay.order_id);
    elsif pay.refunded_cents<pay.amount_cents then
      update public.entitlements set revoked_at=null,revocation_reason=null where revocation_reason='dispute' and order_item_id in(select id from public.order_items where order_id=pay.order_id);
    end if;
  end if;
  return pay.id;
end $$;
revoke all on function public.record_stripe_dispute(text,boolean) from public,anon,authenticated;
grant execute on function public.record_stripe_dispute(text,boolean) to service_role;

create or replace function public.queue_service_status_notice() returns trigger language plpgsql set search_path='' as $$
declare label text;
begin
  if old.status=new.status or new.status::text in ('paid','confirmed','approved_awaiting_payment','awaiting_payment','delivered') then return new; end if;
  label:=case new.status::text when 'cancelled' then 'annullata' when 'rejected' then 'non accettata' when 'in_progress' then 'in lavorazione' when 'review' then 'in revisione' when 'completed' then 'completata' when 'no_show' then 'mancata presentazione' when 'pending' then 'in valutazione' when 'quoted' then 'preventivo in preparazione' else 'aggiornata' end;
  insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
    values('status-'||tg_table_name||'-'||new.id||'-'||new.status||'-'||extract(epoch from clock_timestamp()),new.email,'Aggiornamento GENKS '||new.reference,'La tua richiesta è stata aggiornata.',
      'Richiesta '||new.reference||': '||label||'. Per chiarimenti rispondi a questa email. Un eventuale rimborso viene comunicato separatamente dopo la registrazione in Stripe.');
  return new;
end $$;
create trigger booking_status_notice after update of status on public.bookings for each row execute function public.queue_service_status_notice();
create trigger project_status_notice after update of status on public.service_projects for each row execute function public.queue_service_status_notice();
revoke all on function public.queue_service_status_notice() from public,anon,authenticated;
grant execute on function public.queue_service_status_notice() to service_role;
commit;
