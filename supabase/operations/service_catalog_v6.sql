-- REVIEW ONLY. Not applied. Run inside one transaction after backup and staging tests.
begin;
alter table public.service_projects add column if not exists commerce_snapshot jsonb;
alter table public.service_quotes add column if not exists commerce_snapshot jsonb;
alter table public.project_contracts add column if not exists first_version_hours integer;
-- A separate server-only entry point keeps previous contract snapshots intact.
create or replace function public.reserve_project_checkout_v6(p_data jsonb,p_quote jsonb,p_summary text,p_terms text,p_terms_version text,p_owner_email text)
returns jsonb language plpgsql set search_path='' as $function$
declare first_song jsonb; legacy jsonb; result jsonb; pid uuid; ref text; total integer; line_total bigint; song_total integer; count_songs integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server_only'; end if;
 if p_data->>'rateVersion' is distinct from '2026-10-22-project-v6' or p_quote->>'version' is distinct from '2026-10-22-project-v6'
 or p_data->>'accepted' is distinct from 'on' or p_data->>'payment' is distinct from 'card' then raise exception 'invalid_checkout'; end if;
 if jsonb_typeof(p_quote->'songs') is distinct from 'array' or jsonb_typeof(p_quote->'lines') is distinct from 'array' then raise exception 'invalid_snapshot'; end if;
 count_songs:=jsonb_array_length(p_quote->'songs');
 if count_songs not between 1 and 20 or jsonb_array_length(p_quote->'lines') not between 1 and 100 then raise exception 'invalid_items'; end if;
 total:=(p_quote->>'totalCents')::integer;
 if exists(select 1 from jsonb_array_elements(p_quote->'lines') l where (l->>'quantity')::integer not between 1 and 48 or (l->>'unitAmount')::integer<0) then raise exception 'invalid_line'; end if;
 select sum((l->>'quantity')::integer*(l->>'unitAmount')::integer) into line_total from jsonb_array_elements(p_quote->'lines') l;
 select sum((s->>'amountCents')::integer) into song_total from jsonb_array_elements(p_quote->'songs') s;
 if total<50 or total<>line_total or total<>song_total+(case when (p_quote->>'rush')::boolean then 3000 else 0 end)
 or total is distinct from (p_data->>'expectedTotal')::integer then raise exception 'quote_total_mismatch'; end if;
 if length(p_terms)<100 or p_terms_version is distinct from '2026-10-22-v6' then raise exception 'missing_terms'; end if;
 -- Amounts in p_quote are produced by the server configuration, never by browser input.
 -- Reuse the existing validated reservation/contract mechanism within this transaction.
 first_song:=p_quote->'songs'->0;
 legacy:=(p_data-'serverQuote'-'songs')||first_song||jsonb_build_object('rateVersion','2026-10-21-v3','expectedTotal',public.project_price_v3(first_song->>'service',(first_song->>'trackCount')::integer));
 result:=public.reserve_remote_project(legacy,p_owner_email);pid:=(result->>'project_id')::uuid;
 select reference into strict ref from public.service_projects where id=pid;
 update public.service_projects set songs=p_quote->'songs',commerce_snapshot=p_quote,price_cents=total,
 track_count=(select sum((s->>'trackCount')::integer) from jsonb_array_elements(p_quote->'songs') s),
 track_title=case when count_songs=1 then first_song->>'trackTitle' else count_songs||' brani · '||left(first_song->>'trackTitle',130) end where id=pid;
 update public.project_contracts set amount_cents=total,terms_version=p_terms_version,terms_body=p_terms||chr(10)||chr(10)||'RIEPILOGO ACCETTATO'||chr(10)||p_summary,
 track_count=(select track_count from public.service_projects where id=pid),first_version_hours=case when (p_quote->>'rush')::boolean then 48 end where project_id=pid;
 update public.notification_outbox set body='Riferimento: '||ref||chr(10)||p_summary||chr(10)||p_terms where dedupe_key='contract-'||pid and sent_at is null;
 update public.service_quotes set amount_cents=total,scope=p_summary,commerce_snapshot=p_quote where id=(result->>'id')::uuid returning to_jsonb(service_quotes) into result;
 return result||jsonb_build_object('reference',ref,'songs',p_quote->'songs');
end; $function$;
revoke all on function public.reserve_project_checkout_v6(jsonb,jsonb,text,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_project_checkout_v6(jsonb,jsonb,text,text,text,text) to service_role;
-- New recording bookings use 24.99/h; saved agreements and old quotes are never repriced.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.reserve_cash_service(text,jsonb,text)'::regprocedure);
 if position('2026-10-22-recording-v4' in definition)=0 then raise exception 'unexpected_recording_function_version'; end if;
 definition:=replace(definition,'FUNCTION public.reserve_cash_service(', 'FUNCTION public.reserve_cash_service_v5(');
 definition:=replace(definition,'2026-10-22-recording-v4','2026-10-22-recording-v5');
 definition:=replace(definition,'1999','2499');
 definition:=replace(definition,'select id,base_price_cents into sid,rate','select id,2499 into sid,rate');
 definition:=replace(definition,'19,99','24,99');
 execute definition;
 -- The published list price is switched only after the new deployment is ready.
end; $migration$;
revoke all on function public.reserve_cash_service_v5(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.reserve_cash_service_v5(text,jsonb,text) to service_role;
-- Preserve historical overtime rates; v5 uses the new base hourly price.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.set_booking_extra_time_v2(uuid,uuid,integer,integer,integer,integer)'::regprocedure);
 if position('2026-10-22-recording-v4' in definition)=0 then raise exception 'unexpected_extra_time_function_version'; end if;
 definition:=replace(definition, $$a.rate_version is distinct from '2026-10-22-recording-v4'$$, $$a.rate_version not in ('2026-10-22-recording-v4','2026-10-22-recording-v5')$$);
 definition:=replace(definition,'p_minutes*1999::numeric/60', $$p_minutes*(case when a.rate_version='2026-10-22-recording-v5' then 2499 else 1999 end)::numeric/60$$);
 definition:=replace(definition, $$a 19,99 EUR/ora$$, $$alla tariffa base salvata nel contratto$$);
 definition:=replace(definition, $$tariffa base 19,99 EUR/ora$$, $$tariffa base salvata nel contratto$$);
 execute definition;
end; $migration$;
commit;
