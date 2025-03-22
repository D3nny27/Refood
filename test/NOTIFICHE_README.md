# Sistema di Notifiche ReFood Mobile

Questa documentazione fornisce una panoramica completa del sistema di notifiche implementato nell'app ReFood Mobile, che combina notifiche in-app con notifiche push.

## Architettura del Sistema di Notifiche

Il sistema di notifiche è composto da diverse componenti integrate:

1. **Push Notification Service**: Gestisce la registrazione e la ricezione di notifiche push utilizzando Expo Notifications.
2. **Contesto Notifiche**: Fornisce un accesso centralizzato ai dati delle notifiche attraverso React Context.
3. **Servizio Notifiche**: Gestisce la comunicazione con il backend per recuperare e aggiornare le notifiche.
4. **Componenti UI**: Visualizzano le notifiche all'utente e consentono interazioni.
5. **Server Stub di Test**: Fornisce un ambiente isolato per testare le funzionalità di notifica.

## Configurazione e Prerequisiti

### Dipendenze

Le seguenti dipendenze sono necessarie per il funzionamento del sistema di notifiche:

- `expo-notifications`: Per la gestione delle notifiche push.
- `expo-device`: Per identificare il dispositivo.
- `react-native-toast-message`: Per le notifiche toast in-app.

### Configurazione

In modalità di sviluppo con Expo Go, il sistema utilizzerà automaticamente le API di Expo per le notifiche. In produzione, è necessario:

1. Impostare un ID progetto Expo valido.
2. Configurare il backend per inviare notifiche push.

## Componenti Principali

### Push Notification Service

Il servizio `pushNotificationService.ts` offre le seguenti funzionalità:

- Registrazione del dispositivo per ricevere notifiche push
- Creazione di canali di notifica (Android)
- Invio di notifiche locali per testing
- Gestione delle notifiche in background e in foreground
- Dismissione delle notifiche attive

### Contesto delle Notifiche

Il `NotificheContext` fornisce uno stato globale per le notifiche con:

- Conteggio delle notifiche non lette
- Elenco completo delle notifiche
- Funzioni per caricare, aggiornare e segnare le notifiche come lette

### Interfaccia Utente

Le notifiche sono visualizzate in due modi:

1. **Schermata Notifiche**: Visualizza un elenco completo con filtri per tipo, priorità e stato.
2. **Badge Notifiche**: Mostra il conteggio delle notifiche non lette nella tab bar.

## Funzionalità Implementate

### Notifiche Push

- Registrazione automatica quando l'utente è autenticato
- Gestione token push per identificare il dispositivo
- Routing automatico in base al tipo di notifica

### Notifiche In-App

- Elenco di notifiche con pull-to-refresh
- Filtri per tipo, priorità e stato (letta/non letta)
- Indicatori visivi per notifiche non lette
- Possibilità di segnare tutte le notifiche come lette

### Resilienza e Gestione Errori

- Gestione degli errori di rete e del server
- Fallback automatico per endpoint mancanti
- Feedback visivo in caso di errori
- Retry automatico per operazioni fallite

## Test del Sistema di Notifiche

### Server Stub

È disponibile un server stub per testare il sistema di notifiche in modo isolato:

1. Entra nella cartella `test`: `cd test`
2. Installa le dipendenze: `npm install`
3. Avvia il server: `node stub-notification-server.js`
4. Modifica temporaneamente `API_URL` in `constants.ts` per puntare a `http://localhost:3001/api/v1`

### Test Notifiche Locali

L'app include un pulsante "Test Notifica" nella schermata delle notifiche che invia una notifica locale per verificare il corretto funzionamento del sistema.

### Test Notifiche Push Remote

Per testare le notifiche push remote:

1. Ottieni il token push dall'app (viene loggato in console)
2. Usa lo script `test-push.js` nella cartella `test` per inviare una notifica di test:
   ```
   node test-push.js
   ```
3. Aggiorna il token nello script con quello ottenuto dall'app

## Risoluzione Problemi

### Problemi Comuni e Soluzioni

1. **Notifiche non arrivano in background**:
   - Verifica che l'app sia configurata per le notifiche in background
   - Su Android, controlla che il canale di notifica sia creato correttamente

2. **Token push non generato**:
   - In sviluppo: L'app utilizza Expo Go che ha limitazioni con SDK 53+
   - In produzione: Verifica che l'ID progetto Expo sia corretto

3. **Errori API 404**:
   - Utilizza il server stub per i test
   - Verifica che gli endpoint richiesti esistano nel backend

## Cose da Fare in Produzione

1. Sostituire l'ID progetto Expo di test con quello reale in `pushNotificationService.ts`
2. Creare una build di produzione con `eas build` per supportare completamente le notifiche push
3. Configurare il backend per inviare notifiche push utilizzando i token memorizzati

## Note

A partire da SDK 53, Expo Go ha rimosso il supporto completo per notifiche push, quindi per un test completo è necessario creare una build di sviluppo personalizzata con `eas build --profile development`. 