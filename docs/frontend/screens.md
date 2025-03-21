# Guida alle Schermate dell'Applicazione ReFood

Questo documento descrive le principali schermate dell'applicazione mobile ReFood e le loro funzionalità.

## Schermate Principali (Tab Navigation)

### 1. Dashboard (Home)

**File:** `app/(tabs)/index.tsx`

**Funzionalità:**
- Visualizzazione di statistiche e informazioni rilevanti in base al ruolo dell'utente
- Widget che mostrano i dati più importanti (lotti disponibili, prenotazioni attive, scadenze imminenti)
- Accesso rapido alle funzionalità principali

**Visualizzazione per ruolo:**
- **Amministratore:** Statistiche globali, tendenze, accesso rapido alle funzioni amministrative
- **Operatore:** Lotti gestiti, prenotazioni ricevute, notifiche di scadenza
- **Centro Sociale:** Lotti disponibili, prenotazioni effettuate
- **Centro Riciclaggio:** Lotti prossimi alla scadenza o scaduti

### 2. Lotti

**File:** `app/(tabs)/lotti.tsx`

**Funzionalità:**
- Visualizzazione dei lotti in forma di lista con filtri avanzati
- Ricerca testuale di lotti
- Filtraggio per stato (Verde, Arancione, Rosso)
- Visualizzazione dettagli del lotto
- Accesso alla creazione di nuovi lotti (per operatori)

**Componenti principali:**
- `LottoCard`: Mostra informazioni sintetiche del lotto
- `StyledFilterModal`: Permette il filtraggio avanzato dei lotti

### 3. Prenotazioni

**File:** `app/(tabs)/prenotazioni.tsx`

**Funzionalità:**
- Visualizzazione delle prenotazioni attive
- Storico delle prenotazioni completate
- Gestione dello stato delle prenotazioni
- Dettagli della prenotazione

### 4. Profilo

**File:** `app/(tabs)/profilo.tsx`

**Funzionalità:**
- Visualizzazione e modifica delle informazioni dell'utente
- Accesso alle impostazioni dell'account
- Funzionalità di logout
- Per amministratori: accesso alle funzionalità amministrative

## Schermate Amministrative

### Gestione Centri

**File:** `app/admin/centri/index.tsx`

**Funzionalità:**
- Visualizzazione di tutti i centri registrati
- Creazione, modifica ed eliminazione dei centri
- Ricerca e filtraggio dei centri
- Accesso alla gestione degli operatori assegnati ai centri

### Nuovo Centro

**File:** `app/admin/centri/nuovo.tsx`

**Funzionalità:**
- Form per la creazione di un nuovo centro
- Validazione dei campi (nome, indirizzo, telefono, email)
- Selezione del tipo di centro (sociale o riciclaggio)

### Modifica Centro

**File:** `app/admin/centri/modifica.tsx`

**Funzionalità:**
- Form pre-compilato con i dati del centro selezionato
- Aggiornamento delle informazioni del centro
- Validazione dei campi modificati

### Gestione Operatori

**File:** `app/admin/centri/operatori.tsx`

**Funzionalità:**
- Assegnazione degli operatori a un centro specifico
- Visualizzazione degli operatori già assegnati
- Ricerca degli operatori disponibili
- Aggiunta e rimozione di operatori dal centro

## Schermate di Gestione Lotti

### Nuovo Lotto

**File:** `app/lotti/nuovo.tsx`

**Funzionalità:**
- Form per la creazione di un nuovo lotto alimentare
- Selezione della data di scadenza con un picker
- Validazione dei campi (nome, quantità, unità di misura, scadenza)
- Opzione per aggiungere descrizione dettagliata
- Selezione del centro di origine

### Dettaglio Lotto

**File:** `app/lotti/[id].tsx`

**Funzionalità:**
- Visualizzazione dettagliata di un lotto specifico
- Informazioni complete sul lotto (nome, descrizione, quantità, scadenza)
- Stato attuale e cronologia degli stati precedenti
- Per i lotti disponibili: possibilità di prenotazione
- Per i propri lotti: possibilità di modifica

## Schermate di Autenticazione

### Login

**File:** `src/screens/LoginScreen.tsx`

**Funzionalità:**
- Form di accesso con email e password
- Validazione dei campi
- Gestione degli errori di autenticazione
- Memorizzazione del token di autenticazione

## Componenti Comuni

### Header

Il layout dell'applicazione include un header personalizzato con:
- Titolo della schermata
- Pulsanti di navigazione (back, menu)
- Azioni contestuali (quando applicabile)

### BottomTabNavigator

La navigazione principale dell'app è gestita tramite un sistema di tab nella parte inferiore dello schermo, che consente l'accesso rapido alle sezioni principali:
- Home
- Lotti
- Prenotazioni
- Profilo 