# Documentazione del Sistema WebSocket

## Introduzione

Il sistema WebSocket di ReFood fornisce comunicazione in tempo reale tra client e server, permettendo l'aggiornamento immediato di notifiche, stato dei lotti e stato delle prenotazioni. È cruciale per garantire che tutti gli utenti ricevano informazioni aggiornate senza necessità di refresh manuali.

## Architettura

Il sistema è implementato attraverso una classe singleton `WebSocketService` che gestisce la connessione WebSocket, la riconnessione automatica e la distribuzione dei messaggi.

```typescript
┌───────────────────┐      ┌─────────────────────┐
│                   │      │                     │
│  WebSocketService │◄────►│  Server WebSocket   │
│                   │      │                     │
└─────────┬─────────┘      └─────────────────────┘
          │
          │
 ┌────────▼────────┐
 │                 │
 │ NotificheContext│
 │                 │
 └────────┬────────┘
          │
 ┌────────▼────────┐
 │ Componenti UI   │
 │ (Notifiche,     │
 │  Dashboard, ecc)|
 └─────────────────┘
```

## Enum e Interfacce

### WebSocketEvent
```typescript
enum WebSocketEvent {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  MESSAGE = 'message',
  ERROR = 'error',
  NOTIFICATION = 'notification',
  LOTTO_UPDATE = 'lotto_update',
  PRENOTAZIONE_UPDATE = 'prenotazione_update'
}
```

### WebSocketMessage
```typescript
interface WebSocketMessage {
  type: WebSocketEvent;
  payload: any;
  timestamp: number;
}
```

## Metodi Principali

### connect()
Inizializza la connessione WebSocket con il server utilizzando il token di autenticazione dell'utente.

```typescript
async connect(): Promise<void>
```

### disconnect()
Chiude la connessione WebSocket in modo pulito, termina i timer e resetta lo stato.

```typescript
disconnect(): void
```

### sendMessage()
Invia un messaggio al server tramite la connessione WebSocket.

```typescript
sendMessage(message: any): void
```

### getMessages()
Restituisce un observable che emette messaggi ricevuti dal server.

```typescript
getMessages(): Observable<WebSocketMessage>
```

### isConnected()
Verifica se la connessione WebSocket è attiva.

```typescript
isConnected(): boolean
```

## Gestione delle riconnessioni

Il servizio implementa una strategia di riconnessione con backoff esponenziale:

1. Quando la connessione viene persa, `handleClose()` avvia una procedura di riconnessione
2. `scheduleReconnect()` calcola il ritardo con una formula esponenziale: Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
3. I tentativi continuano fino a raggiungere `maxReconnectAttempts` (di default 5)
4. Se il server restituisce 404, viene impostato `endpointUnavailable = true` per evitare ulteriori tentativi

## Heartbeat

Per mantenere attiva la connessione WebSocket:

1. `startHeartbeat()` invia periodicamente messaggi "ping" al server
2. Il ping è inviato ogni 30 secondi quando la connessione è attiva
3. `stopHeartbeat()` interrompe il timer quando la connessione viene chiusa

## Gestione degli errori

Il servizio contiene gestori per diversi tipi di errori:

- Errori di connessione: tentativo automatico di riconnessione
- Errori di autenticazione: notifica all'utente per effettuare nuovamente l'accesso
- Endpoint non disponibile (404): interruzione dei tentativi di riconnessione
- Errori nell'elaborazione dei messaggi: log degli errori con contenuto del messaggio

## Esempi di utilizzo

### Inizializzazione del servizio

```typescript
// In un contesto React
useEffect(() => {
  if (isAuthenticated) {
    websocketService.connect();
    
    return () => {
      websocketService.disconnect();
    };
  }
}, [isAuthenticated]);
```

### Sottoscrizione ai messaggi

```typescript
const subscription = websocketService.getMessages().subscribe(
  (message) => {
    if (message.type === WebSocketEvent.NOTIFICATION) {
      // Gestisci la notifica
    } else if (message.type === WebSocketEvent.LOTTO_UPDATE) {
      // Aggiorna i dati del lotto
    }
  },
  (error) => {
    console.error('Errore nel WebSocket:', error);
  }
);

// Ricordarsi di annullare la sottoscrizione
return () => subscription.unsubscribe();
```

## Risoluzione dei problemi comuni

### La connessione WebSocket non si stabilisce

Verificare:
1. Il token di autenticazione è valido e presente
2. L'endpoint WebSocket sul server è attivo (`/api/notifications/ws`)
3. Non ci sono problemi di rete o firewall

### Messaggi WebSocket non ricevuti

Verificare:
1. La sottoscrizione all'observable `getMessages()` è attiva
2. Il tipo di messaggio è gestito correttamente
3. La connessione è attiva (utilizzare `isConnected()`)

### Errori 404 continui

Se il server restituisce costantemente errori 404:
1. Verificare che il percorso dell'endpoint WebSocket configurato sia corretto
2. Controllare che il backend supporti WebSocket all'URL specificato
3. Verificare che il server sia in esecuzione e raggiunga l'endpoint WebSocket

## Best Practices

1. **Gestione del ciclo di vita**: Connettere il WebSocket quando l'utente accede e disconnetterlo quando esce
2. **Gestione degli errori**: Implementare un sistema di fallback per quando la connessione WebSocket non è disponibile
3. **Indicatore di stato**: Mostrare all'utente lo stato della connessione WebSocket
4. **Riconnessione**: Implementare un meccanismo di riconnessione con backoff esponenziale
5. **Autenticazione**: Assicurarsi che il token di autenticazione sia valido 