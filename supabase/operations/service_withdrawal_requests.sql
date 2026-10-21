begin;
create table public.withdrawal_requests(id uuid primary key default gen_random_uuid(), reference text not null, name text not null, email text not null, statement text not null, received_at timestamptz not null default now(), status text not null default 'received' check(status in('received','reviewed','resolved')));
alter table public.withdrawal_requests enable row level security;
revoke all on public.withdrawal_requests from public,anon,authenticated;
grant select,insert,update on public.withdrawal_requests to service_role;
create function public.submit_withdrawal(p_reference text,p_name text,p_email text,p_statement text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare rid uuid; stamp timestamptz:=clock_timestamp(); copy text;
begin
 if length(trim(p_name)) not between 2 and 120 or length(p_reference) not between 3 and 100 or length(p_statement) not between 10 and 4000 or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_request'; end if;
 insert into public.withdrawal_requests(reference,name,email,statement,received_at) values(p_reference,p_name,lower(p_email),p_statement,stamp) returning id into rid;
 copy:='Dichiarazione ricevuta il '||to_char(stamp at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI:SS')||' (Europe/Rome).'||E'\nNome: '||p_name||E'\nRiferimento dichiarato: '||p_reference||E'\nDichiarazione: '||p_statement||E'\nLa comunicazione è stata trasmessa: non occorre un’approvazione per esercitare il diritto. GENKS verifica identità, contratto e importi eventualmente dovuti. Questa ricevuta non conferma un rimborso già eseguito.';
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
 values('withdrawal-'||rid||'-customer',lower(p_email),'GENKS · Ricevuta dichiarazione di recesso','La tua dichiarazione è stata ricevuta.',copy),
 ('withdrawal-'||rid||'-admin','prod.genks@gmail.com','GENKS · Dichiarazione di recesso da gestire','Nuova dichiarazione di recesso.',copy||E'\nEmail del dichiarante: '||lower(p_email));
 return rid;
end $$;
revoke all on function public.submit_withdrawal(text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_withdrawal(text,text,text,text) to service_role;
commit;