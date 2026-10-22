insert into public.site_settings(key,value) values('public_discounts','{"rules":[]}'::jsonb) on conflict(key) do nothing;
create or replace function public.genks_discount_price(base integer,targets text[]) returns integer language plpgsql stable set search_path='' as $f$
declare rule jsonb; amount integer;
begin
 select r into rule from public.site_settings s,lateral jsonb_array_elements(coalesce(s.value->'rules','[]'::jsonb)) r
 where s.key='public_discounts' and r->>'active'='true' and (r->>'target'='all' or r->>'target'=any(targets))
 order by case when r->>'target'='all' then 999 else array_position(targets,r->>'target') end limit 1;
 if rule is null or base<=0 then return base; end if;
 amount:=(rule->>'amount')::integer;
 return greatest(50,least(base,case when rule->>'kind'='percent' then round(base*(100-amount)/100.0)::integer else base-amount end));
end $f$;
revoke all on function public.genks_discount_price(integer,text[]) from public,anon,authenticated;
grant execute on function public.genks_discount_price(integer,text[]) to service_role;

create or replace function public.set_public_discount(p_target text,p_kind text,p_amount integer,p_label text,p_active boolean) returns void language plpgsql set search_path='' as $f$
declare rules jsonb;
begin
 if p_target is null or not (p_target in('all','services','projects','beats','recording','mix','master','mix_master','*') or p_target ~ '^beat:[a-f0-9-]{36}$' or p_target ~ '^license:[a-z0-9_-]{1,50}$')
  or p_kind is null or p_kind not in('percent','fixed') or p_amount is null or p_amount<1 or p_amount>1000000
  or (p_kind='percent' and p_amount>99) or length(trim(coalesce(p_label,''))) not between 1 and 80 or p_active is null then raise exception 'invalid_public_discount'; end if;
 perform pg_advisory_xact_lock(hashtextextended('genks-public-discounts',0));
 select coalesce(value->'rules','[]'::jsonb) into rules from public.site_settings where key='public_discounts' for update;
 if p_target='all' and p_active then
  select coalesce(jsonb_agg(r||'{"active":false}'::jsonb),'[]'::jsonb) into rules from jsonb_array_elements(rules) r;
 end if;
 if p_target='*' then
  select coalesce(jsonb_agg(r||'{"active":false}'::jsonb),'[]'::jsonb) into rules from jsonb_array_elements(rules) r;
 else
  select coalesce(jsonb_agg(r),'[]'::jsonb) into rules from jsonb_array_elements(rules) r where r->>'target'<>p_target;
  rules:=rules||jsonb_build_array(jsonb_build_object('target',p_target,'label',trim(p_label),'kind',p_kind,'amount',p_amount,'active',p_active));
 end if;
 update public.site_settings set value=jsonb_build_object('rules',rules),updated_at=now() where key='public_discounts';
end $f$;
revoke all on function public.set_public_discount(text,text,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.set_public_discount(text,text,integer,text,boolean) to service_role;
