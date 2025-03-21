# ReFood

ReFood è un'applicazione per la gestione e la distribuzione di alimenti in eccedenza, con l'obiettivo di ridurre lo spreco alimentare e aiutare chi ne ha bisogno.

## Struttura del Progetto

Il progetto è diviso in due parti principali:

- **refood-mobile**: Applicazione mobile sviluppata con React Native e Expo
- **backend**: API REST sviluppata con Node.js

## Funzionalità Principali

- Gestione dei centri di distribuzione
- Tracciamento dei lotti alimentari
- Sistema di prenotazione
- Dashboard amministrativa
- Monitoraggio delle scadenze

## Documentazione

Il progetto include documentazione dettagliata:

### Panoramica Tecnica
- [Panoramica Tecnica Generale](docs/technical_overview.md) - Visione d'insieme del progetto

### Documentazione Backend
- [Architettura Backend](docs/backend_architecture.md) - Struttura e componenti del backend
- [API Endpoints](docs/api_endpoints.md) - Descrizione dettagliata delle API
- [JWT Authentication](docs/jwt_authentication.md) - Sistema di autenticazione
- [Schema Database](docs/schema_description.md) - Struttura del database

### Documentazione Frontend
- [Architettura Frontend](docs/frontend/architecture.md) - Struttura e componenti del frontend
- [Guida alle Schermate](docs/frontend/screens.md) - Descrizione delle principali schermate
- [Servizi API](docs/frontend/api-services.md) - Interazione con il backend

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

## Contribuire al Progetto

Se desideri contribuire al progetto:

1. Clona il repository
2. Crea un branch per la tua feature (`git checkout -b feature/nome-feature`)
3. Fai commit delle tue modifiche (`git commit -am 'Aggiungi una feature'`)
4. Pusha il branch (`git push origin feature/nome-feature`)
5. Apri una Pull Request

## Licenza

Questo progetto è stato sviluppato per scopi accademici. 