# Cosa funziona davvero e cosa è simulato

## Funziona davvero

- Navigazione: intro, menu persistente, scroll cinematografico, indicatore di avanzamento, salto diretto a ogni sezione.
- Scena 3D interattiva con hotspot cliccabili, anche da tastiera.
- Ricerca, filtri e ordinamento del catalogo.
- Riproduzione audio: play/pausa, posizione, volume, precedente/successivo, continuità durante la navigazione.
- Sequencer suonabile.
- Validazione dei moduli, messaggi di errore, gestione del focus.
- Carrello: aggiunta, cambio licenza, rimozione, totale.
- Modifica dei contenuti dall'area gestione, con effetto immediato sul sito.

## Simulato (sempre etichettato DEMO)

| Funzione | Cosa succede nel prototipo | Cosa serve in produzione |
| --- | --- | --- |
| Prenotazione registrazione | Richiesta salvata solo nel browser; calendario generato in locale | Calendario reale, backend, email di conferma |
| Invio progetto remoto | Richiesta salvata solo nel browser | Backend, notifiche |
| Upload file | Barra di avanzamento finta; i file non vengono letti né inviati | Storage sicuro, limiti, antivirus |
| Checkout | Ordine simulato, nessun dato di pagamento richiesto | Provider di pagamento, webhook, fatturazione |
| Download dopo l'acquisto | Non esiste | Link autorizzati e a scadenza |
| Richieste beat su misura, pacchetti, esclusiva | Salvate solo nel browser | Backend, email |
| Prezzi, licenze, pacchetti, tempi | Dati di esempio | Valori e testi approvati |
| Area gestione | Senza login, salva nel browser | Autenticazione admin, database, permessi |
| Anteprime audio | Brevi loop sintetizzati | Anteprime reali con tag vocale |

I dati demo stanno nel `localStorage` del browser con chiavi `genks:vs:*`. Si azzerano da Gestione demo → «Ripristina dati demo» e «Svuota elenco».
