# Integrazione chatbot GENKS v2 — 27 ottobre 2026

## Stato
Codice predisposto per gemini-3.5-flash-lite, nessuna fatturazione attivata. Le chiamate pubbliche a Gemini sono disattivate. Inserire una chiave non attiva automaticamente il provider. La restrizione EEA delle condizioni Google va risolta prima dell’attivazione pubblica; non cambiare piano o modello senza istruzioni.

## Implementazione
- Widget blu/bianco una sola volta nel layout; nascosto in amministrazione; dialog accessibile, collegamenti filtrati, nessuna cronologia persistente e nessun dato cliente recuperato dalla chat.
- pricing.ts è identico al file nello ZIP. pricing-breakdown.ts aggiunge solo le annotazioni necessarie a ricondurre i componenti al flusso esistente; prezzi e proporzioni sono importati dall’originale e ogni risultato è confrontato sul server con verificaPreventivo prima di essere usato.
- Checkout ?preventivo= con validazione stretta, ricalcolo server, Stripe/contanti, acconti e saldo; le sessioni richiedono data e ora. File facoltativi per brano, contatti una sola volta, termini e garanzie esistenti.
- Preventivo, righe e importi salvati nello snapshot ordine; dettagli in amministrazione e nelle conferme cliente. Email titolare mantiene i quattro campi richiesti.
- Calendario API e strumento bot condividono readBookingAvailability. Link recording precompilati date/hours/start. Nessun accesso del bot a dati clienti o pagamenti.
- Privacy aggiornata, comprese condizioni di utilizzo e stato inattivo.
- Nessuna dipendenza aggiunta. Chiave mai inserita nel sorgente o letta dall’assistente.

## Database
Aggiornata soltanto schedule_service_credit_v8: i preventivi possono contenere blocchi estesi fino a 10 ore. Restano 90 giorni, massimo due appuntamenti, massimo 8 ore per appuntamento e controlli di sovrapposizione. Vecchi blocchi senza creditMinutes conservano il limite di 300 minuti. Funzione invocabile solo da service_role: anon=false, authenticated=false, service_role=true.

## Prove eseguite
- Compilazione Next.js webpack riuscita; lint senza errori.
- 125 test automatici passati, inclusi i 9 importi del documento, 252 combinazioni con extra, ripartizione al centesimo di acconti/Stripe, codici manomessi, provider spento, anti-abuso e filtraggio dati personali.
- 12 scenari database annullati: EP6, pacchetto con studio, 8 ore di crediti, chiavi in mano, 5 master, tutti gli extra; carta e contanti, registrazione pagamento simulata nel database e idempotenza. Zero pagamenti reali e zero ordini QA residui.
- Il test del dialogo reale Gemini resta da eseguire dopo la soluzione della restrizione sul piano e l’inserimento della chiave. I test simulati non dimostrano il comportamento di un modello dal vivo.

## Passaggi riservati utente
Vercel → team zenvy → genks-website → Settings → Environment Variables → Add Environment Variable: nome GEMINI_API_KEY, valore copiato direttamente da Google AI Studio, ambiente Production; eventualmente Preview soltanto per collaudi autorizzati. Non inviare la chiave in chat. Non attivare fatturazione. Non impostare GENKS_GEMINI_ENABLED=true finché non è chiarita l’attivazione consentita per gli utenti italiani. Modello fissato nel server a gemini-3.5-flash-lite, nessun passaggio automatico ad altri modelli.

## File della modifica
- src/app/admin/payments/page.tsx
- src/app/api/availability/route.ts
- src/app/api/services/order/route.ts
- src/app/api/chat/route.ts
- src/app/api/chat/quote/route.ts
- src/app/layout.tsx
- src/app/services/checkout/page.tsx
- src/app/services/recording/page.tsx
- src/components/home/cinematic-hero.tsx
- src/components/services/order-builder-v8.tsx
- src/components/services/studio-scheduler.tsx
- src/components/services/preventivo-checkout.tsx
- src/components/ChatWidget.tsx
- src/components/ChatWidget.module.css
- src/data/legal.ts
- src/lib/notifications.ts
- src/lib/security/request-limit.ts
- src/lib/service-email-summary.ts
- src/lib/booking-availability.ts
- src/lib/chatbot/pricing.ts
- src/lib/chatbot/pricing-breakdown.ts
- src/lib/chatbot/checkout.ts
- src/lib/chatbot/booking.ts
- src/lib/chatbot/knowledge.ts
- src/lib/chatbot/prompt.ts
- supabase/migrations/20261027160000_chatbot_quote_credit_minutes.sql
- tests/chatbot-api.test.ts
- tests/chatbot-quotes.test.ts
- scripts/chatbot-db-fixtures.mjs
