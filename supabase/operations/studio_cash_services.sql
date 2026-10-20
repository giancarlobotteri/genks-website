begin;
create table if not exists public.studio_cash_agreements (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid unique references public.bookings(id), project_id uuid unique references public.service_projects(id),
 amount_cents integer not null check(amount_cents between 50 and 10000000),
 details text not null check(length(trim(details)) between 10 and 2000),
 revision_count integer not null default 0 check(revision_count between 0 and 50), agreed_deadline date,
 agreed_at timestamptz not null default now(), agreed_by uuid not null references public.profiles(id),
 received_at timestamptz, received_by uuid references public.profiles(id),
 refunded_at timestamptz, refunded_by uuid references public.profiles(id),
 check(num_nonnulls(booking_id,project_id)=1),
 check(refunded_at is null or received_at is not null)
);
alter table public.studio_cash_agreements enable row level security;
revoke all on public.studio_cash_agreements from public,anon,authenticated;
grant all on public.studio_cash_agreements to service_role;

create or replace function public.manage_studio_cash_service(
 p_action text,p_type text,p_id uuid,p_admin uuid,p_amount integer default null,p_details text default null,
 p_revisions integer default 0,p_deadline date default null,p_url text default null
) returns uuid language plpgsql set search_path='' as $$
declare a public.studio_cash_agreements; b public.bookings; p public.service_projects; ref text; recipient text; old_status text; heading text; body text; aid uuid;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='admin') then raise exception 'Admin required'; end if;
 if p_type='booking' then
   select * into b from public.bookings where id=p_id for update;
   if not found then raise exception 'Booking missing'; end if;
   ref:=b.reference;recipient:=b.email;old_status:=b.status::text;
   select * into a from public.studio_cash_agreements where booking_id=p_id for update;
 elsif p_type='project' then
   select * into p from public.service_projects where id=p_id for update;
   if not found then raise exception 'Project missing'; end if;
   ref:=p.reference;recipient:=p.email;old_status:=p.status::text;
   select * into a from public.studio_cash_agreements where project_id=p_id for update;
 else raise exception 'Unknown type'; end if;
 if p_action='agree' then
   if a.id is not null then raise exception 'Agreement already recorded'; end if;
   if p_amount is null or p_amount not between 50 and 10000000 or length(trim(coalesce(p_details,''))) not between 10 and 2000 then raise exception 'Invalid agreement'; end if;
   if exists(select 1 from public.payments where (booking_id=p_id or project_id=p_id) and status in('succeeded','refunded'))
    or exists(select 1 from public.service_quotes where (booking_id=p_id or project_id=p_id) and status in('creating','open','paid')) then raise exception 'Online payment or quote exists'; end if;
   if p_type='booking' and (old_status<>'pending' or b.starts_at<=now() or b.hold_expires_at<=now()) then raise exception 'Booking no longer available'; end if;
   if p_type='project' and (old_status not in('requested','quoted') or p_deadline is null or p_deadline<current_date) then raise exception 'Project or deadline invalid'; end if;
   insert into public.studio_cash_agreements(booking_id,project_id,amount_cents,details,revision_count,agreed_deadline,agreed_by)
   values(case when p_type='booking' then p_id end,case when p_type='project' then p_id end,p_amount,trim(p_details),p_revisions,p_deadline,p_admin) returning id into aid;
   if p_type='booking' then
     update public.bookings set status='confirmed',hold_expires_at=null,updated_at=now() where id=p_id;
     insert into public.booking_status_history(booking_id,from_status,to_status) values(p_id,b.status,'confirmed');
   else
     update public.service_projects set status='in_progress',agreed_deadline=p_deadline,updated_at=now() where id=p_id;
     insert into public.project_status_history(project_id,from_status,to_status) values(p_id,p.status,'in_progress');
     update public.notification_outbox set cancelled_at=now() where dedupe_key like 'status-service_projects-'||p_id||'-%' and created_at>=transaction_timestamp() and sent_at is null;
   end if;
   heading:=case when p_type='booking' then 'La tua sessione è confermata.' else 'Il tuo progetto è concordato.' end;
   body:='Riferimento: '||ref||E'\nImporto concordato: '||to_char(p_amount/100.0,'FM9999990.00')||E' EUR\nAttività e condizioni concordate: '||trim(p_details)||E'\nPagamento in contanti presso lo studio. Nessun pagamento è stato registrato con questa conferma.';
   if p_type='booking' then body:=body||E'\nAppuntamento: '||to_char(b.starts_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')||' – '||to_char(b.ends_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')||' (ora italiana).';
   else body:=body||E'\nRevisioni incluse: '||p_revisions||E'\nConsegna concordata: '||p_deadline; end if;
 elsif p_action='receive' then
   if p_amount is distinct from a.amount_cents then raise exception 'Cash total changed'; end if;
   if a.id is null or a.refunded_at is not null or old_status in('cancelled','rejected','no_show') then raise exception 'Agreement not collectable'; end if;
   if a.received_at is not null then return a.id; end if;
   update public.studio_cash_agreements set received_at=now(),received_by=p_admin where id=a.id;
   aid:=a.id;heading:='Pagamento in studio registrato.';
   body:='GENKS ha registrato il pagamento in contanti di '||to_char(a.amount_cents/100.0,'FM9999990.00')||' EUR per '||ref||'. Questo messaggio operativo non sostituisce il documento fiscale previsto.';
 elsif p_action='refund' then
   if a.id is null or a.received_at is null then raise exception 'No cash receipt'; end if;
   if a.refunded_at is not null then return a.id; end if;
   update public.studio_cash_agreements set refunded_at=now(),refunded_by=p_admin where id=a.id;
   if p_type='booking' then update public.bookings set status='cancelled',updated_at=now() where id=p_id;
   else update public.service_projects set status='cancelled',updated_at=now() where id=p_id; end if;
   aid:=a.id;heading:='Rimborso in studio registrato.';
   body:='GENKS ha registrato la restituzione in contanti di '||to_char(a.amount_cents/100.0,'FM9999990.00')||' EUR per '||ref||'. Questa registrazione non esegue trasferimenti di denaro.';
 elsif p_action='deliver' then
   if p_type<>'project' or a.id is null or a.received_at is null or a.refunded_at is not null or p_url is null or p_url !~ '^https://' or length(p_url)>2048 then raise exception 'Delivery not authorized'; end if;
   if p.status='delivered' and p.delivery_url=p_url then return a.id; end if;
   if p.status<>'review' then raise exception 'Review required'; end if;
   update public.service_projects set status='delivered',delivery_url=p_url,updated_at=now() where id=p_id;
   aid:=a.id;heading:='Il tuo lavoro è pronto.';body:='Riferimento: '||ref||E'\nApri il collegamento riservato concordato per scaricare i file finali: '||p_url;
 else raise exception 'Unknown action'; end if;
 insert into public.admin_audit_log(admin_id,action,entity_type,entity_id,payload) values(p_admin,'cash_'||p_action,p_type,p_id,jsonb_build_object('agreement_id',aid));
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
 values('cash-'||p_action||'-'||aid,recipient,'GENKS · '||ref,heading,body) on conflict(dedupe_key) do nothing;
 return aid;
end $$;
revoke all on function public.manage_studio_cash_service(text,text,uuid,uuid,integer,text,integer,date,text) from public,anon,authenticated;
grant execute on function public.manage_studio_cash_service(text,text,uuid,uuid,integer,text,integer,date,text) to service_role;
-- Status emails must remain correct for both cash and historical card payments.
create or replace function public.queue_service_status_notice() returns trigger language plpgsql set search_path='' as $$
declare label text;
begin
 if old.status=new.status or new.status::text in ('paid','confirmed','approved_awaiting_payment','awaiting_payment','delivered') then return new; end if;
 label:=case new.status::text when 'cancelled' then 'annullata' when 'rejected' then 'non accettata' when 'in_progress' then 'in lavorazione' when 'review' then 'in revisione' when 'completed' then 'completata' when 'no_show' then 'mancata presentazione' when 'pending' then 'in valutazione' when 'quoted' then 'preventivo in definizione' else 'aggiornata' end;
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
 values('status-'||tg_table_name||'-'||new.id||'-'||new.status||'-'||extract(epoch from clock_timestamp()),new.email,'Aggiornamento GENKS '||new.reference,'La tua richiesta è stata aggiornata.',
 'Richiesta '||new.reference||': '||label||'. Per chiarimenti rispondi a questa email. Un eventuale rimborso viene gestito e comunicato separatamente.');
 return new;
end $$;
commit;
