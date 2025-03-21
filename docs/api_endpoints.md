# API Endpoints Refood

Questo documento descrive i principali endpoint API implementati nel backend Refood.

## Base URL

```
http://localhost:3000/api/v1
```

## Autenticazione

### Login
**POST** `/auth/login`

Autentica un utente e restituisce i token JWT.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "device_info": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X)"
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "nome": "Mario",
    "cognome": "Rossi",
    "ruolo": "Operatore"
  },
  "tokens": {
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh": "9c5f2d7a-8e76-4f39-a35f-c23b168b4...",
    "expires": "2023-03-20T14:30:00.000Z"
  }
}
```

### Refresh Token
**POST** `/auth/refresh-token`

Ottiene un nuovo access token usando un refresh token.

**Request Body:**
```json
{
  "refresh_token": "9c5f2d7a-8e76-4f39-a35f-c23b168b4..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires": "2023-03-20T15:30:00.000Z"
}
```

### Logout
**POST** `/auth/logout`

Revoca il token corrente.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "status": "success",
  "message": "Logout effettuato con successo"
}
```

### Sessioni Attive
**GET** `/auth/active-sessions`

Ottiene tutte le sessioni attive dell'utente.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "sessions": [
    {
      "id": 1,
      "device_info": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X)",
      "ip_address": "192.168.1.1",
      "creato_il": "2023-03-15T10:30:00.000Z"
    }
  ]
}
```

## Lotti

### Elenco Lotti
**GET** `/lotti`

Ottiene l'elenco dei lotti con filtri opzionali.

**Query Parameters:**
- `stato`: Filtra per stato (Verde, Arancione, Rosso)
- `centro`: ID del centro di origine
- `scadenza_entro`: Data entro cui il lotto scade
- `page`: Numero pagina (default: 1)
- `limit`: Risultati per pagina (default: 20)

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "prodotto": "Mele Golden",
      "quantita": 25.5,
      "unita_misura": "kg",
      "data_scadenza": "2023-03-25",
      "stato": "Verde",
      "centro_nome": "Centro Distribuzione Nord",
      "categorie": ["Frutta", "Fresco"]
    }
  ],
  "pagination": {
    "total": 150,
    "pages": 8,
    "page": 1,
    "limit": 20
  }
}
```

### Dettaglio Lotto
**GET** `/lotti/:id`

Ottiene i dettagli di un singolo lotto.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "id": 1,
  "prodotto": "Mele Golden",
  "quantita": 25.5,
  "unita_misura": "kg",
  "data_scadenza": "2023-03-25",
  "giorni_permanenza": 14,
  "stato": "Verde",
  "centro_origine_id": 2,
  "centro_nome": "Centro Distribuzione Nord",
  "indirizzo": "Via Roma 123, Milano",
  "latitudine": 45.4642,
  "longitudine": 9.1900,
  "inserito_da": 5,
  "creato_il": "2023-03-10T09:30:00.000Z",
  "aggiornato_il": "2023-03-10T09:30:00.000Z",
  "categorie": ["Frutta", "Fresco"],
  "prenotazioni_attive": 0
}
```

### Creazione Lotto
**POST** `/lotti`

Crea un nuovo lotto.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "prodotto": "Yogurt naturale",
  "quantita": 15,
  "unita_misura": "kg",
  "data_scadenza": "2023-03-18",
  "giorni_permanenza": 5,
  "centro_origine_id": 2,
  "categorie": [3, 5]
}
```

**Response:**
```json
{
  "id": 10,
  "prodotto": "Yogurt naturale",
  "quantita": 15,
  "unita_misura": "kg",
  "data_scadenza": "2023-03-18",
  "giorni_permanenza": 5,
  "stato": "Verde",
  "centro_origine_id": 2,
  "inserito_da": 5,
  "creato_il": "2023-03-15T11:45:00.000Z",
  "aggiornato_il": "2023-03-15T11:45:00.000Z",
  "categorie": [3, 5]
}
```

### Lotti Disponibili
**GET** `/lotti/disponibili`

Ottiene l'elenco dei lotti disponibili per prenotazione.

**Query Parameters:**
- `lat`: Latitudine per ricerca geografica
- `lng`: Longitudine per ricerca geografica
- `raggio`: Raggio di ricerca in km
- `categoria`: ID categoria per filtrare

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
[
  {
    "id": 1,
    "prodotto": "Mele Golden",
    "quantita": 25.5,
    "unita_misura": "kg",
    "data_scadenza": "2023-03-25",
    "stato": "Verde",
    "centro_nome": "Centro Distribuzione Nord",
    "distanza": 3.4,
    "categorie": ["Frutta", "Fresco"]
  }
]
```

## Prenotazioni

### Elenco Prenotazioni
**GET** `/prenotazioni`

Ottiene l'elenco delle prenotazioni dell'utente corrente.

**Query Parameters:**
- `stato`: Filtra per stato (Prenotato, InTransito, Consegnato, Annullato)
- `page`: Numero pagina (default: 1)
- `limit`: Risultati per pagina (default: 20)

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "data": [
    {
      "id": 3,
      "lotto_id": 5,
      "prodotto": "Pane",
      "quantita": 10,
      "unita_misura": "kg",
      "centro_ricevente_id": 4,
      "centro_ricevente_nome": "Centro Sociale Est",
      "stato": "Prenotato",
      "data_prenotazione": "2023-03-14T14:30:00.000Z",
      "data_ritiro": "2023-03-16T09:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 12,
    "pages": 1,
    "page": 1,
    "limit": 20
  }
}
```

### Crea Prenotazione
**POST** `/prenotazioni`

Crea una nuova prenotazione per un lotto.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "lotto_id": 5,
  "centro_ricevente_id": 4,
  "data_ritiro": "2023-03-16T09:00:00.000Z",
  "note": "Ritiro presso magazzino posteriore"
}
```

**Response:**
```json
{
  "id": 15,
  "lotto_id": 5,
  "centro_ricevente_id": 4,
  "stato": "Prenotato",
  "data_prenotazione": "2023-03-15T12:45:00.000Z",
  "data_ritiro": "2023-03-16T09:00:00.000Z",
  "note": "Ritiro presso magazzino posteriore"
}
```

### Aggiorna Stato Prenotazione
**PUT** `/prenotazioni/:id/stato`

Aggiorna lo stato di una prenotazione.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "stato": "InTransito"
}
```

**Response:**
```json
{
  "id": 15,
  "stato": "InTransito",
  "data_consegna": null,
  "messaggio": "Stato della prenotazione aggiornato con successo"
}
```

## Centri

### Elenco Centri
**GET** `/centri`

Ottiene l'elenco dei centri con filtri opzionali.

**Query Parameters:**
- `tipo`: Filtra per tipo (Distribuzione, Sociale, Riciclaggio)
- `lat`: Latitudine per ricerca geografica
- `lng`: Longitudine per ricerca geografica
- `raggio`: Raggio di ricerca in km
- `page`: Numero pagina (default: 1)
- `limit`: Risultati per pagina (default: 20)

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "data": [
    {
      "id": 2,
      "nome": "Centro Distribuzione Nord",
      "tipo": "Distribuzione",
      "indirizzo": "Via Roma 123, Milano",
      "latitudine": 45.4642,
      "longitudine": 9.1900,
      "telefono": "+39 02 1234567",
      "email": "centro.nord@example.com",
      "distanza": 1.5
    }
  ],
  "pagination": {
    "total": 25,
    "pages": 2,
    "page": 1,
    "limit": 20
  }
}
```

### Statistiche Centro
**GET** `/centri/:id/statistiche`

Ottiene le statistiche di un centro.

**Query Parameters:**
- `periodo`: settimanale, mensile, annuale (default: settimanale)
- `anno`: Anno di riferimento
- `mese`: Mese di riferimento (1-12)

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "centro_id": 2,
  "nome_centro": "Centro Distribuzione Nord",
  "periodo": "settimanale",
  "anno": 2023,
  "settimane": [
    {
      "settimana": 10,
      "lotti_inseriti": 15,
      "quantita_salvata": 230.5,
      "peso_totale_kg": 230.5,
      "co2_risparmiata_kg": 576.25,
      "valore_economico": 691.5
    },
    {
      "settimana": 11,
      "lotti_inseriti": 12,
      "quantita_salvata": 180.2,
      "peso_totale_kg": 180.2,
      "co2_risparmiata_kg": 450.5,
      "valore_economico": 540.6
    }
  ],
  "totale": {
    "lotti_inseriti": 27,
    "quantita_salvata": 410.7,
    "peso_totale_kg": 410.7,
    "co2_risparmiata_kg": 1026.75,
    "valore_economico": 1232.1
  }
}
```

## Statistiche e Reportistica

### Contatori del Sistema

Ottiene contatori di base per le entità principali del sistema.

- **Endpoint**: `GET /api/v1/statistiche/contatori`
- **Autenticazione**: Richiesta (JWT)
- **Risposta**:
  ```json
  {
    "lotti": {
      "totale": 100,
      "per_stato": {
        "verde": 40,
        "arancione": 35,
        "rosso": 25
      }
    },
    "prenotazioni": {
      "totale": 80,
      "per_stato": {
        "prenotate": 20,
        "in_transito": 15,
        "consegnate": 40,
        "annullate": 5
      }
    },
    "utenti": {
      "totale": 50,
      "per_ruolo": {
        "operatori": 20,
        "amministratori": 5,
        "centri_sociali": 15,
        "centri_riciclaggio": 10
      }
    },
    "centri": {
      "totale": 25,
      "per_tipo": {
        "distribuzione": 10,
        "sociali": 10,
        "riciclaggio": 5
      }
    }
  }
  ```

### Impatto Ambientale ed Economico

Ottiene le statistiche di impatto ambientale ed economico del sistema.

- **Endpoint**: `GET /api/v1/statistiche/impatto`
- **Autenticazione**: Richiesta (JWT)
- **Risposta**:
  ```json
  {
    "co2_risparmiata_kg": 1500,
    "valore_economico_risparmiato": 5000,
    "cibo_salvato_kg": 750,
    "acqua_risparmiata_litri": 150000,
    "terreno_risparmiato_mq": 225,
    "lotti_salvati": 85
  }
  ```

## Notifiche

### Elenco Notifiche
**GET** `/notifiche`

Ottiene l'elenco delle notifiche dell'utente.

**Query Parameters:**
- `letto`: true/false per filtrare per stato di lettura
- `page`: Numero pagina (default: 1)
- `limit`: Risultati per pagina (default: 20)

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "data": [
    {
      "id": 15,
      "tipo": "CambioStato",
      "messaggio": "Il lotto \"Mele Golden\" è passato dallo stato Verde a Arancione",
      "letto": false,
      "creato_il": "2023-03-15T08:30:00.000Z"
    }
  ],
  "non_lette": 8,
  "pagination": {
    "total": 45,
    "pages": 3,
    "page": 1,
    "limit": 20
  }
}
```

### Segnare Notifica come Letta
**PUT** `/notifiche/:id/letto`

Segna una notifica come letta.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "id": 15,
  "letto": true,
  "messaggio": "Notifica segnata come letta"
}
``` 