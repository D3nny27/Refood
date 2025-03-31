# Documentazione Completa del Progetto ReFood

## Introduzione

ReFood è un sistema completo per la gestione e la distribuzione di alimenti in eccedenza, progettato per ridurre lo spreco alimentare e ottimizzare la distribuzione di cibo a chi ne ha bisogno. Il progetto comprende un'applicazione mobile sviluppata con React Native/Expo e un backend API in Node.js con database SQLite.

## Architettura del Sistema

Il progetto è strutturato secondo un'architettura client-server:

```
┌─────────────────┐       ┌───────────────┐       ┌─────────────┐
│                 │       │               │       │             │
│  ReFood Mobile  │◄─────►│  ReFood API   │◄─────►│  Database   │
│  (React Native) │       │  (Node.js)    │       │  (SQLite)   │
│                 │       │               │       │             │
└─────────────────┘       └───────────────┘       └─────────────┘
```

### Componenti Principali

1. **Frontend Mobile (refood-mobile)**
   - Sviluppato con React Native ed Expo
   - Implementa l'interfaccia utente e l'esperienza di navigazione
   - Comunicazione con il backend tramite API REST

2. **Backend API (backend)**
   - Sviluppato con Node.js ed Express
   - Fornisce API RESTful per tutte le funzionalità
   - Gestisce autenticazione, autorizzazione e logica di business

3. **Database (SQLite)**
   - Memorizza tutti i dati dell'applicazione
   - Struttura relazionale con tabelle per utenti, centri, lotti, ecc.
   - Manutenzione automatica tramite script pianificati

4. **Sistema di Manutenzione Automatica**
   - Script di manutenzione periodica del database
   - Gestione automatizzata degli stati dei lotti
   - Sistema di backup e monitoraggio dell'integrità

## Struttura del Progetto

```
├── backend/                    # Backend API
│   ├── src/                    # Codice sorgente
│   ├── database/               # Connessione al database
│   ├── migrations/             # Migrazioni del database
│   ├── .env                    # Variabili d'ambiente
│   └── package.json            # Dipendenze backend
│
├── refood-mobile/              # Applicazione mobile
│   ├── src/                    # Codice sorgente React Native
│   ├── app/                    # Struttura di navigazione Expo Router
│   ├── components/             # Componenti UI riutilizzabili
│   ├── hooks/                  # React hooks personalizzati
│   ├── constants/              # Costanti dell'applicazione
│   └── assets/                 # Risorse statiche (immagini, font)
│
├── database/                   # Database SQLite
│   └── refood.db               # File del database
│
├── docs/                       # Documentazione
│   ├── frontend/               # Documentazione frontend
│   ├── technical_overview.md   # Panoramica tecnica
│   ├── api_endpoints.md        # Documentazione API
│   ├── schema_description.md   # Descrizione schema DB
│   └── ...                     # Altre documentazioni
│
├── maintenance_scripts/        # Script di manutenzione
│   ├── update_lotti_status.sql # Aggiornamento stato lotti
│   ├── cleanup_tokens.sql      # Pulizia token scaduti
│   └── ...                     # Altri script di manutenzione
│
└── schema.sql                  # Schema completo del database
```

## Funzionalità Principali

### 1. Gestione degli Utenti e Autenticazione
- Sistema di registrazione e login
- Autenticazione JWT con token di accesso e refresh
- Gestione dei ruoli (Amministratore, UTENTE, CENTRO_SOCIALE, CENTRO_RICICLAGGIO)
- Profili utente personalizzati

### 2. Gestione dei Centri
- Registrazione e gestione dei centri di distribuzione
- Associazione operatori ai centri
- Visualizzazione delle informazioni e statistiche dei centri

### 3. Sistema di Gestione dei Lotti
- Inserimento e tracciamento dei lotti alimentari
- Sistema di stati basato sulle scadenze (Verde, Arancione, Rosso)
- Categorizzazione dei lotti per tipo di alimento
- Tracciamento completo della storia del lotto

### 4. Sistema di Prenotazione
- Richiesta di prenotazione dei lotti disponibili
- Approvazione/rifiuto delle prenotazioni
- Gestione del ritiro e della consegna
- Stati della prenotazione con timestamp

### 5. Dashboard e Statistiche
- Statistiche sull'impatto ambientale
- Monitoraggio della quantità di cibo salvata
- Calcolo della CO2 risparmiata
- Reportistica settimanale automatica

### 6. Sistema di Manutenzione Automatica
- Aggiornamento periodico degli stati dei lotti
- Pulizia dei token di autenticazione scaduti
- Generazione automatica di statistiche
- Verifica dell'integrità del database

## Flussi Principali

### Flusso Gestione Lotti
```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│          │     │          │     │          │     │          │
│  Ingresso│────►│ Stoccaggio│────►│ Scadenza │────►│Riciclaggio│
│   Lotto  │     │(Verde)   │     │(Rosso)   │     │          │
│          │     │          │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                     │
                     │
                     ▼
                ┌──────────┐
                │          │
                │ Richiesta│
                │(Arancione)│
                │          │
                └──────────┘
```

### Flusso Prenotazioni
```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│          │     │          │     │          │     │          │
│ Richiesta│────►│Approvazione│───►│  Ritiro  │────►│ Consegna │
│          │     │          │     │          │     │          │
│          │     │          │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
      │                 │
      │                 │
      ▼                 ▼
┌──────────┐     ┌──────────┐
│          │     │          │
│  Rifiuto │     │ Scadenza │
│          │     │  Ritiro  │
│          │     │          │
└──────────┘     └──────────┘
```

## Schema del Database

Il database è strutturato con le seguenti tabelle principali:

- **Utenti**: Informazioni sugli utenti del sistema
- **Centri**: Informazioni sui centri (sociali o di riciclaggio)
- **UtentiCentri**: Associazione tra utenti e centri (N:M)
- **Lotti**: Dati sui lotti alimentari
- **CategorieAlimenti**: Categorie di alimenti
- **LottiCategorie**: Associazione tra lotti e categorie (N:M)
- **Prenotazioni**: Prenotazioni dei lotti
- **StatiLotto**: Stati possibili di un lotto
- **StatiPrenotazione**: Stati possibili di una prenotazione
- **LogCambioStato**: Storico dei cambiamenti di stato
- **TokenAutenticazione**: Token JWT per l'autenticazione
- **TokenRevocati**: Token revocati prima della scadenza
- **StatisticheCentro**: Statistiche accumulate per centro
- **ParametriSistema**: Parametri configurabili del sistema

## Sistema di Manutenzione Automatica

Il sistema include procedure automatizzate per la manutenzione del database:

1. **Aggiornamento Stato Lotti**
   - Frequenza: Giornaliera (00:10)
   - Aggiorna lo stato dei lotti in base alla data di scadenza

2. **Pulizia Token Scaduti**
   - Frequenza: Giornaliera (02:00)
   - Rimuove i token di autenticazione scaduti

3. **Statistiche Settimanali**
   - Frequenza: Settimanale (lunedì alle 01:00)
   - Genera statistiche per ogni tipo di utente

4. **Aggiornamento Stato Prenotazioni**
   - Frequenza: Ogni ora
   - Gestisce automaticamente le prenotazioni scadute

5. **Verifica Integrità Database**
   - Frequenza: Settimanale (domenica alle 03:00)
   - Controlla e corregge problemi di integrità referenziale

## Stack Tecnologico

### Frontend Mobile
- React Native / Expo
- Expo Router
- React Native Paper (UI)
- Axios (HTTP client)
- AsyncStorage
- TypeScript

### Backend
- Node.js
- Express
- SQLite
- JSON Web Token (JWT)
- bcrypt
- Winston (logging)
- node-cron

## Configurazione e Installazione

### Configurazione Mobile
```bash
cd refood-mobile
npm install
npx expo start
```

### Configurazione Backend
```bash
cd backend
npm install
npm run dev
```

### Installazione Sistema di Manutenzione
```bash
./install_maintenance_cron.sh
```

## Sicurezza e Performance

Il sistema implementa diverse misure per garantire sicurezza e performance:

- **Autenticazione JWT** con refresh token
- **Hashing** delle password con bcrypt
- **Validazione** di tutti gli input
- **Rate limiting** per prevenire attacchi
- **Ottimizzazione delle query** database
- **Caching** delle risorse frequentemente utilizzate
- **Paginazione** per gestire grandi set di dati

## Requisiti di Sistema

### Mobile
- Node.js v16+
- Expo CLI
- Dispositivo iOS/Android o emulatore

### Backend
- Node.js v16+
- SQLite
- Spazio disco sufficiente per il database e i log

## Logging e Monitoraggio

Il sistema mantiene log dettagliati delle operazioni:

- Log delle operazioni API nel backend
- Log delle esecuzioni degli script di manutenzione
- Log dei cambiamenti di stato dei lotti e prenotazioni
- Statistiche periodiche automatizzate

## Backup e Ripristino

Procedure consigliate per il backup:

```bash
sqlite3 database/refood.db .dump > backup/refood_backup_$(date +%Y%m%d).sql
```

Per il ripristino:

```bash
sqlite3 database/refood.db < backup/refood_backup_<data>.sql
```

## Conclusione

ReFood è un sistema completo e scalabile che affronta il problema dello spreco alimentare con un'architettura robusta e moderne tecnologie di sviluppo. La combinazione di un'app mobile intuitiva e un backend potente permette una gestione efficiente dell'intero ciclo di vita dei lotti alimentari, dalla produzione al consumo o riciclaggio, contribuendo significativamente alla riduzione dello spreco alimentare. 