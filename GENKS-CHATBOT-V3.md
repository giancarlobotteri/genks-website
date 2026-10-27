# GENKS chatbot v3 — Cloudflare Workers AI

## Implementazione
Il pacchetto genks-chatbot3.zip sostituisce la versione Gemini. pricing.ts, knowledge.ts e prompt.ts sono identici ai file ricevuti. Nessuna libreria aggiunta.

Provider Cloudflare Workers AI, modello @cf/qwen/qwen3-30b-a3b-fp8. CF_MODEL può indicare esclusivamente questo modello; altri valori non attivano modelli diversi. Il flusso pubblico non chiama Gemini né usa un provider alternativo in caso di errore. Nessuna fatturazione, AI Gateway o archiviazione Cloudflare abilitata.

Widget una sola volta nel layout, blu e bianco, dialog accessibile, conversazione conservata in sessionStorage per dispositivo/account verificato, comando di cancellazione, link filtrati, nessuna chiave client e nessun accesso agli ordini del cliente. Non compare nel pannello amministratore. Carrello al centro-destra su telefono orizzontale; chat in basso a destra.

Checkout ?preventivo= ricalcolato dal file originale sul server prima del riepilogo e del pagamento; importi dal browser non accettati. Navigazione brano per brano, file HTTPS facoltativi, contatti una sola volta, acconti al 50%, saldi, termini, recesso e garanzia del 30% sul servizio scontato, extra esclusi. Condizioni e dettagli salvati nello snapshot ordine, amministrazione e email cliente.

Calendario e strumento orari_disponibili condividono readBookingAvailability: stessa disponibilità, durata, buffer e blocchi; nessun dettaglio di altri clienti viene inviato al modello. Link recording precompilati date/hours/start; nessuna prenotazione creata dal bot.

Privacy e cookie aggiornati per Cloudflare e memoria della conversazione. I contenuti non vengono registrati nei log dell’applicazione. Sono respinti dalla chat email, telefoni e collegamenti a file prima dell’invio al provider.

## Database
La migrazione 20261027160000_chatbot_quote_credit_minutes.sql, già applicata e verificata, consente ai blocchi proporzionati di conservare le ore acquistate, fino a 10 ore per blocco, massimo 2 appuntamenti entro 90 giorni e massimo 8 ore per appuntamento. Per i vecchi blocchi restano 300 minuti. Funzione solo server: anon=false, authenticated=false, service_role=true. Non servono altre modifiche al database per Cloudflare.

## Prove
Tutti i 9 importi della tabella passati, comprese EP6 419,99 €, 5 master 132,99 €, 8 ore 119,96 € e 1 ora 19,99 € con 10,00 € iniziali. Verificate 252 combinazioni aggiuntive e conservazione degli importi per Stripe/acconti/saldi. 12 scenari database annullati, zero pagamenti reali, nessuna email inviata e zero ordini QA residui.
Test simulati Cloudflare: function calling, modello invariato, risposta della calcolatrice, disponibilità precompilata, quota esaurita, blocco provider/modelli diversi e mancata esposizione dei token. Prove dal vivo e screenshot vengono registrati dopo la pubblicazione.

## Configurazione utente
Vercel → team zenvy → genks-website → Settings → Environment Variables → Production:
- CLOUDFLARE_ACCOUNT_ID: ID dell’account Cloudflare.
- CLOUDFLARE_API_TOKEN: token Workers AI copiato direttamente dal servizio; tipo Secret. Mai in chat o nel repository.
- CF_MODEL facoltativa: @cf/qwen/qwen3-30b-a3b-fp8. Non serve inserirla perché è già il default.
- AI_PROVIDER facoltativa: cloudflare. Nessun passaggio automatico a Gemini.
Dopo il salvataggio serve una pubblicazione che carichi le nuove variabili. Mantieni Workers Free; a quota gratuita esaurita Cloudflare ferma le richieste, e il widget propone assistenza o pagina Servizi.

## Collaudo finale dal sito pubblicato
29 richieste reali verificate nel browser con screenshot individuale, comprese tutte quelle indicate dal proprietario e una verifica aggiuntiva di risposta No fuori orario. Prezzi confrontati con il totale, non con la semplice presenza della cifra nel testo. Corrette durante il collaudo: quantità EP duplicate, componenti/extra non richiesti e date inventate per domande sul solo prezzo delle ore.

Le risposte economiche sono ora composte dal server direttamente dalla calcolatrice. La normalizzazione verifica quantità esplicitamente richieste ed esclude extra non richiesti; non cambia il listino né le formule. Le risposte sulle regole commerciali derivano dalle regole del sito. Disponibilità sì/no verificata per la durata richiesta; in assenza di durata per un orario preciso si verifica un’ora, dichiarandolo.

Verificato realmente: link EP6 → checkout 419,99 €; link studio → sabato 31 ottobre, 15:00, 3 ore, totale 59,97 €; preventivo manomesso rifiutato. Precompilazione contatti confermata nel checkout, senza inviare il modulo. Widget controllato a 1280x720, 390x844 e 844x390: nessuna larghezza eccedente, strumenti separati, carrello al centro-destra in orizzontale. Prove senza pagamenti reali.

141 test automatici superati, inclusi protezione dei dati nella cronologia, modello/provider bloccati alle scelte autorizzate, calcolo e ordinazione, garanzie, anticipo, extra e date. Le schermate sono in qa/chatbot-live/; il rapporto illustrato finale viene consegnato separatamente al proprietario.

Configurazione Cloudflare salvata direttamente dall’utente su Vercel e collaudata. Non resta alcun inserimento di chiavi da fare per questa attivazione. Workers Free mantenuto; nessun acquisto, upgrade o chiamata Gemini.

SHA-256 pricing.ts originale v3: 163b9fa205f6d4123e105413027d8180b2320aada844da5f9191b92c3ab1040a
