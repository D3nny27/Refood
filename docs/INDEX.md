# Documentazione ReFood

Benvenuti nella documentazione del progetto ReFood. Questa guida fornisce una panoramica completa dell'architettura, delle funzionalità e delle linee guida di implementazione del sistema.

## Indice

### Panoramica

- [Panoramica Tecnica](technical_overview.md) - Visione d'insieme dell'architettura e stack tecnologico

### Backend

- [Architettura Backend](backend_architecture.md) - Struttura e componenti principali del backend
- [API Endpoints](api_endpoints.md) - Documentazione dettagliata delle API REST
- [Sistema di Autenticazione JWT](jwt_authentication.md) - Implementazione dell'autenticazione e autorizzazione
- [Schema del Database](schema_description.md) - Descrizione delle tabelle e relazioni
- [Query di Esempio](queries_example.sql) - Query SQL di esempio per operazioni comuni

### Frontend

- [Architecture Overview](./frontend/architecture.md) - Panoramica dell'architettura frontend
- [Screens](./frontend/screens.md) - Documentazione delle schermate
- [API Services](./frontend/api-services.md) - Documentazione dei servizi API
- [WebSocket Service](./frontend/websocket-service.md) - Documentazione del sistema di comunicazione in tempo reale
- [Notifiche Context](./frontend/notifiche-context.md) - Documentazione del context per la gestione delle notifiche
- [Gestione Prenotazioni Duplicate](./frontend/duplicate-prenotazioni.md) - Documentazione sulla prevenzione delle prenotazioni duplicate

### Diagrammi

- [Diagramma ER](../er_diagram.mermaid) - Diagramma Entity-Relationship del database

### Sviluppo

- [Guida al Contributo](CONTRIBUTING.md) - Linee guida per contribuire al progetto
- [Standard di Codice](CODING_STANDARDS.md) - Convenzioni e best practices

## Come Utilizzare la Documentazione

La documentazione è organizzata per permettere diversi approcci di lettura:

1. **Per sviluppatori frontend**: Iniziate con l'architettura frontend e i servizi API
2. **Per sviluppatori backend**: Concentratevi sull'architettura backend e sugli endpoint API
3. **Per amministratori di sistema**: Revisionate l'architettura tecnica e i requisiti di sistema
4. **Per nuovi membri del team**: Seguite la documentazione in ordine, iniziando dalla panoramica tecnica

## Mantenere la Documentazione Aggiornata

La documentazione deve essere aggiornata ogni volta che vengono apportate modifiche significative al codice. Seguire queste linee guida:

1. Aggiornare la documentazione corrispondente insieme alle modifiche del codice
2. Assicurarsi che gli esempi siano funzionanti e aggiornati
3. Verificare che i diagrammi riflettano l'architettura attuale
4. Mantenere un linguaggio chiaro e conciso 