# Sistema di Autenticazione JWT per Refood

## Introduzione

Questo documento descrive l'implementazione del sistema di autenticazione basato su JWT (JSON Web Token) per l'app Refood. Il sistema è progettato per fornire un'autenticazione stateless sicura, scalabile e conforme alle migliori pratiche di sicurezza.

## Architettura del Sistema JWT

### Struttura del Database

Il sistema di autenticazione si basa su tre componenti principali nel database:

1. **Tabella Utenti**: Memorizza le informazioni dell'utente e tiene traccia dell'ultimo accesso.
2. **Tabella TokenAutenticazione**: Gestisce i token JWT attivi, con supporto per access token e refresh token.
3. **Tabella TokenRevocati**: Implementa una blacklist per i token revocati prima della loro scadenza naturale.
4. **Tabella ParametriSistema**: Contiene parametri configurabili per il sistema JWT (durate token, ecc.).

### Tipi di Token

Il sistema implementa due tipi di token:

- **Access Token**: Token a breve durata (default: 1 ora) utilizzato per l'autenticazione delle richieste API.
- **Refresh Token**: Token a lunga durata (default: 7 giorni) utilizzato per ottenere nuovi access token senza richiedere le credenziali dell'utente.

## Flusso di Autenticazione

### 1. Login e Generazione Token

Quando un utente effettua il login con credenziali valide:

1. L'app verifica le credenziali contro il database.
2. Se le credenziali sono valide, genera un nuovo access token e refresh token.
3. I token vengono memorizzati nella tabella `TokenAutenticazione` con le relative date di scadenza.
4. L'app aggiorna il timestamp di ultimo accesso dell'utente.
5. I token vengono restituiti al client, che memorizza l'access token per le richieste API e il refresh token in modo sicuro.

```sql
-- Esempio di generazione token
INSERT INTO TokenAutenticazione (
    utente_id, access_token, refresh_token, 
    access_token_scadenza, refresh_token_scadenza, 
    device_info, ip_address
)
VALUES (
    1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', '9c5f2d7a-8e76-4f39-a35f-c23b168b4...',
    datetime('now', '+3600 seconds'), datetime('now', '+604800 seconds'),
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X...', '192.168.1.1'
);
```

### 2. Verifica del Token

Ad ogni richiesta API, il sistema verifica la validità dell'access token:

1. Controlla che il token non sia scaduto.
2. Verifica che il token non sia stato revocato (consultando `TokenRevocati`).
3. Estrae l'identità dell'utente e i suoi ruoli/permessi.

```sql
-- Esempio di verifica token
SELECT u.id, u.email, u.nome, u.cognome, u.ruolo, t.access_token_scadenza
FROM TokenAutenticazione t
JOIN Utenti u ON t.utente_id = u.id
WHERE t.access_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
AND t.access_token_scadenza > datetime('now')
AND t.revocato = 0;
```

### 3. Rinnovo del Token

Quando l'access token scade, il client può utilizzare il refresh token per ottenere un nuovo access token:

1. Il client invia il refresh token al server.
2. Il server verifica che il refresh token sia valido e non revocato.
3. Se valido, genera un nuovo access token e aggiorna la data di scadenza.

```sql
-- Esempio di rinnovo token
UPDATE TokenAutenticazione
SET 
    access_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...nuovo',
    access_token_scadenza = datetime('now', '+3600 seconds')
WHERE refresh_token = '9c5f2d7a-8e76-4f39-a35f-c23b168b4...'
AND refresh_token_scadenza > datetime('now')
AND revocato = 0;
```

### 4. Logout e Revoca Token

Quando un utente effettua il logout:

1. L'access token viene revocato (impostando `revocato = 1` nella tabella `TokenAutenticazione`).
2. Opzionalmente, l'hash del token viene inserito nella tabella `TokenRevocati` per una maggiore sicurezza.

```sql
-- Esempio di revoca token (logout)
UPDATE TokenAutenticazione
SET 
    revocato = 1,
    revocato_il = CURRENT_TIMESTAMP
WHERE access_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

## Sicurezza e Best Practice

### 1. Protezione contro Attacchi Comuni

- **JWT Hijacking**: Uso di HTTPS e token a breve scadenza.
- **Replay Attack**: Ogni token è univoco e la blacklist impedisce il riutilizzo di token revocati.
- **CSRF**: I token sono gestiti lato client e non utilizzano cookie.

### 2. Gestione Sessioni Multiple

Il sistema supporta sessioni multiple da dispositivi diversi per lo stesso utente:

- Ogni login genera nuovi token senza invalidare quelli esistenti.
- L'utente può visualizzare e revocare singoli dispositivi.
- Al cambio password, tutti i token vengono revocati per sicurezza.

### 3. Manutenzione del Sistema

Per mantenere il sistema efficiente:

- Un job pianificato elimina periodicamente i token scaduti.
- I token revocati vengono eliminati dalla blacklist una volta scaduti.
- Il sistema monitora e registra tentativi di uso di token invalidi.

## Implementazione nell'App Refood

### Integrazione con React Native

Nell'app mobile React Native:

1. I token sono memorizzati in modo sicuro usando `SecureStore` o equivalenti.
2. Un interceptor HTTP gestisce automaticamente l'aggiunta del token alle richieste e il refresh quando necessario.
3. Lo stato di autenticazione è gestito tramite un context provider React.

### API Server Node.js

Il server Node.js implementa:

1. Endpoint per login, logout e refresh token.
2. Middleware per validare i token in ogni richiesta protetta.
3. Logica per verificare i ruoli e i permessi dell'utente.

## Configurazione e Personalizzazione

I parametri del sistema JWT sono configurabili tramite la tabella `ParametriSistema`:

- `jwt_access_token_durata`: Durata in secondi dell'access token (default: 3600).
- `jwt_refresh_token_durata`: Durata in secondi del refresh token (default: 604800).

Questi valori possono essere modificati dagli amministratori di sistema per bilanciare sicurezza e usabilità.

---

## Appendice: Schema Tabelle JWT

```sql
-- Tabella per la gestione dei JWT
CREATE TABLE TokenAutenticazione (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utente_id INTEGER NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    access_token_scadenza TIMESTAMP NOT NULL,
    refresh_token_scadenza TIMESTAMP NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    revocato BOOLEAN DEFAULT 0,
    revocato_il TIMESTAMP,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utente_id) REFERENCES Utenti(id)
);

-- Tabella per la gestione della lista di revoca dei token JWT
CREATE TABLE TokenRevocati (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    revocato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    motivo TEXT,
    revocato_da INTEGER,
    scadenza_originale TIMESTAMP NOT NULL,
    FOREIGN KEY (revocato_da) REFERENCES Utenti(id)
);
``` 