# Continuare il lavoro e caricarlo su GitHub

Repository: https://github.com/giancarlobotteri/genks-website

Il codice della Milestone 1 è completo nel progetto consegnato. In questa sessione il repository era leggibile, ma GitHub ha rifiutato la scrittura del collegamento con `403 Resource not accessible by integration`. Nessun commit di questa implementazione è quindi stato caricato sul repository remoto.

## Ripartire dalla cronologia inclusa nello ZIP

Lo ZIP contiene la cartella `genks-website/` con tutti i sorgenti e, accanto, `genks-history.bundle`, una copia della cronologia Git. Installa Git e Node.js 24; apri un terminale nella cartella in cui hai estratto lo ZIP. Esegui questi comandi prima di cominciare a modificare i file:

```bash
git clone -b feat/genks-milestone-1 genks-history.bundle genks-lavoro
cd genks-lavoro
git remote set-url origin https://github.com/giancarlobotteri/genks-website.git
npm ci
npm run dev
```

Lavora nella cartella `genks-lavoro`. Il sito sarà su http://localhost:3000. La cartella `genks-website` dello ZIP è una seconda copia dei soli sorgenti e non serve a questo flusso.

## Caricare il branch sul tuo repository

Accedi a GitHub sul tuo computer con GitHub Desktop o il gestore di credenziali Git, quindi, dalla cartella `genks-lavoro`:

```bash
git push -u origin feat/genks-milestone-1
```

Questo pubblica il branch di lavoro preservando il commit iniziale del repository e lasciando `main` invariato. Apri poi il repository su GitHub e crea una pull request dal branch `feat/genks-milestone-1` a `main` quando vuoi integrare il lavoro.

Per salvare le tue modifiche successive:

```bash
git add .
git commit -m "feat: aggiorna contenuti GENKS"
git push
```

Non inserire token o password nei file del progetto. Il file `.gitignore` esclude già dipendenze, build e file `.env` locali.

## Stato delle verifiche

- ESLint: passato senza warning.
- TypeScript strict: passato.
- Test automatici: 6 passati.
- Build di produzione: passata.

I beat, gli audio e le condizioni commerciali sono dimostrativi. Prima del lancio pubblico, sostituiscili con i contenuti GENKS definitivi. Questa consegna non comprende un sito pubblicato su un servizio di hosting.
