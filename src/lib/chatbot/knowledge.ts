/**
 * BASE DI CONOSCENZA DEL CHATBOT GENKS
 * ------------------------------------
 * Questo è l'UNICO file da aggiornare quando cambiano prezzi, servizi,
 * orari o regole sul sito. Il bot risponde solo con quello che c'è qui.
 *
 * Ultimo aggiornamento: 27 ottobre 2026 (condizioni versione 26/10/2026).
 */

export const SITE_URL = "https://www.prodbygenks.com";

export const CONTACTS = {
  email: "assistenza@prodbygenks.com",
  phone: "+39 345 023 6299",
  whatsapp: "https://wa.me/393450236299",
  instagram: "https://www.instagram.com/prodbygenks/",
};

export const KNOWLEDGE = `
# CHI È GENKS
- GENKS è Gianca (Gian Carlo Botteri), produttore musicale. Produce e mixa rap, trap e R&B nel suo studio.
- Studio: Via Quintina s.n.c., Ponte San Giovanni, 06135 Perugia (PG), Italia.
- Lavora in studio a Perugia o a distanza, da qualsiasi paese: si paga online, si mandano le tracce, si riceve il brano via email.
- Social: Instagram ${CONTACTS.instagram} · TikTok https://www.tiktok.com/@prodbygenks · YouTube https://www.youtube.com/@prodbygenks
- Assistenza: ${CONTACTS.email} · telefono/WhatsApp ${CONTACTS.phone} (${CONTACTS.whatsapp})

# COME FUNZIONA (mix e master)
1. Scegli il servizio e paga online in 2 minuti.
2. Invia il link alle tracce seguendo la guida.
3. Ricevi la prima versione entro 7 giorni lavorativi. Una revisione inclusa.

# PREZZI MIX E MIX + MASTER (per brano, in base ai file audio)
| File audio per brano | Mix | Mix + master | Risparmio vs separati |
| Fino a 8   | 59,99 € | 79,99 €  | 9,99 €  |
| 9–24       | 89,99 € | 104,99 € | 14,99 € |
| 25–48      | 139,99 € | 149,99 € | 19,99 € |
- Oltre 48 file: preventivo (su WhatsApp).
- Nessun supplemento per la durata del brano. Concerti, set e raccolte richiedono preventivo.
- Mix + master è il servizio più scelto: brano pronto per Spotify, Apple Music, YouTube e ogni piattaforma di streaming.
- Link: mix ${SITE_URL}/services/project?service=mix · mix + master ${SITE_URL}/services/project?service=mix_master

# MASTER
- Master stereo: 29,99 € a brano, su un solo mix stereo già pronto.
- Link: ${SITE_URL}/services/project?service=master

# COME CONTARE I FILE (tracce)
- Conta ogni file audio separato da lavorare: voce principale, doppie, cori, strumenti.
- Un file stereo conta come uno (non due). Una base stereo conta come un file.
- Conta anche le alternative che vuoi far lavorare.
- Non contare canali vuoti, effetti di ritorno o copie che non invii.
- Per il master si invia un solo mix stereo.
- Guida: ${SITE_URL}/guida/tracce

# REGISTRAZIONE IN STUDIO
- 19,99 €/ora. Anticipo del 50% per confermare (es. 1 ora: 10,00 € subito, 9,99 € di saldo).
- Orari: lunedì–venerdì dalle 19:30; sabato e domenica dalle 10:00. Fine entro mezzanotte.
- Solo venerdì e sabato si può andare oltre mezzanotte, secondo disponibilità: +9,99 € ogni 30 minuti dopo le 00:00, oltre al costo del tempo.
- Orari in ora italiana.
- Prenotazione: ${SITE_URL}/services/recording

# PACCHETTI (risparmio)
- Blocco 5 ore di registrazione: 89,99 € (invece di 99,95 €). 5 ore da usare entro 90 giorni, massimo 2 appuntamenti da organizzare con GENKS (non riserva una data in automatico). Link: ${SITE_URL}/services/project?package=hours
- Master Pack: 79,99 € (invece di 89,97 €). 3 master stereo, una revisione per brano. Link: ${SITE_URL}/services/project?package=masters
- Registrazione + mix/master: 109,99 € (invece di 119,97 €). Base fornita dal cliente, 2 ore di registrazione + mix/master fino a 8 file. Link: ${SITE_URL}/services/project?package=voice
- EP Pack: 279,99 € (invece di 319,96 €). Mix + master di 4 brani, fino a 8 file ciascuno, una revisione per brano. Link: ${SITE_URL}/services/project?package=ep
- Singolo chiavi in mano: 149,99 € (invece di 219,97 €, risparmio 69,98 €). Beat su misura GENKS + 2 ore di registrazione + mix/master fino a 8 file. È l'offerta con il risparmio più alto. Link: ${SITE_URL}/services/project?package=turnkey
- Nei pacchetti con mix, per ogni brano: 9–24 file +25 €; 25–48 file +70 € (le maggiorazioni non si sommano). Oltre 48: preventivo.
- Ore aggiuntive nei pacchetti: 9,99 €/ora, nella stessa sessione e secondo disponibilità. Supplemento notturno separato.
- Esempio: EP con due brani fino a 8 file, uno da 18 e uno da 30 file = 279,99 + 25 + 70 = 374,99 €.
- Gli sconti non si cumulano automaticamente con altre promozioni.

# OFFERTE SU MISURA (richieste che il listino non prevede)
- Si possono comprare anche combinazioni che sul sito non ci sono: EP da 5, 6 o più brani, EP di solo mix, EP misti, più di 3 master, ecc.
- Il prezzo è in proporzione ai pacchetti del sito: ogni brano con mix costa come nell'EP Pack (circa 70 € a brano per mix + master fino a 8 file), ogni master come nel Master Pack (circa 26,66 €). Il prezzo esatto lo calcola sempre lo strumento calcola_preventivo.
- Valgono tutte le regole del sito per ogni servizio: una revisione inclusa per brano, maggiorazioni per numero di file, tempi, garanzia del 30%, anticipi.
- Si acquistano dal link di acquisto che il bot genera (carrello servizi del sito).

# BEAT SU MISURA
- 100 €: 50 € per iniziare, 50 € prima dei file definitivi.
- Prima versione entro 10 giorni lavorativi da anticipo, indicazioni complete e avvio. Una revisione inclusa.
- Diritti: split 50/50 dei diritti patrimoniali sulla composizione GENKS. Per il 100% dei diritti o l'esclusiva serve un preventivo e un accordo scritto prima dell'acquisto.
- Mix, master e registrazione di materiale del cliente NON danno diritti a GENKS.
- Link: ${SITE_URL}/services/custom
- Licenze dei beat: si confrontano file e condizioni sulla pagina ${SITE_URL}/guida#licenze. Licenza e consegna si concordano prima dell'acquisto.

# EXTRA
- Correzione e pulizia voci (intonazione, piccoli tempi, pulizia), per brano: 1 artista 24,99 € · 2 artisti 34,98 € · 3 artisti 49,97 € · 4 artisti 69,96 €. Doppie e cori dello stesso artista sono inclusi. Ricostruzione da molte riprese o audio molto danneggiato: preventivo.
- Revisioni aggiuntive (una è già inclusa): prima extra 9,99 €, seconda 14,99 €, terza 19,99 €, quarta 24,99 € (+5 € ogni volta). Oltre due extra serve la disponibilità di GENKS. Ogni revisione = un elenco unico di modifiche.
- Consegna veloce: +19,99 € a brano, prima versione entro 48 ore (si sceglie nel modulo). Non significa che anche tutte le revisioni arrivino in 48 ore.

# TEMPI DI CONSEGNA
- Mix/master: prima versione entro 7 giorni lavorativi dal giorno dopo pagamento, file completi e avvio consentito. Esclusi weekend e festività italiane.
- Con consegna veloce: entro 48 ore.
- Beat su misura: entro 10 giorni lavorativi.

# PAGAMENTI
- Carta o Apple Pay online. Contanti solo per il lavoro in studio (si passa in studio con il codice ordine).
- Mix e master si pagano per intero prima dell'avvio.
- Registrazione e beat su misura: anticipo del 50%.
- Si può comprare subito o usare il carrello per più servizi: ${SITE_URL}/services/checkout
- Nessun extra viene addebitato senza accordo prima del pagamento.

# INVIO DEI FILE
- Con un link HTTPS (es. SwissTransfer) oppure rispondendo all'email di conferma.
- Conserva sempre una copia dei tuoi file. Il servizio non è un archivio permanente.

# CANCELLAZIONI E RITARDI (registrazione)
- Cancellazione o rinvio gratis fino a 24 ore prima: rimborso dell'anticipo o nuova data.
- Dopo, o in caso di mancata presentazione, può essere applicato un costo proporzionato fino all'anticipo.
- Fino a 15 minuti di ritardo: l'orario di fine resta quello prenotato. Oltre, contattare GENKS.
- Con i contanti: l'anticipo va versato entro metà del tempo tra richiesta e sessione (es. sessione tra 6 giorni → entro 3 giorni). Senza incasso la prenotazione si annulla da sola. La scadenza esatta arriva via email.
- Dettagli: ${SITE_URL}/services/regole

# GARANZIA E RIMBORSI
- Dopo la revisione inclusa, se mix o master non convincono, si può chiedere il rimborso del 30% di quella lavorazione entro 14 giorni dalla versione revisionata, una volta per brano.
- Esempio: mix + master da 79,99 € → rimborso 24 €. Extra esclusi. Registrazione e beat sono esclusi da questa garanzia (restano i diritti di legge).
- Per richiederla: email a ${CONTACTS.email} con codice ordine, brano e cosa non convince.
- Errori di GENKS rispetto a quanto pattuito si correggono gratis, senza consumare revisioni.
- Diritto di recesso per acquisti a distanza, generalmente entro 14 giorni: modulo su ${SITE_URL}/recesso
- Condizioni complete: ${SITE_URL}/legal/refunds · ${SITE_URL}/legal/terms

# PAGINE UTILI
- Tutti i servizi e prezzi: ${SITE_URL}/services
- Guida all'acquisto: ${SITE_URL}/guida
- Chi sono: ${SITE_URL}/chi-sono
- Privacy: ${SITE_URL}/legal/privacy
`;
