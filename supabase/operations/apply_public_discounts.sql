CREATE OR REPLACE FUNCTION public.genks_project_list_price(service text, tracks integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
begin
 if tracks is null or tracks<1 then raise exception 'invalid_track_count'; end if;
 if service='master' and tracks=1 then return 3999; end if;
 if service is null or service not in('mix','mix_master') or tracks>48 then raise exception 'quote_required'; end if;
 return case when service='mix' then case when tracks<=8 then 8999 when tracks<=24 then 13999 else 19999 end
 else case when tracks<=8 then 11999 when tracks<=24 then 17999 else 23999 end end;
end $function$
;
revoke all on function public.genks_project_list_price(text,integer) from public,anon,authenticated;
grant execute on function public.genks_project_list_price(text,integer) to service_role;
create or replace function public.project_price_v3(service text, tracks integer) returns integer language sql stable set search_path='' as $f$ select public.genks_discount_price(public.genks_project_list_price(service,tracks),array[service,'projects','services']); $f$;
CREATE OR REPLACE FUNCTION public.reserve_cash_service(p_type text, p_data jsonb, p_owner_email text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare b public.bookings; p public.service_projects; aid uuid; sid uuid; rate integer;
 hours numeric; amount integer; details text; ref text; recipient text; target uuid;
 start_at timestamptz; end_at timestamptz; mode text; service text; person text;
begin
 if p_data->>'rateVersion' is distinct from (case when p_type='booking' then '2026-10-20-v2' else '2026-10-21-v3' end) or p_data->>'accepted' is distinct from 'on' then raise exception 'price_changed'; end if;
 recipient:=lower(trim(p_data->>'email')); person:=trim(p_data->>'name');
 if length(person) not between 2 and 120 or recipient is null or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or p_owner_email is null or p_owner_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_request'; end if;
 if p_type='booking' then
  hours:=(p_data->>'duration')::numeric;
  if hours is null or hours<0.25 or hours>8 or mod(hours*60,15)<>0 then raise exception 'invalid_duration'; end if;
  select id,base_price_cents into sid,rate from public.booking_services where code='recording' and active for share;
  if sid is null or rate<>2000 then raise exception 'price_changed'; end if;
  rate:=public.genks_discount_price(rate,array['recording','services']); amount:=greatest(50,round(rate*hours)::integer); if (p_data ? 'expectedTotal' and (p_data->>'expectedTotal')::integer<>amount) or (not p_data ? 'expectedTotal' and rate<>2000) then raise exception 'price_changed'; end if; start_at:=(p_data->>'startsAt')::timestamptz; end_at:=start_at+make_interval(mins=>(hours*60)::integer);
  if start_at is null or start_at<=now() or start_at>now()+interval '1 year' or length(trim(coalesce(p_data->>'phone',''))) not between 6 and 40 then raise exception 'invalid_request'; end if;
  perform public.expire_booking_holds();
  insert into public.bookings(reference,customer_id,service_id,name,artist_name,email,phone,starts_at,ends_at,notes,reference_url,status,price_cents,deposit_cents,hold_expires_at)
  values('BKG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),nullif(p_data->>'customerId','')::uuid,sid,person,nullif(p_data->>'artistName',''),recipient,p_data->>'phone',start_at,end_at,nullif(p_data->>'notes',''),nullif(p_data->>'referenceUrl',''),'confirmed',amount,0,null)
  returning * into b;
  ref:=b.reference;target:=b.id;mode:='studio';
  details:='Registrazione in studio · '||hours||' ore × '||to_char(rate/100.0,'FM999990.00')||' EUR/ora. Totale '||to_char(amount/100.0,'FM999990.00')||' EUR. Pagamento in contanti presso lo studio. Appuntamento: '||to_char(start_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')||' – '||to_char(end_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')||' (ora italiana).';
 else
  if p_type<>'project' then raise exception 'invalid_type'; end if;
  service:=p_data->>'service';mode:=p_data->>'mode';
  amount:=public.project_price_v3(service,(p_data->>'trackCount')::integer);
 if (p_data ? 'expectedTotal' and (p_data->>'expectedTotal')::integer<>amount) or (not p_data ? 'expectedTotal' and amount<>public.genks_project_list_price(p_data->>'service',(p_data->>'trackCount')::integer)) then raise exception 'price_changed'; end if;

  if amount is null or mode is null or mode not in('studio','remote') or length(trim(coalesce(p_data->>'trackTitle',''))) not between 1 and 160
   or length(trim(coalesce(p_data->>'description',''))) not between 10 and 4000 or (p_data->>'trackCount')::integer not between 1 and 200 then raise exception 'invalid_request'; end if;
  insert into public.service_projects(customer_id,name,artist_name,email,phone,track_title,service,description,track_count,reference_links,desired_deadline,notes,status,price_cents)
  values(nullif(p_data->>'customerId','')::uuid,person,nullif(p_data->>'artistName',''),recipient,nullif(p_data->>'phone',''),p_data->>'trackTitle',service,p_data->>'description',(p_data->>'trackCount')::integer,array(select jsonb_array_elements_text(coalesce(p_data->'links','[]'::jsonb))),nullif(p_data->>'desiredDeadline','')::date,concat('Modalità: ',mode,E'\n',p_data->>'notes'),'in_progress',amount)
  returning * into p;
  perform public.snapshot_project_contract_v3(p.id,p_data);
  ref:=p.reference;target:=p.id;
  details:=replace(service,'_',' + ')||' · 1 brano: '||(p_data->>'trackTitle');
  details:=details||'. Totale '||to_char(amount/100.0,'FM999990.00')||' EUR. Modalità: '||case mode when 'remote' then 'a distanza' else 'in studio' end||'. Prenotazione confermata; prima versione entro 7 giorni lavorativi dal giorno successivo a pagamento, file completi e avvio consentito; 2 revisioni incluse. Senza richiesta espressa di avvio anticipato si attendono i 14 giorni del recesso. Pagamento in contanti presso lo studio, anche per il lavoro a distanza. Nessuna data di consegna è confermata con questa prenotazione.';
 end if;
 insert into public.studio_cash_agreements(booking_id,project_id,amount_cents,details,revision_count,customer_accepted_at,rate_version,fulfillment_mode)
 values(case when p_type='booking' then target end,case when p_type='project' then target end,amount,details,case when p_type='booking' then 0 else 2 end,now(),p_data->>'rateVersion',mode) returning id into aid;
 -- The legacy request receipt is created by an insert trigger: replace it before any worker can see it.
 update public.notification_outbox set cancelled_at=now() where dedupe_key='request-'||ref||'-customer' and sent_at is null;
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
 values('cash-agree-'||aid,recipient,'GENKS · Prenotazione confermata · '||ref,'La tua prenotazione è confermata.',details||E'\nRiferimento: '||ref||E'\nNessun pagamento è stato ancora registrato. Per cambi o cancellazioni rispondi a questa email.'),
 ('reservation-'||ref||'-admin',p_owner_email,'GENKS · Nuova prenotazione · '||ref,'Nuova prenotazione confermata.',person||E'\n'||details||E'\nEmail cliente: '||recipient||E'\nTelefono: '||coalesce(p_data->>'phone','')||E'\nRiferimento: '||ref||E'\nNon serve approvare la prenotazione. Registra il pagamento soltanto dopo aver ricevuto i contanti.');
 return ref;
end $function$
;
CREATE OR REPLACE FUNCTION public.reserve_remote_project(p_data jsonb, p_owner_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.service_projects; q public.service_quotes; amount integer; scope text; recipient text;
begin
 if p_data->>'rateVersion' is distinct from '2026-10-21-v3' or p_data->>'accepted' is distinct from 'on' then raise exception 'price_changed'; end if;
 if p_data->>'mode' is null or p_data->>'mode' not in ('remote','studio') then raise exception 'invalid_mode'; end if;
 amount:=public.project_price_v3(p_data->>'service',(p_data->>'trackCount')::integer);
 if (p_data ? 'expectedTotal' and (p_data->>'expectedTotal')::integer<>amount) or (not p_data ? 'expectedTotal' and amount<>public.genks_project_list_price(p_data->>'service',(p_data->>'trackCount')::integer)) then raise exception 'price_changed'; end if;

 recipient:=lower(trim(p_data->>'email'));
 if amount is null or length(trim(coalesce(p_data->>'name',''))) not between 2 and 120
  or recipient is null or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or p_owner_email is null or p_owner_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or length(trim(coalesce(p_data->>'trackTitle',''))) not between 1 and 160
  or length(trim(coalesce(p_data->>'description',''))) not between 10 and 4000
  or (p_data->>'trackCount') is null or (p_data->>'trackCount')::integer not between 1 and 200 then raise exception 'invalid_request'; end if;
 insert into public.service_projects(customer_id,name,artist_name,email,phone,track_title,service,description,track_count,reference_links,desired_deadline,notes,status,price_cents)
 values(nullif(p_data->>'customerId','')::uuid,trim(p_data->>'name'),nullif(p_data->>'artistName',''),recipient,nullif(p_data->>'phone',''),p_data->>'trackTitle',p_data->>'service',p_data->>'description',(p_data->>'trackCount')::integer,array(select jsonb_array_elements_text(coalesce(p_data->'links','[]'::jsonb))),nullif(p_data->>'desiredDeadline','')::date,concat('Modalità: ',p_data->>'mode',chr(10),'Pagamento: carta online',chr(10),p_data->>'notes'),'awaiting_payment',amount)
 returning * into p;
 perform public.snapshot_project_contract_v3(p.id,p_data);
 scope:=replace(p.service,'_',' + ')||' · 1 brano: '||p.track_title||'. '||case when p_data->>'mode'='studio' then 'Fisicamente in studio. Incontro da organizzare; nessuno slot di registrazione prenotato.' else 'A distanza.' end||' Prima versione entro 7 giorni lavorativi dal giorno successivo a pagamento, file completi e avvio consentito; 2 revisioni incluse. Senza richiesta espressa di avvio anticipato si attendono i 14 giorni del recesso. La data desiderata non è una promessa di consegna.';
 insert into public.service_quotes(project_id,amount_cents,scope,revision_count,agreed_deadline,expires_at,fixed_price)
 values(p.id,amount,scope,2,null,now()+interval '2 hours',true) returning * into q;
 -- An unpaid checkout must never send a cash agreement or a confirmation of payment.
 update public.notification_outbox set cancelled_at=now() where dedupe_key='request-'||p.reference||'-customer' and sent_at is null;
 return to_jsonb(q);
end $function$
;
CREATE OR REPLACE FUNCTION public.reserve_project_batch(p_data jsonb, p_payment text, p_owner_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare song jsonb; normalized jsonb:='[]'::jsonb; first_song jsonb; payload jsonb; quote jsonb; pid uuid; ref text;
 amount integer; total integer:=0; tracks integer:=0; n integer; summary text:=''; batch_details text; i integer:=0;
begin
 if jsonb_typeof(p_data->'songs') is distinct from 'array' then raise exception 'invalid_songs'; end if;
 n:=jsonb_array_length(p_data->'songs');
 if n<1 or n>20 or p_payment is null or p_payment not in('card','cash')
  or p_data->>'mode' is null or p_data->>'mode' not in('studio','remote')
  or (p_payment='cash' and p_data->>'mode'<>'studio') then raise exception 'invalid_batch'; end if;
 for song in select value from jsonb_array_elements(p_data->'songs') loop
  if jsonb_typeof(song) is distinct from 'object' or jsonb_typeof(song->'trackCount') is distinct from 'number'
   or jsonb_typeof(song->'trackTitle') is distinct from 'string' or jsonb_typeof(song->'description') is distinct from 'string'
   or jsonb_typeof(song->'referenceLinks') is distinct from 'string' or jsonb_typeof(song->'notes') is distinct from 'string'
   or jsonb_typeof(song->'desiredDeadline') is distinct from 'string'
   or length(trim(song->>'trackTitle')) not between 1 and 160 or length(trim(song->>'description')) not between 10 and 4000
   or length(song->>'referenceLinks')>2000 or length(song->>'notes')>2000 then raise exception 'invalid_song'; end if;
  if nullif(song->>'desiredDeadline','') is not null then perform (song->>'desiredDeadline')::date; end if;
  amount:=public.project_price_v3(p_data->>'service',(song->>'trackCount')::integer);
  if amount is null then raise exception 'invalid_song_price'; end if;
  song:=jsonb_build_object('trackTitle',trim(song->>'trackTitle'),'trackCount',(song->>'trackCount')::integer,
   'description',trim(song->>'description'),'referenceLinks',song->>'referenceLinks','notes',song->>'notes',
   'desiredDeadline',song->>'desiredDeadline','amountCents',amount);
  normalized:=normalized||jsonb_build_array(song);total:=total+amount;tracks:=tracks+(song->>'trackCount')::integer;i:=i+1;
  summary:=summary||'Brano '||i||': '||left(song->>'trackTitle',35)||' · '||(song->>'trackCount')||' tracce · '||to_char(amount/100.0,'FM999990.00')||' EUR'||chr(10);
 end loop;
 if (p_data ? 'expectedTotal' and (p_data->>'expectedTotal')::integer<>total) or (not p_data ? 'expectedTotal' and total<>(select sum(public.genks_project_list_price(p_data->>'service',(x->>'trackCount')::integer)) from jsonb_array_elements(normalized) x)) then raise exception 'price_changed'; end if;
 first_song:=normalized->0;
 payload:=(p_data-'songs')||first_song||jsonb_build_object('expectedTotal',(first_song->>'amountCents')::integer,'links',coalesce((select jsonb_agg(link) from regexp_split_to_table(first_song->>'referenceLinks','[[:space:]]+') link where link ~ '^https?://'),'[]'::jsonb));
 if p_payment='card' then
  quote:=public.reserve_remote_project(payload,p_owner_email);pid:=(quote->>'project_id')::uuid;
  select reference into strict ref from public.service_projects where id=pid;
 else
  ref:=public.reserve_cash_service('project',payload,p_owner_email);
  select id into strict pid from public.service_projects where reference=ref;
 end if;
 batch_details:=n||case when n=1 then ' brano' else ' brani' end||' · '||replace(p_data->>'service','_',' + ')||chr(10)||summary
  ||'Totale: '||to_char(total/100.0,'FM999990.00')||' EUR'||chr(10)
  ||'Modalità: '||case p_data->>'mode' when 'studio' then 'fisicamente in studio; incontro da organizzare' else 'a distanza' end||chr(10)
  ||'Pagamento: '||case p_payment when 'card' then 'carta online; conferma dopo verifica Stripe' else 'contanti presso lo studio; nessun incasso ancora registrato' end||chr(10)
  ||'Due revisioni per ciascun brano. Prima versione entro 7 giorni lavorativi dall’avvio consentito, dopo pagamento e file completi. Scadenze desiderate da concordare.';
 update public.service_projects set songs=normalized,price_cents=total,track_count=tracks,
  track_title=case when n=1 then first_song->>'trackTitle' else n||' brani · '||left(first_song->>'trackTitle',130) end,
  description=case when n=1 then first_song->>'description' else 'Richiesta con '||n||' brani. Consulta le schede dei singoli brani per descrizioni, note e riferimenti.' end,
  desired_deadline=(select min(nullif(x->>'desiredDeadline','')::date) from jsonb_array_elements(normalized) x)
 where id=pid;
 update public.project_contracts set amount_cents=total,track_count=tracks,terms_version='2026-10-22-v5',
  terms_body=replace(replace(replace(terms_body,'Versione 21 ottobre 2026.','Versione 22 ottobre 2026.'),'Queste condizioni riguardano un brano per ordine di mix, master stereo o mix + master.',
   'Ogni richiesta può includere uno o più brani di mix, master stereo o mix + master, elencati nel riepilogo. Il prezzo è calcolato per ciascun brano e sommato nel totale.'),
   'Sono incluse 2 revisioni:','Sono incluse 2 revisioni per ciascun brano:')||chr(10)||chr(10)||'BRANI E IMPORTI DELLA RICHIESTA'||chr(10)||batch_details where project_id=pid;
 update public.notification_outbox set body='Riferimento: '||ref||chr(10)||'Le condizioni accettate non sono una ricevuta di pagamento.'||chr(10)||
  (select terms_body from public.project_contracts where project_id=pid) where dedupe_key='contract-'||pid and sent_at is null;
 if p_payment='card' then
  update public.service_quotes set amount_cents=total,scope=batch_details where id=(quote->>'id')::uuid returning to_jsonb(service_quotes) into quote;
  return quote||jsonb_build_object('songs',normalized,'reference',ref);
 else
  update public.studio_cash_agreements set amount_cents=total,base_amount_cents=total,details=batch_details where project_id=pid;
  update public.notification_outbox set body=batch_details||chr(10)||'Riferimento: '||ref where dedupe_key like 'cash-agree-%' and dedupe_key in(select 'cash-agree-'||id from public.studio_cash_agreements where project_id=pid) and sent_at is null;
  return jsonb_build_object('reference',ref,'project_id',pid,'amount_cents',total,'songs',normalized);
 end if;
end $function$
;
