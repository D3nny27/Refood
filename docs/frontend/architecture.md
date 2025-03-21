# Architettura del Frontend - ReFood Mobile

## Panoramica

L'applicazione mobile ReFood è sviluppata utilizzando React Native con Expo, che offre un ambiente di sviluppo semplificato per applicazioni cross-platform. L'architettura è progettata per essere modulare, scalabile e manutenibile, seguendo le migliori pratiche di sviluppo React Native.

## Struttura delle Directory

```
refood-mobile/
├── app/                  # Directory principale per le schermate (Expo Router)
│   ├── (tabs)/           # Schede principali dell'applicazione
│   ├── admin/            # Schermate di amministrazione
│   ├── lotti/            # Schermate di gestione lotti
│   └── _layout.tsx       # Layout principale dell'app
├── assets/               # Risorse statiche (immagini, font)
├── components/           # Componenti UI riutilizzabili
│   ├── ui/               # Componenti UI base
│   └── __tests__/        # Test unitari per i componenti
├── src/                  # Codice sorgente principale
│   ├── components/       # Componenti specifici dell'applicazione
│   ├── config/           # Configurazioni (costanti, temi)
│   ├── context/          # Context API per la gestione dello stato
│   ├── screens/          # Schermate legacy (pre-Expo Router)
│   └── services/         # Servizi per l'interazione con il backend
├── constants/            # Costanti globali dell'applicazione
└── hooks/                # Hook personalizzati React
```

## Tecnologie Principali

- **React Native**: Framework per lo sviluppo mobile cross-platform
- **Expo**: Toolchain per semplificare lo sviluppo React Native
- **Expo Router**: Sistema di routing basato su file per la navigazione
- **React Native Paper**: Libreria di componenti UI per Material Design
- **AsyncStorage**: API per la persistenza dei dati locali
- **Axios**: Client HTTP per le chiamate API

## Architettura dell'Applicazione

### Pattern di Design

L'applicazione utilizza diversi pattern di design:

1. **Context API**: Per la gestione globale dello stato dell'applicazione
2. **Custom Hooks**: Per la logica riutilizzabile
3. **Component Composition**: Per UI modulari e riutilizzabili
4. **Services**: Per l'astrazione delle chiamate API

### Gestione dello Stato

- **AuthContext**: Gestisce l'autenticazione dell'utente, token e sessioni
- **State Locali**: Per dati specifici delle schermate
- **AsyncStorage**: Per la persistenza dei dati tra le sessioni

### Sistema di Navigazione

L'app utilizza Expo Router, un sistema di routing basato su file che semplifica la navigazione tra le schermate. La struttura delle directory in `/app` definisce automaticamente le route dell'applicazione.

### Autenticazione

Il sistema di autenticazione è basato su JWT (JSON Web Token) e include:

- Login/logout
- Gestione del token
- Autorizzazione basata su ruoli
- Refresh del token
- Persistenza della sessione

### Chiamate API

Le chiamate al backend sono gestite tramite servizi dedicati nella directory `src/services`:

- **authService.ts**: Gestione autenticazione
- **lottiService.ts**: Gestione dei lotti alimentari
- **centroService.ts**: Gestione dei centri di distribuzione

Ogni servizio incapsula la logica di chiamata API, gestione degli errori e formattazione dei dati.

## Flusso Dati dell'Applicazione

1. L'utente interagisce con i componenti UI
2. I componenti chiamano funzioni dai servizi o utilizzano i context
3. I servizi comunicano con il backend tramite chiamate API
4. I dati ricevuti vengono elaborati e memorizzati nello stato dell'applicazione
5. I componenti UI si aggiornano in base ai nuovi dati

## Gestione dei Ruoli Utente

L'applicazione supporta diversi ruoli utente, ciascuno con accesso a funzionalità specifiche:

- **Amministratore**: Accesso completo a tutte le funzionalità, inclusa la gestione di utenti e centri
- **Operatore**: Gestione dei lotti alimentari e visualizzazione delle prenotazioni
- **Centro Sociale**: Prenotazione e gestione dei lotti disponibili
- **Centro Riciclaggio**: Gestione dei lotti scaduti o vicini alla scadenza

## Pattern di UI

L'interfaccia utente segue i principi del Material Design tramite React Native Paper e include:

- **Card**: Per la visualizzazione dei dati in modo coerente
- **Modali**: Per azioni o input che richiedono focus
- **Tab Navigation**: Per la navigazione principale
- **Pull-to-refresh**: Per aggiornare i dati
- **Filtri e ricerca**: Per gestire grandi set di dati 