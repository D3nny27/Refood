# Documentazione del NotificheContext

## Introduzione

`NotificheContext` è un componente React Context che gestisce le notifiche dell'applicazione ReFood. Coordina il sistema di notifiche in tempo reale tramite WebSocket, le notifiche push, la sincronizzazione locale/remota e fornisce un'API unificata per gestire le notifiche nell'app.

## Architettura

Il context funziona come intermediario tra il servizio WebSocket, il servizio notifiche e i componenti UI:

```
┌─────────────────┐     ┌───────────────────┐
│                 │     │                   │
│ WebSocketService│────►│  NotificheContext │
│                 │     │                   │
└─────────────────┘     └─────────┬─────────┘
                                  │
┌─────────────────┐               │
│                 │               │
│ notificheService│───────────────┘
│                 │
└─────────────────┘
        ▲
        │
┌───────┴─────────┐
│                 │
│  Backend API    │
│                 │
└─────────────────┘
```

## Interfacce

### NotificheContextType
```typescript
interface NotificheContextType {
  notifiche: Notifica[];
  nonLette: number;
  loading: boolean;
  error: string | null;
  caricaNotifiche: (page?: number, limit?: number, filtri?: NotificaFiltri) => Promise<void>;
  segnaComeLetta: (notificaId: number) => Promise<boolean>;
  segnaTutteLette: () => Promise<boolean>;
  eliminaNotifica: (notificaId: number) => Promise<boolean>;
  refreshNotifiche: () => Promise<void>;
  aggiornaConteggio: () => Promise<void>;
  segnalaComeLetta: (id: number) => Promise<void>;
  syncLocalNotificheToServer: () => Promise<number>;
  wsConnected: boolean;
}
```

### Notifica
```typescript
interface Notifica {
  id: number;
  titolo: string;
  messaggio: string;
  data: string;
  letta: boolean;
  priorita: 'Bassa' | 'Media' | 'Alta';
  link?: string;
  tipo?: string;
  dataLettura?: string;
}
```

### NotificaFiltri
```typescript
interface NotificaFiltri {
  letta?: boolean;
  priorita?: string;
  tipo?: string;
  dataInizio?: string;
  dataFine?: string;
}
```

## Funzionalità principali

### Gestione delle notifiche in tempo reale
- Sottoscrizione ai messaggi WebSocket
- Aggiornamento immediato dell'interfaccia quando arrivano nuove notifiche
- Indicatore di stato della connessione WebSocket

### Gestione delle notifiche locali
- Memorizzazione locale delle notifiche
- Sincronizzazione con il server quando la connessione è disponibile
- Conteggio delle notifiche non lette

### Operazioni sulle notifiche
- Segnare una notifica come letta
- Segnare tutte le notifiche come lette
- Eliminare una notifica
- Aggiornare il conteggio delle notifiche non lette

## Implementazione

### Provider
Il provider del contesto configura i listener, lo stato iniziale e gestisce il ciclo di vita delle notifiche:

```typescript
export const NotificheProvider: React.FC<NotificheProviderProps> = ({ children }) => {
  // Stato
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
  const [nonLette, setNonLette] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  
  // Riferimento alla sottoscrizione WebSocket
  const wsSubscriptionRef = React.useRef<Subscription | null>(null);
  
  // Funzioni e handlers
  // ...
  
  return (
    <NotificheContext.Provider value={value}>
      {children}
    </NotificheContext.Provider>
  );
}
```

### Gestione dei messaggi WebSocket

Il provider gestisce diversi tipi di messaggi WebSocket:

```typescript
const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
  switch (message.type) {
    case WebSocketEvent.CONNECT:
      setWsConnected(true);
      break;
      
    case WebSocketEvent.DISCONNECT:
      setWsConnected(false);
      break;
      
    case WebSocketEvent.NOTIFICATION:
      // Gestione di una nuova notifica
      const nuovaNotifica = message.payload.notifica as Notifica;
      // Aggiornamento dello stato...
      break;
      
    case WebSocketEvent.LOTTO_UPDATE:
    case WebSocketEvent.PRENOTAZIONE_UPDATE:
      // Gestione di altri tipi di eventi...
      break;
  }
}, []);
```

### Inizializzazione del WebSocket

```typescript
useEffect(() => {
  if (!isAuthenticated) return;
  
  // Chiudi eventuali connessioni esistenti
  if (wsSubscriptionRef.current) {
    wsSubscriptionRef.current.unsubscribe();
    wsSubscriptionRef.current = null;
  }
  
  // Sottoscrizione ai messaggi WebSocket
  wsSubscriptionRef.current = websocketService.getMessages().subscribe(
    handleWebSocketMessage,
    error => {
      console.error('Errore nella sottoscrizione WebSocket:', error);
    }
  );
  
  // Avvia la connessione
  websocketService.connect().catch(err => {
    console.error('Errore nella connessione WebSocket:', err);
  });
  
  return () => {
    // Pulizia alla chiusura
    if (wsSubscriptionRef.current) {
      wsSubscriptionRef.current.unsubscribe();
      wsSubscriptionRef.current = null;
    }
    websocketService.disconnect();
  };
}, [isAuthenticated, handleWebSocketMessage]);
```

## Hook personalizzato

Per utilizzare il contesto nei componenti:

```typescript
export const useNotifiche = () => useContext(NotificheContext);
```

## Esempi di utilizzo

### Utilizzo base nel componente

```typescript
function NotificheScreen() {
  const { notifiche, nonLette, loading, error, segnaComeLetta } = useNotifiche();
  
  const handleNotificaPress = async (notifica: Notifica) => {
    if (!notifica.letta) {
      await segnaComeLetta(notifica.id);
    }
    // Altra logica...
  };
  
  return (
    <View>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={notifiche}
          renderItem={({ item }) => (
            <NotificaItem 
              notifica={item} 
              onPress={() => handleNotificaPress(item)}
            />
          )}
        />
      )}
    </View>
  );
}
```

### Visualizzazione del contatore di notifiche

```typescript
function NotificationBadge() {
  const { nonLette, wsConnected } = useNotifiche();
  
  return (
    <View style={styles.container}>
      <Ionicons 
        name="notifications-outline" 
        size={24} 
        color={wsConnected ? "green" : "gray"} 
      />
      {nonLette > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{nonLette}</Text>
        </View>
      )}
    </View>
  );
}
```

## Gestione degli errori

Il contesto gestisce diversi scenari di errore:

1. **Errori di connessione WebSocket**: Fallback al polling tradizionale
2. **Errori di caricamento notifiche**: Mostrati all'utente con opzione per riprovare
3. **Errori di sincronizzazione**: Tentativi automatici quando la connessione è ripristinata

## Sincronizzazione offline

Per garantire che le notifiche funzionino anche in ambiente offline:

1. Le operazioni di lettura/eliminazione vengono memorizzate localmente
2. Quando la connessione è disponibile, `syncLocalNotificheToServer()` sincronizza le modifiche
3. Un sistema di polling di fallback viene attivato quando il WebSocket non è disponibile

## Best Practices

1. **Sempre utilizzare l'hook**: Accedere alle notifiche sempre tramite il hook `useNotifiche()`
2. **Gestire stati di loading/error**: Sempre mostrare feedback all'utente durante caricamento
3. **Preferire WebSocket**: Utilizzare il meccanismo in tempo reale quando possibile
4. **Minimizzare aggiornamenti**: Usare `refreshNotifiche()` solo quando necessario
5. **Gestire ciclo di vita**: Assicurarsi che le sottoscrizioni vengano sempre pulite 