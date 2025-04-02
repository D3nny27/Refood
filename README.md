# ReFood

ReFood è un'applicazione per la gestione e la distribuzione di alimenti in eccedenza, con l'obiettivo di ridurre lo spreco alimentare e aiutare chi ne ha bisogno.

## Struttura del Progetto

Il progetto è diviso in due parti principali:

- **refood-mobile**: Applicazione mobile sviluppata con React Native e Expo
- **backend**: API REST sviluppata con Node.js

## Funzionalità Principali

- Gestione dei centri di distribuzione e riciclaggio
- Tracciamento dei lotti alimentari con sistema di stati basato sulle scadenze
- Sistema di prenotazione e consegna delle eccedenze alimentari
- Dashboard amministrativa con statistiche sull'impatto ambientale
- Sistema di notifiche in-app e push notifications
- Gestione utenti con diversi ruoli (Amministratore, UTENTE, CENTRO_SOCIALE, CENTRO_RICICLAGGIO)

## Novità Recenti

- **Sistema di Registrazione**: Implementato endpoint completo per la registrazione di nuovi utenti
- **Gestione Notifiche Migliorata**: Supporto per notifiche push e tracciamento lettura
- **Statistiche Ambientali**: Calcolo dell'impatto positivo in termini di CO2 risparmiata
- **Sistema di Manutenzione Automatica**: Script di manutenzione automatizzati per il database

## Documentazione

Il progetto include documentazione dettagliata:

### Documentazione Principale
- [Refood Documentazione Completa](Refood_documentazione.md) - Guida dettagliata all'installazione e utilizzo del sistema
- [Guida Utente](docs/user_guide.md) - Manuale d'uso per utenti finali

### Documentazione Backend
- [Architettura Backend](docs/backend_architecture.md) - Struttura e componenti del backend
- [API Endpoints](docs/api_endpoints.md) - Descrizione dettagliata delle API
- [JWT Authentication](docs/jwt_authentication.md) - Sistema di autenticazione
- [Schema Database](docs/schema_description.md) - Struttura del database
- [Sistema di Registrazione](docs/auth_registration.md) - Dettagli sull'implementazione della registrazione utenti

### Documentazione Frontend
- [Architettura Frontend](docs/frontend/architecture.md) - Struttura e componenti del frontend
- [Guida alle Schermate](docs/frontend/screens.md) - Descrizione delle principali schermate
- [Servizi API](docs/frontend/api-services.md) - Interazione con il backend
- [WebSocket Service](docs/frontend/websocket-service.md) - Comunicazione real-time
- [Notifiche Context](docs/frontend/notifiche-context.md) - Sistema di notifiche

L'indice completo della documentazione è disponibile in [docs/INDEX.md](docs/INDEX.md).

## Requisiti Tecnici

### Applicazione Mobile
- Node.js v16+
- Expo CLI
- React Native

### Backend
- Node.js v16+
- SQLite

## Installazione e Avvio

### Applicazione Mobile
```bash
cd refood-mobile
npm install
npx expo start
```

### Backend
```bash
cd backend
npm install
npm run dev
```

### Manutenzione Automatica
```bash
./install_maintenance_cron.sh
```

## Variabili d'Ambiente

### Backend (.env)
```
PORT=3000
NODE_ENV=development
DB_PATH=../database/refood.db
JWT_SECRET=your_secret_key
JWT_ACCESS_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=604800
CORS_ORIGIN=*
LOG_LEVEL=debug
API_PREFIX=/api/v1
```

### Frontend (config.ts)
```typescript
API_URL=http://192.168.123.160:3000/api/v1
```

## Contribuire al Progetto

Se desideri contribuire al progetto:

1. Clona il repository
2. Crea un branch per la tua feature (`git checkout -b feature/nome-feature`) o per la correzione di un bug (`git checkout -b bugfix/nome-bugfix`)
3. Fai commit delle tue modifiche (`git commit -am 'Aggiungi una feature'`)
4. Pusha il branch (`git push origin feature/nome-feature`)
5. Apri una Pull Request verso il branch `develop`
6. Dopo la review, le modifiche verranno integrate in `develop` e successivamente in `main` per il rilascio

## Implementazioni Future

Per conoscere le possibili implementazioni future e miglioramenti pianificati, consulta il documento [File Inutili e Implementazioni Future](docs/file_inutili_e_implementazioni_future.md).

## Licenza

Questo progetto è stato sviluppato per scopi accademici. 