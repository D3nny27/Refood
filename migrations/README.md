# Migrazione da "Utenti" a "Attori"

Questa directory contiene script e guide per cambiare il nome della tabella `Utenti` in `Attori` nell'applicazione Refood.

## Panoramica

La migrazione è suddivisa in tre fasi principali:

1. **Migrazione database**: Rinominare la tabella `Utenti` in `Attori` e tutte le tabelle correlate
2. **Aggiornamento backend**: Modificare le query SQL e i riferimenti nel codice del backend
3. **Aggiornamento frontend**: Aggiornare i componenti dell'interfaccia utente e le chiamate API

## File inclusi

- `rename_utenti_to_attori.sql`: Script SQL per aggiornare lo schema del database
- `update_backend_utenti_to_attori.md`: Guida per aggiornare il codice del backend
- `frontend_changes_utenti_to_attori.md`: Guida per aggiornare il frontend

## Istruzioni per la migrazione

### 1. Backup del database

Prima di qualsiasi modifica, eseguire un backup completo del database:

```bash
cp database/refood.db database/refood.db.backup
```

### 2. Esecuzione dello script di migrazione del database

```bash
sqlite3 database/refood.db < migrations/rename_utenti_to_attori.sql
```

> **IMPORTANTE**: Lo script è transazionale e verrà eseguito un rollback automatico in caso di errori.

### 3. Aggiornamento del backend

Seguire le istruzioni dettagliate nel file `update_backend_utenti_to_attori.md`.

I principali file da modificare includono:
- Controllers: auth.controller.js, user.controller.js, ecc.
- Middleware: auth.js
- Routes: user.routes.js, ecc.

### 4. Aggiornamento del frontend

Seguire le istruzioni dettagliate nel file `frontend_changes_utenti_to_attori.md`.

I principali cambiamenti includono:
- Rinominare tipi e interfacce
- Aggiornare API calls
- Modificare testo nell'interfaccia utente
- Rinominare routes e percorsi

## Considerazioni importanti

### Semantica

Valutare se il termine "Attori" è appropriato per l'interfaccia utente. È possibile mantenere termini familiari all'utente nell'UI pur cambiando la struttura del database.

### Testing

Dopo la migrazione, testare a fondo tutte le funzionalità, in particolare:
- Autenticazione e login
- Gestione utenti/attori
- Operazioni CRUD su lotti associati a utenti/attori
- Notifiche e comunicazioni

## Rollback in caso di problemi

Se si verificano problemi gravi dopo la migrazione, è possibile ripristinare il backup:

```bash
cp database/refood.db.backup database/refood.db
```

Ricordarsi di ripristinare anche eventuali modifiche al codice.

## Automazione

Diverse operazioni possono essere automatizzate con comandi come `grep` e `sed`. Vedere le guide specifiche per esempi di automazione. 