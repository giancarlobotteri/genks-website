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
  amount:=public.project_price_v3(coalesce(song->>'service',p_data->>'service'),(song->>'trackCount')::integer);
  if amount is null then raise exception 'invalid_song_price'; end if;
  song:=jsonb_build_object('service',coalesce(song->>'service',p_data->>'service'),'trackTitle',trim(song->>'trackTitle'),'trackCount',(song->>'trackCount')::integer,
   'description',trim(song->>'description'),'referenceLinks',song->>'referenceLinks','notes',song->>'notes',
   'desiredDeadline',song->>'desiredDeadline','amountCents',amount);
  normalized:=normalized||jsonb_build_array(song);total:=total+amount;tracks:=tracks+(song->>'trackCount')::integer;i:=i+1;
  summary:=summary||'Brano '||i||': '||left(song->>'trackTitle',35)||' · '||replace(song->>'service','_',' + ')||' · '||(song->>'trackCount')||' tracce · '||to_char(amount/100.0,'FM999990.00')||' EUR'||chr(10);
 end loop;
 if (p_data ? 'expectedTotal' and (p_data->>'expectedTotal')::integer<>total) or (not p_data ? 'expectedTotal' and total<>(select sum(public.genks_project_list_price(x->>'service',(x->>'trackCount')::integer)) from jsonb_array_elements(normalized) x)) then raise exception 'price_changed'; end if;
 first_song:=normalized->0;
 payload:=(p_data-'songs')||first_song||jsonb_build_object('expectedTotal',(first_song->>'amountCents')::integer,'links',coalesce((select jsonb_agg(link) from regexp_split_to_table(first_song->>'referenceLinks','[[:space:]]+') link where link ~ '^https?://'),'[]'::jsonb));
 if p_payment='card' then
  quote:=public.reserve_remote_project(payload,p_owner_email);pid:=(quote->>'project_id')::uuid;
  select reference into strict ref from public.service_projects where id=pid;
 else
  ref:=public.reserve_cash_service('project',payload,p_owner_email);
  select id into strict pid from public.service_projects where reference=ref;
 end if;
 batch_details:=n||case when n=1 then ' brano' else ' brani' end||' · '||'servizi scelti per ciascun brano'||chr(10)||summary
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
