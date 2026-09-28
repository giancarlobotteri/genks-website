-- Reserve a code atomically at checkout; stale unpaid reservations expire after two hours.
create or replace function public.apply_promo_to_order(p_order_id uuid, p_code text)
returns table(discount_cents integer, total_cents integer)
language plpgsql security definer set search_path = ''
as $$
declare
  p public.promo_codes%rowtype;
  o public.orders%rowtype;
  eligible_total integer;
  used_count integer;
  discount integer;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.status <> 'pending' or o.stripe_checkout_session_id is not null then
    raise exception 'Order is not eligible for a promotion';
  end if;
  select * into p from public.promo_codes where code = upper(trim(p_code)) for update;
  if not found or not p.active or (p.expires_at is not null and p.expires_at <= now()) then
    raise exception 'Promotion is unavailable';
  end if;
  if o.currency <> 'EUR' or o.subtotal_cents < coalesce(p.minimum_order_cents, 0) then
    raise exception 'Promotion does not apply to this order';
  end if;
  select count(*) into used_count from public.promo_redemptions r
    join public.orders ro on ro.id = r.order_id
    where r.promo_code_id = p.id
      and (ro.status = 'paid' or (ro.status = 'pending' and ro.created_at > now() - interval '2 hours'));
  if p.usage_limit is not null and used_count >= p.usage_limit then
    raise exception 'Promotion usage limit reached';
  end if;
  select coalesce(sum(i.unit_price_cents), 0) into eligible_total from public.order_items i
    where i.order_id = o.id and (cardinality(p.eligible_license_ids) = 0 or i.license_type_id = any(p.eligible_license_ids));
  if eligible_total < 50 then raise exception 'No eligible licenses'; end if;
  discount := least(eligible_total - 50, case when p.discount_type = 'percent'
    then floor(eligible_total * p.amount / 100.0)::integer else p.amount end);
  if discount <= 0 then raise exception 'Promotion has no applicable discount'; end if;
  update public.orders set discount_cents = discount, total_cents = o.subtotal_cents - discount where id = o.id;
  insert into public.promo_redemptions(promo_code_id,order_id,customer_id) values (p.id,o.id,o.customer_id);
  return query select discount, o.subtotal_cents - discount;
end;
$$;
revoke all on function public.apply_promo_to_order(uuid,text) from public, anon, authenticated;
grant execute on function public.apply_promo_to_order(uuid,text) to service_role;
