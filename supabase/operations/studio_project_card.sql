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

CREATE OR REPLACE FUNCTION public.snapshot_project_contract_v3(pid uuid, payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
Il riepilogo precede la conferma dell’ordine. Per mix e master puoi pagare online con carta sia lavorando a distanza sia fisicamente in studio, quando il collegamento Stripe è attivo nel modulo. Per il lavoro fisicamente in studio puoi scegliere anche il contante presso lo studio. Registrazioni e beat mantengono la modalità indicata nelle rispettive pagine.
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
 values(pid,'2026-10-21-v4',body,early,ack,public.project_price_v3(payload->>'service',(payload->>'trackCount')::integer),(payload->>'trackCount')::integer);
 select reference,email into strict ref,mail from public.service_projects where id=pid;
 insert into public.notification_outbox(dedupe_key,recipient,subject,heading,body)
 values('contract-'||pid,mail,'GENKS · Condizioni del servizio · '||ref,'Il riepilogo delle condizioni accettate.', 'Riferimento: '||ref||E'\nAvvio prima dei 14 giorni richiesto: '||case when early then 'sì; riconoscimento perdita del recesso solo a completa esecuzione: sì' else 'no; si attende la scadenza del periodo di recesso' end||E'\nLa registrazione delle condizioni non è una ricevuta di pagamento.\n\n'||body);
end $function$
;

