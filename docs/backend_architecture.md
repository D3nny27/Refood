# Architettura del Backend Refood

## Panoramica

Questo documento descrive l'architettura del backend per l'app Refood, sviluppato utilizzando Node.js, Express e SQLite. Il backend è progettato per supportare tutte le funzionalità dell'app mobile, fornendo API RESTful per la gestione dei lotti, prenotazioni, centri, utenti e statistiche.

## Struttura del Progetto

L'architettura del backend segue un modello MVC (Model-View-Controller) modificato per API, organizzato nelle seguenti directory:

```
backend/
├── src/
│   ├── config/           # Configurazione (database, variabili d'ambiente)
│   ├── controllers/      # Logica di business per le routes
│   ├── middlewares/      # Middleware (auth, validazione, errori)
│   ├── routes/           # Definizione delle routes dell'API
│   ├── utils/            # Utility (logger, scheduler, swagger)
│   └── server.js         # Punto di ingresso dell'applicazione
├── public/               # File statici
├── logs/                 # Log dell'applicazione
└── package.json          # Dipendenze e script
```

## Componenti Principali

### 1. Server e Middleware

Il file `server.js` è il punto di ingresso dell'applicazione. Configura:
- Express e i suoi middleware essenziali
- Sicurezza con Helmet
- CORS
- Compressione delle risposte
- Logging con Morgan e Winston
- Gestione centralizzata degli errori
- Avvio dello scheduler per attività pianificate

### 2. Configurazione

La directory `config` contiene:
- `database.js`: Gestione della connessione SQLite con metodi async/await
- Caricamento delle variabili d'ambiente tramite dotenv

### 3. Routes

Le routes sono organizzate in moduli separati:
- `auth.routes.js`: Autenticazione (login, refresh token, logout)
- `user.routes.js`: Gestione utenti
- `lotti.routes.js`: Gestione dei lotti di prodotti
- `prenotazioni.routes.js`: Gestione delle prenotazioni
- `centri.routes.js`: Gestione dei centri
- `statistiche.routes.js`: Generazione di statistiche e reportistica

### 4. Controllers

I controllers contengono la logica di business:
- `auth.controller.js`: Gestione autenticazione JWT
- `user.controller.js`: CRUD per utenti
- `lotti.controller.js`: Operazioni sui lotti con logica di stato e disponibilità
- `prenotazioni.controller.js`: Gestione delle prenotazioni con stati multipli
- `centri.controller.js`: Gestione dei centri e associazioni con utenti
- `statistiche.controller.js`: Aggregazione di dati per reportistica

### 5. Middleware

Middleware personalizzati:
- `auth.js`: Verifica token JWT e autorizzazioni
- `validator.js`: Validazione input con express-validator
- `errorHandler.js`: Gestione centralizzata degli errori con ApiError

### 6. Utilities

Utility essenziali:
- `logger.js`: Sistema di logging con Winston
- `swagger.js`: Documentazione API con Swagger/OpenAPI
- `scheduler.js`: Gestione di processi pianificati con node-cron

## Funzionalità Implementate

### Sistema di Autenticazione

Il backend implementa un sistema di autenticazione JWT completo con:
- Access token e refresh token
- Blacklist di token revocati
- Gestione sessioni multiple da dispositivi diversi
- Protezione delle routes con middleware di autenticazione

### Gestione dei Lotti

Implementazione completa per la gestione dei lotti alimentari:
- CRUD di lotti con associate categorie e origini
- Sistema automatico di aggiornamento stato (Verde/Arancione/Rosso)
- Ricerca avanzata con filtri (stato, centro, data scadenza)
- Ricerca geospaziale con calcolo distanza
- Calcolo dell'impatto ambientale ed economico

### Prenotazioni

Sistema di prenotazione dei lotti:
- Workflow completo (Prenotato → InTransito → Consegnato/Annullato)
- Associazione con logistica e trasporti
- Notifiche automatiche ai centri interessati

### Processi Automatizzati

Scheduler che esegue:
- Aggiornamento automatico dello stato dei lotti in base alla data di scadenza
- Archiviazione di lotti scaduti da più di 30 giorni
- Raccolta giornaliera di statistiche sul sistema

## API REST

Le API seguono principi RESTful:
- Endpoints organizzati per risorsa
- Utilizzo appropriato dei metodi HTTP
- Supporto per paginazione, ordinamento e filtri
- Formato delle risposte consistente
- Gestione appropriata degli errori

## Sicurezza

Misure di sicurezza implementate:
- Protezione con Helmet
- Validazione degli input
- CORS configurabile
- Password criptate con bcrypt
- Autenticazione JWT con token di refresh
- Gestione sessioni e revoche
- Logging di sicurezza

## Documentazione API

Le API sono documentate con Swagger/OpenAPI:
- Interfaccia interattiva disponibile su `/api-docs`
- Descrizione completa di endpoints, parametri e risposte
- Esempi di utilizzo

## Configurazione

Il backend è configurabile tramite variabili d'ambiente:
- Porta del server
- Ambiente (development/production)
- Percorso del database
- Segreti JWT e durata dei token
- Configurazione CORS
- Livelli di logging 