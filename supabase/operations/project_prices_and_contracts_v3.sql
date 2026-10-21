begin;
create table public.project_contracts (
 project_id uuid primary key references public.service_projects(id) on delete restrict,
 terms_version text not null, terms_body text not null, accepted_at timestamptz not null default now(),
 early_start_requested boolean not null, withdrawal_acknowledged boolean not null,
 amount_cents integer not null check(amount_cents>0), track_count integer not null check(track_count>0),
 revision_count integer not null default 2, first_version_business_days integer not null default 7,
 check(not early_start_requested or withdrawal_acknowledged)
);
alter table public.project_contracts enable row level security;
revoke all on public.project_contracts from public,anon,authenticated;
grant select,insert on public.project_contracts to service_role;
create function public.project_price_v3(service text,tracks integer) returns integer language plpgsql immutable set search_path='' as $$
begin
 if tracks is null or tracks<1 then raise exception 'invalid_track_count'; end if;
 if service='master' and tracks=1 then return 3999; end if;
 if service is null or service not in('mix','mix_master') or tracks>48 then raise exception 'quote_required'; end if;
 return case when service='mix' then case when tracks<=8 then 8999 when tracks<=24 then 13999 else 19999 end
 else case when tracks<=8 then 11999 when tracks<=24 then 17999 else 23999 end end;
end $$;
revoke all on function public.project_price_v3(text,integer) from public,anon,authenticated;
grant execute on function public.project_price_v3(text,integer) to service_role;
create function public.snapshot_project_contract_v3(pid uuid, payload jsonb) returns void language plpgsql security invoker set search_path='' as $snapshot$
declare early boolean:=coalesce((payload->>'earlyStart')::boolean,false); ack boolean:=coalesce((payload->>'withdrawalAcknowledged')::boolean,false); ref text; mail text; body text;
begin
 if payload->>'rateVersion' is distinct from '2026-10-21-v3' or payload->>'accepted' is distinct from 'on' or early and not ack then raise exception 'invalid_service_consent'; end if;
 body:=$terms$GENKS — Condizioni dei servizi mix e master
Versione 21 ottobre 2026.

1. Contatti e ambito
GENKS è il nome artistico di Gian Carlo Botteri. Recapito: Via Quintina, senza numero civico, Ponte San Giovanni, 06135 Perugia (PG), Italia. Assistenza e comunicazioni relative ai contratti: assistenza@prodbygenks.com; telefono +39 3450236299.
Queste condizioni riguardano un brano per ordine di mix, master stereo o mix + master. Eventuali diritti inderogabili del consumatore prevalgono. La vendita di beat e le relative licenze richiedono condizioni specifiche e non sono comprese nell’acquisto di questi servizi.

2. Prezzi e materiale
Mix: 1–8 tracce audio separate 89,99 EUR; 9–24 tracce 139,99 EUR; 25–48 tracce 199,99 EUR.
Mix + master: rispettivamente 119,99 EUR, 179,99 EUR e 239,99 EUR.
Master stereo: 39,99 EUR per un mix stereo. Ogni file audio mono o stereo separato è una traccia; le tracce alternative che richiedono lavorazione contano nel totale. Non si tratta di un prezzo per ogni stem moltiplicato automaticamente. Oltre 48 tracce o per stem mastering serve un preventivo personalizzato.
I prezzi esposti sono il totale dovuto per il servizio scelto; nessun extra viene addebitato senza preventivo e accettazione. Se il materiale ricevuto appartiene a una fascia superiore, GENKS lo comunica prima di lavorarlo: il cliente può accettare la differenza o mantenere il perimetro acquistato, salvi i diritti di recesso e gli altri rimedi applicabili.
Il cliente deve poter utilizzare legittimamente registrazioni e materiali forniti. Un servizio di mix/master non trasferisce diritti sui beat o su opere di terzi e non promette risultati commerciali, visualizzazioni o approvazione di piattaforme.

3. Ordine, pagamento e avvio
Il riepilogo precede la conferma dell’ordine. Per il lavoro a distanza il pagamento con carta è disponibile solo quando abilitato nel modulo Stripe; in studio è previsto il contante. Registrazioni e beat mantengono la modalità indicata nelle rispettive pagine.
Un pagamento online è confermato soltanto dopo la verifica del sistema di pagamento. GENKS non riceve i dati completi della carta. Non è richiesta approvazione manuale di GENKS per un servizio a listino.
La ricevuta di pagamento non sostituisce il documento fiscale richiesto dalla normativa.
Il lavoro inizia quando pagamento e file completi sono disponibili e l’esecuzione è consentita. Nei contratti a distanza con consumatori, senza richiesta espressa di avvio anticipato, GENKS attende la scadenza del periodo di recesso di 14 giorni. L’eventuale richiesta di avvio anticipato è facoltativa e separata dall’accettazione delle condizioni.

4. Consegna e revisioni
La prima versione viene inviata entro 7 giorni lavorativi, calcolati dal giorno successivo a quello in cui sono soddisfatte le condizioni di avvio. Sabati, domeniche e festività nazionali italiane non contano. La data desiderata indicata dal cliente non sostituisce queste regole.
Sono incluse 2 revisioni: ciascuna è un elenco unitario di modifiche relativo al materiale iniziale e alla lavorazione acquistata. Nuove registrazioni, nuovi arrangiamenti, versioni ulteriori, produzione, editing o altre lavorazioni non incluse richiedono un preventivo separato accettato prima dell’esecuzione. La correzione di un errore di GENKS o di un’inadempienza non consuma una revisione artistica.
File mancanti, illeggibili o sostituiti dal cliente vengono segnalati e possono richiedere una nuova decorrenza concordata. Nessuna modifica peggiorativa al termine già maturato è imposta unilateralmente. GENKS comunica tempestivamente eventuali impedimenti; restano i rimedi previsti dalla legge.
Il cliente conserva copie dei propri file. Una mancata risposta non equivale ad accettazione automatica della consegna, perdita di diritti o autorizzazione ad addebiti.

5. Recesso e rimborsi
Il consumatore che conclude a distanza può recedere senza motivazione entro 14 giorni dalla conclusione del contratto. Può usare la funzione «Recedere dal contratto qui» nella pagina Rimborsi e recesso oppure inviare una dichiarazione esplicita a assistenza@prodbygenks.com indicando nome, riferimento del contratto e recapito. Per rispettare il termine è sufficiente inviare la dichiarazione prima della scadenza; non serve l’approvazione di GENKS.
Se il cliente ha chiesto espressamente l’avvio anticipato ed è stato correttamente informato, in caso di recesso prima del completamento può essere dovuto un importo proporzionato alle prestazioni effettivamente eseguite fino alla comunicazione. Non è prevista una trattenuta fissa, una caparra automaticamente persa o la deduzione automatica delle commissioni Stripe.
Il diritto di recesso si perde per servizio interamente eseguito soltanto quando ricorrono i requisiti di legge, compresi richiesta espressa di avvio e riconoscimento della perdita del diritto a esecuzione completa. Il semplice pagamento o la personalizzazione artistica non equivalgono a tale rinuncia.
GENKS non offre una garanzia commerciale «soddisfatto o rimborsato»: il solo cambio di gusto dopo una prestazione corretta non crea una garanzia aggiuntiva. Restano sempre integri i diritti inderogabili, compresi quelli in caso di inadempimento.
I rimborsi dovuti per recesso sono eseguiti senza ritardo e comunque entro 14 giorni dalla comunicazione, con lo stesso mezzo di pagamento salvo diverso accordo espresso senza costi per il consumatore. L’esito viene comunicato; l’accredito può richiedere i tempi tecnici del circuito. Per altre contestazioni si applicano i relativi rimedi e termini di legge. Non viene imposto un buono in sostituzione del rimborso dovuto.
Se GENKS non può eseguire la prestazione, ne informa il cliente e gestisce la restituzione delle somme dovute secondo legge. Nessuna limitazione riguarda responsabilità non escludibili.

6. Reclami, controversie e modifiche
Per reclami, descrivi il problema e il risultato richiesto all’assistenza, allegando il riferimento dell’ordine. I canali informali non impediscono di esercitare i diritti di legge. Non è previsto un foro esclusivo contrario alle tutele del consumatore.
Si applica la legge italiana, senza privare il consumatore delle protezioni obbligatorie applicabili. Le modifiche future al listino o alle condizioni non modificano retroattivamente gli ordini già conclusi.$terms$;
 insert into public.project_contracts(project_id,terms_version,terms_body,early_start_requested,withdrawal_acknowledged,amount_cents,track_count)
 values(pid,'2026-10-21-v3',body,early,ack,public.project_price_v3(payload->>'service',(payload->>'trackCount')::integer),(payload->>'trackCount')::integer);
 select reference,email into strict ref,mail from public.service_projects where id=pid;
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
 values('contract-'||pid,mail,'GENKS · Condizioni del servizio · '||ref,'Il riepilogo delle condizioni accettate.', 'Riferimento: '||ref||E'\nAvvio prima dei 14 giorni richiesto: '||case when early then 'sì; riconoscimento perdita del recesso solo a completa esecuzione: sì' else 'no; si attende la scadenza del periodo di recesso' end||E'\nLa registrazione delle condizioni non è una ricevuta di pagamento.\n\n'||body);
end $snapshot$;
revoke all on function public.snapshot_project_contract_v3(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.snapshot_project_contract_v3(uuid,jsonb) to service_role;
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
  amount:=round(rate*hours)::integer; start_at:=(p_data->>'startsAt')::timestamptz; end_at:=start_at+make_interval(mins=>(hours*60)::integer);
  if start_at is null or start_at<=now() or start_at>now()+interval '1 year' or length(trim(coalesce(p_data->>'phone',''))) not between 6 and 40 then raise exception 'invalid_request'; end if;
  perform public.expire_booking_holds();
  insert into public.bookings(reference,customer_id,service_id,name,artist_name,email,phone,starts_at,ends_at,notes,reference_url,status,price_cents,deposit_cents,hold_expires_at)
  values('BKG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),nullif(p_data->>'customerId','')::uuid,sid,person,nullif(p_data->>'artistName',''),recipient,p_data->>'phone',start_at,end_at,nullif(p_data->>'notes',''),nullif(p_data->>'referenceUrl',''),'confirmed',amount,0,null)
  returning * into b;
  ref:=b.reference;target:=b.id;mode:='studio';
  details:='Registrazione in studio · '||hours||' ore × 20,00 EUR/ora. Totale '||to_char(amount/100.0,'FM999990.00')||' EUR. Pagamento in contanti presso lo studio. Appuntamento: '||to_char(start_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')||' – '||to_char(end_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')||' (ora italiana).';
 else
  if p_type<>'project' then raise exception 'invalid_type'; end if;
  service:=p_data->>'service';mode:=p_data->>'mode';
  amount:=public.project_price_v3(service,(p_data->>'trackCount')::integer);
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
end $function$;

CREATE OR REPLACE FUNCTION public.reserve_remote_project(p_data jsonb, p_owner_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.service_projects; q public.service_quotes; amount integer; scope text; recipient text;
begin
 if p_data->>'rateVersion' is distinct from '2026-10-21-v3' or p_data->>'accepted' is distinct from 'on' then raise exception 'price_changed'; end if;
 if p_data->>'mode' is distinct from 'remote' then raise exception 'remote_only'; end if;
 amount:=public.project_price_v3(p_data->>'service',(p_data->>'trackCount')::integer);
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
 perform public.snapshot_project_contract_v3(p.id,p_data);
 scope:=replace(p.service,'_',' + ')||' · 1 brano: '||p.track_title||'. A distanza. Prima versione entro 7 giorni lavorativi dal giorno successivo a pagamento, file completi e avvio consentito; 2 revisioni incluse. Senza richiesta espressa di avvio anticipato si attendono i 14 giorni del recesso. La data desiderata non è una promessa di consegna.';
 insert into public.service_quotes(project_id,amount_cents,scope,revision_count,agreed_deadline,expires_at,fixed_price)
 values(p.id,amount,scope,2,null,now()+interval '2 hours',true) returning * into q;
 -- An unpaid checkout must never send a cash agreement or a confirmation of payment.
 update public.notification_outbox set cancelled_at=now() where dedupe_key='request-'||p.reference||'-customer' and sent_at is null;
 return to_jsonb(q);
end $function$;

commit;