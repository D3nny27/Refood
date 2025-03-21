# Servizi API - ReFood Mobile

Questo documento descrive i principali servizi API utilizzati dall'applicazione mobile per comunicare con il backend.

## Panoramica

L'applicazione mobile utilizza i servizi API per eseguire operazioni CRUD (Create, Read, Update, Delete) sulle principali entità del sistema. Tutti i servizi seguono una struttura comune:

- Utilizzo di Axios per le chiamate HTTP
- Gestione centralizzata degli errori
- Normalizzazione dei dati ricevuti
- Memorizzazione in cache quando appropriato
- Gestione dei token di autenticazione

## Configurazione Globale

Le chiamate API sono configurate con impostazioni globali definite in `src/config/constants.ts`:

```typescript
export const API_URL = 'https://api.refood.it/api/v1';
export const API_TIMEOUT = 15000; // 15 secondi
export const DATA_FRESHNESS_THRESHOLD = 5 * 60 * 1000; // 5 minuti
```

## Principali Servizi API

### AuthService

**File:** `src/services/authService.ts`

**Responsabilità:**
- Gestione dell'autenticazione (login/logout)
- Verifica dello stato dell'autenticazione
- Gestione dei token JWT
- Persistenza dei dati utente

**Principali Funzioni:**
- `loginUser(email: string, password: string)`: Esegue il login e ottiene un token
- `logoutUser()`: Revoca il token e cancella i dati dell'utente
- `checkUserAuth()`: Verifica se l'utente è autenticato
- `saveToken(token: string)`: Salva il token in modo sicuro
- `getActiveToken()`: Recupera il token attivo
- `setAuthToken(token: string)`: Configura Axios con il token

**Strutture Dati:**
```typescript
interface Utente {
  id: number;
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;
}

interface LoginResponse {
  token: string;
  utente: Utente;
}
```

### LottiService

**File:** `src/services/lottiService.ts`

**Responsabilità:**
- Recupero dei lotti alimentari
- Creazione di nuovi lotti
- Filtraggio dei lotti per vari parametri
- Gestione della cache dei dati

**Principali Funzioni:**
- `getLotti(filtri?: LottoFiltri, forceRefresh = false)`: Ottiene la lista dei lotti con filtri opzionali
- `getLottoById(id: number)`: Recupera un singolo lotto per ID
- `createLotto(lotto: Omit<Lotto, 'id' | 'stato'>)`: Crea un nuovo lotto
- `getLottiDisponibili(filtri?: LottoFiltri)`: Recupera i lotti disponibili per prenotazione
- `invalidateCache()`: Invalida la cache locale

**Strutture Dati:**
```typescript
interface Lotto {
  id: number;
  nome: string;
  descrizione?: string;
  quantita: number;
  unita_misura: string;
  data_inserimento?: string;
  data_scadenza: string;
  centro_id: number;
  centro_nome?: string;
  stato: 'Verde' | 'Arancione' | 'Rosso';
  categorie?: string[];
  origine?: string;
}

interface LottoFiltri {
  stato?: string;
  centro_id?: number;
  categoria?: string;
  scadenza_min?: string;
  scadenza_max?: string;
  cerca?: string;
}
```

### PrenotazioniService

**File:** `src/services/prenotazioniService.ts`

**Responsabilità:**
- Gestione delle prenotazioni dei lotti
- Recupero dello storico prenotazioni
- Aggiornamento dello stato delle prenotazioni

**Principali Funzioni:**
- `getPrenotazioni(filtri?)`: Recupera le prenotazioni dell'utente
- `getPrenotazioneById(id: number)`: Ottiene i dettagli di una prenotazione
- `createPrenotazione(prenotazione)`: Crea una nuova prenotazione
- `updatePrenotazioneStato(id: number, stato: string)`: Aggiorna lo stato di una prenotazione
- `getPrenotazioniStorico()`: Recupera lo storico delle prenotazioni

**Strutture Dati:**
```typescript
interface Prenotazione {
  id: number;
  lotto_id: number;
  lotto_nome?: string;
  centro_richiedente_id: number;
  centro_richiedente_nome?: string;
  data_richiesta: string;
  data_ritiro?: string;
  stato: 'Richiesta' | 'Confermata' | 'Completata' | 'Annullata';
  note?: string;
}
```

### CentriService

**File:** `src/services/centriService.ts`

**Responsabilità:**
- Gestione dei centri (sociali e riciclaggio)
- Assegnazione di operatori ai centri
- Recupero di statistiche specifiche per centro

**Principali Funzioni:**
- `getCentri(filtri?)`: Recupera tutti i centri
- `getCentroById(id: number)`: Ottiene i dettagli di un centro
- `createCentro(centro)`: Crea un nuovo centro
- `updateCentro(id: number, centro)`: Aggiorna un centro esistente
- `getCentroOperatori(id: number)`: Recupera gli operatori di un centro
- `associaOperatoriCentro(centroId: number, operatoriIds: number[])`: Associa operatori a un centro

**Strutture Dati:**
```typescript
interface Centro {
  id: number;
  nome: string;
  indirizzo: string;
  telefono: string;
  email: string;
  tipo: 'CentroSociale' | 'CentroRiciclaggio';
  operatori_assegnati?: number;
}

interface Operatore {
  id: number;
  nome: string;
  cognome: string;
  email: string;
  assegnato: boolean;
}
```

## Gestione degli Errori

I servizi API includono una gestione centralizzata degli errori che:

1. Rileva errori di connessione (timeout, server non raggiungibile)
2. Gestisce errori di autenticazione (401 - token non valido o scaduto)
3. Gestisce errori di autorizzazione (403 - permessi insufficienti)
4. Traduce i messaggi di errore dal server in messaggi user-friendly
5. Fornisce una traccia di debug dettagliata in console

Esempio di gestione errori:

```typescript
try {
  // Chiamata API
} catch (error: any) {
  if (error.response) {
    // Il server ha risposto con un codice di errore
    switch (error.response.status) {
      case 401:
        throw new Error('Sessione scaduta. Effettua nuovamente il login.');
      case 403:
        throw new Error('Non hai i permessi necessari per questa operazione.');
      case 404:
        throw new Error('Risorsa non trovata.');
      default:
        throw new Error(`Errore dal server: ${error.response.data?.message || 'Errore sconosciuto'}`);
    }
  } else if (error.code === 'ECONNABORTED') {
    throw new Error('Timeout della richiesta. Verifica la connessione al server.');
  } else if (error.request) {
    throw new Error('Nessuna risposta dal server. Verifica la connessione di rete.');
  }
  throw error;
}
```

## Cache delle Richieste

Per ottimizzare le prestazioni e ridurre il traffico di rete, alcuni servizi implementano un sistema di cache:

1. I dati vengono memorizzati in strutture in memoria con timestamp
2. Le richieste successive controllano la freschezza dei dati
3. I dati vengono riutilizzati se non sono più vecchi di una soglia configurata
4. È possibile forzare un aggiornamento ignorando la cache
5. La cache viene invalidata automaticamente dopo operazioni di modifica

## Normalizzazione Dati

I servizi API includono funzioni per normalizzare i dati ricevuti dal server:

```typescript
export const normalizeLotto = (lotto: any): Lotto => {
  return {
    id: lotto.id,
    nome: lotto.prodotto || lotto.nome || 'Senza nome',
    descrizione: lotto.descrizione || '',
    quantita: parseFloat(lotto.quantita) || 0,
    unita_misura: lotto.unita_misura || 'pz',
    data_scadenza: lotto.data_scadenza,
    centro_id: lotto.centro_origine_id || lotto.centro_id || 0,
    stato: lotto.stato || 'Verde',
    // ... altre proprietà
  };
}; 