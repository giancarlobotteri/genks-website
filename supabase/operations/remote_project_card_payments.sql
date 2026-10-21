begin;
alter table public.service_quotes add column if not exists fixed_price boolean not null default false;
alter table public.service_quotes alter column revision_count drop not null;
alter table public.service_quotes add constraint service_quote_revision_scope check (revision_count is not null or fixed_price);
create or replace function public.reserve_remote_project(p_data jsonb,p_owner_email text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.service_projects; q public.service_quotes; amount integer; scope text; recipient text;
begin
 if p_data->>'rateVersion' is distinct from '2026-10-20-v2' or p_data->>'accepted' is distinct from 'on' then raise exception 'price_changed'; end if;
 if p_data->>'mode' is distinct from 'remote' then raise exception 'remote_only'; end if;
 amount:=case p_data->>'service' when 'mix' then 10000 when 'master' then 4000 when 'mix_master' then 12000 end;
 recipient:=lower(trim(p_data->>'email'));
 if amount is null or length(trim(coalesce(p_data->>'name',''))) not between 2 and 120
  or recipient is null or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or p_owner_email is null or p_owner_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or length(trim(coalesce(p_data->>'trackTitle',''))) not between 1 and 160
  or length(trim(coalesce(p_data->>'description',''))) not between 10 and 4000
  or (p_data->>'trackCount') is null or (p_data->>'trackCount')::integer not between 1 and 200 then raise exception 'invalid_request'; end if;
 insert into public.service_projects(customer_id,name,artist_name,email,phone,track_title,service,description,track_count,reference_links,desired_deadline,notes,status,price_cents)
 values(nullif(p_data->>'customerId','')::uuid,trim(p_data->>'name'),nullif(p_data->>'artistName',''),recipient,nullif(p_data->>'phone',''),p_data->>'trackTitle',p_data->>'service',p_data->>'description',(p_data->>'trackCount')::integer,array(select jsonb_array_elements_text(coalesce(p_data->'links','[]'::jsonb))),nullif(p_data->>'desiredDeadline','')::date,concat(E'Modalità: remote\nPagamento: carta online\n',p_data->>'notes'),'awaiting_payment',amount)
 returning * into p;
 scope:=replace(p.service,'_',' + ')||' · 1 brano: '||p.track_title||'. A distanza. Invio file, consegna e revisioni da concordare prima dell’avvio. La data desiderata non è una promessa di consegna.';
 insert into public.service_quotes(project_id,amount_cents,scope,revision_count,agreed_deadline,expires_at,fixed_price)
 values(p.id,amount,scope,null,null,now()+interval '2 hours',true) returning * into q;
 -- An unpaid checkout must never send a cash agreement or a confirmation of payment.
 update public.notification_outbox set cancelled_at=now() where dedupe_key='request-'||p.reference||'-customer' and sent_at is null;
 return to_jsonb(q);
end $$;
revoke all on function public.reserve_remote_project(jsonb,text) from public,anon,authenticated;
grant execute on function public.reserve_remote_project(jsonb,text) to service_role;
commit;
