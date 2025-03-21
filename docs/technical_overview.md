# Panoramica Tecnica del Progetto ReFood

## Introduzione

ReFood è un sistema completo per la gestione e la distribuzione di alimenti in eccedenza, progettato per ridurre lo spreco alimentare e ottimizzare la distribuzione di cibo a chi ne ha bisogno. Il sistema consiste in un'applicazione mobile cross-platform per gli utenti finali e un backend API che gestisce la logica di business e la persistenza dei dati.

## Architettura del Sistema

ReFood utilizza un'architettura client-server moderna:

```
┌─────────────────┐       ┌───────────────┐       ┌─────────────┐
│                 │       │               │       │             │
│  ReFood Mobile  │◄─────►│  ReFood API   │◄─────►│  Database   │
│  (React Native) │       │  (Node.js)    │       │  (SQLite)   │
│                 │       │               │       │             │
└─────────────────┘       └───────────────┘       └─────────────┘
```

### ReFood Mobile (Frontend)

L'applicazione mobile è sviluppata utilizzando React Native ed Expo, permettendo il deployment su dispositivi iOS e Android da una singola codebase. L'architettura frontend segue i principi di:

- **Component-Based Design**: UI modulare e riutilizzabile
- **State Management**: Tramite React Context API per lo stato globale
- **Service Layer**: Per l'interazione con le API backend
- **Responsive Design**: Adattabile a diverse dimensioni di schermo
- **File-Based Routing**: Con Expo Router per una navigazione naturale

### ReFood API (Backend)

Il backend è un server Node.js con Express che fornisce API RESTful per tutte le funzionalità dell'applicazione. L'architettura backend implementa:

- **MVC Pattern**: Separazione di Model, Controller e Routes
- **Middleware Design**: Per autenticazione, validazione e gestione errori
- **Data Access Layer**: Per l'interazione con il database SQLite
- **Scheduler**: Per processi automatizzati (aggiornamento stati, archiviazione, statistiche)
- **Security Layer**: Autenticazione JWT, protezione CORS, validazione input

### Database

Il sistema utilizza SQLite come database relazionale, scelto per:
- Leggerezza e portabilità
- Bassa manutenzione richiesta
- Buone prestazioni per il carico di lavoro previsto
- Supporto nativo per transazioni ACID

## Stack Tecnologico

### Frontend (ReFood Mobile)

- **React Native**: Framework per lo sviluppo mobile cross-platform
- **Expo**: Toolchain per lo sviluppo React Native
- **Expo Router**: Sistema di routing basato su file
- **React Native Paper**: UI kit basato su Material Design
- **Axios**: Client HTTP per le chiamate API
- **AsyncStorage**: Persistenza dei dati locale
- **TypeScript**: Per type safety e developer experience migliorata

### Backend (ReFood API)

- **Node.js**: Runtime JavaScript lato server
- **Express**: Framework web per API
- **SQLite**: Database relazionale
- **JSON Web Token (JWT)**: Per l'autenticazione sicura
- **node-cron**: Per la pianificazione di attività
- **Winston**: Per il logging strutturato
- **bcrypt**: Per l'hashing sicuro delle password
- **Swagger/OpenAPI**: Per la documentazione delle API

## Flussi Principali

### 1. Gestione dei Lotti Alimentari

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

1. Un operatore inserisce un nuovo lotto nel sistema
2. Il lotto viene classificato automaticamente in base alla scadenza
3. I centri sociali possono prenotare lotti disponibili
4. Lo stato del lotto viene aggiornato automaticamente nel tempo
5. I lotti scaduti vengono assegnati ai centri di riciclaggio

### 2. Sistema di Prenotazione

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

1. Un centro sociale prenota un lotto disponibile
2. Il centro di origine approva o rifiuta la prenotazione
3. Viene pianificato il ritiro entro un termine prestabilito
4. Al ritiro, lo stato della prenotazione viene aggiornato
5. Alla consegna al destinatario, la prenotazione è completata

### 3. Flusso di Autenticazione

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│          │     │          │     │          │
│  Login   │────►│ Verifica │────►│  Accesso │
│          │     │  Token   │     │ Funzioni │
│          │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘
                     │
                     │
                     ▼
                ┌──────────┐
                │          │
                │ Refresh  │
                │  Token   │
                │          │
                └──────────┘
```

1. L'utente effettua il login con credenziali
2. Il server genera e restituisce token JWT
3. Le richieste successive includono il token negli header
4. Il token viene verificato ad ogni richiesta protetta
5. Quando il token sta per scadere, viene refreshato automaticamente

## Modello dei Dati

### Principali Entità

- **Utenti**: Account con ruoli differenziati (Admin, Operatore, Centro)
- **Centri**: Luoghi fisici (Centri Sociali, Centri di Riciclaggio)
- **Lotti**: Unità di cibo con stato, scadenza e caratteristiche
- **Prenotazioni**: Richieste di lotti con stato di avanzamento
- **Categorie**: Classificazione dei tipi di alimenti

### Relazioni Chiave

- Un **Centro** può avere molti **Operatori** (N:M tramite UtentiCentri)
- Un **Centro** può gestire molti **Lotti** (1:N)
- Un **Lotto** può appartenere a più **Categorie** (N:M tramite LottiCategorie)
- Un **Centro** può effettuare molte **Prenotazioni** (1:N)
- Una **Prenotazione** si riferisce a un **Lotto** specifico (N:1)

## Sicurezza e Performance

### Sicurezza

- **Autenticazione**: Sistema JWT con refresh token
- **Autorizzazione**: Controllo granulare basato su ruoli
- **Protezione Input**: Validazione e sanificazione di tutti gli input
- **Protezione Password**: Hashing con bcrypt e salt
- **HTTPS**: Comunicazioni criptate tra client e server
- **Rate Limiting**: Protezione contro attacchi brute force

### Performance

- **API Caching**: Riduzione del carico sul server
- **Lazy Loading**: Caricamento di dati e risorse solo quando necessario
- **Pagination**: Per gestire grandi set di dati
- **Ottimizzazione Query**: Indici e join efficienti nel database
- **Compressione**: Riduzione della quantità di dati trasferiti

## Scalabilità e Manutenibilità

Il sistema è progettato per essere facilmente scalabile e manutenibile:

- **Architettura Modulare**: Componenti separati con responsabilità chiare
- **API Versioning**: Supporto per evoluzione dell'API senza breaking changes
- **Code Standardization**: Consistent coding standards and patterns
- **Automated Testing**: Unit and integration tests
- **Documentation**: Comprehensive API and codebase documentation
- **Monitoring**: System health and performance monitoring
- **CI/CD**: Automated deployment pipelines

## Funzionalità Future Pianificate

- **Analisi Avanzate**: Dashboard con metriche di impatto ambientale
- **Integrazione Mappe**: Visualizzazione geografica dei centri
- **Notifiche Push**: Avvisi in tempo reale per eventi importanti
- **Condivisione Social**: Promozione dell'impatto positivo
- **API Integrazione**: Connessione con altri servizi di food sharing
- **Machine Learning**: Previsione della domanda e ottimizzazione distribuzione

## Conclusione

ReFood è un sistema completo e scalabile che sfrutta tecnologie moderne per affrontare il problema dello spreco alimentare. L'architettura client-server, combinata con un'esperienza utente intuitiva, fornisce una soluzione efficace per gestire l'intero ciclo di vita dei lotti alimentari, dalla produzione al consumo o riciclaggio. 