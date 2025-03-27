# Migrazione da "Centri" a "Tipo_Utente"

Questa directory contiene script e guide per cambiare il nome della tabella `Centri` in `Tipo_Utente` nell'applicazione Refood, riflettendo il passaggio da un sistema distribuito a un sistema centralizzato.

## Panoramica

La migrazione è suddivisa in tre fasi principali:

1. **Migrazione database**: Rinominare la tabella `Centri` in `Tipo_Utente` e tutte le tabelle correlate
2. **Aggiornamento backend**: Modificare le query SQL e i riferimenti nel codice del backend
3. **Aggiornamento frontend**: Aggiornare i componenti dell'interfaccia utente e le chiamate API

## File inclusi

- `rename_centri_to_tipo_utente.sql`: Script SQL per aggiornare lo schema del database
- `update_backend_centri_to_tipo_utente.md`: Guida per aggiornare il codice del backend
- `frontend_changes_centri_to_tipo_utente.md`: Guida per aggiornare il frontend

## Cambiamenti principali

### Nuova struttura della tabella Tipo_Utente

```sql
CREATE TABLE Tipo_Utente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('Privato', 'Canale sociale', 'centro riciclo')),
    indirizzo TEXT NOT NULL,
    email TEXT,
    telefono TEXT,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Mappatura dei tipi

La migrazione mappa i vecchi tipi di centro ai nuovi tipi di utente come segue:
- `Distribuzione` → `Privato`
- `Sociale` → `Canale sociale`
- `Riciclaggio` → `centro riciclo`

### Tabelle interessate dalla migrazione

1. `Centri` → `Tipo_Utente`
2. `AttoriCentri` → `AttoriTipoUtente`
3. `Lotti` (campo: `centro_origine_id` → `tipo_utente_origine_id`)
4. `Prenotazioni` (campo: `centro_ricevente_id` → `tipo_utente_ricevente_id`)
5. `Notifiche` (campo: `centro_id` → `tipo_utente_id`)
6. `Trasformazioni` (campo: `centro_trasformazione_id` → `tipo_utente_trasformazione_id`)
7. `StatisticheSettimanali` (campo: `centro_id` → `tipo_utente_id`)

## Istruzioni per la migrazione

### 1. Backup del database

Prima di qualsiasi modifica, eseguire un backup completo del database:

```bash
cp database/refood.db database/refood.db.backup
```

### 2. Esecuzione dello script di migrazione del database

```bash
sqlite3 database/refood.db < migrations/rename_centri_to_tipo_utente.sql
```

> **IMPORTANTE**: Lo script è transazionale e verrà eseguito un rollback automatico in caso di errori.

### 3. Aggiornamento del backend

Seguire le istruzioni dettagliate nel file `update_backend_centri_to_tipo_utente.md`.

I principali file da modificare includono:
- Controllers: centri.controller.js (rinominarlo in tipo_utente.controller.js), lotti.controller.js, ecc.
- Routes: centri.routes.js (rinominarlo in tipo_utente.routes.js)

### 4. Aggiornamento del frontend

Seguire le istruzioni dettagliate nel file `frontend_changes_centri_to_tipo_utente.md`.

I principali cambiamenti includono:
- Rinominare tipi e interfacce
- Aggiornare API calls
- Modificare testo nell'interfaccia utente
- Rinominare routes e percorsi

## Stato Attuale della Migrazione Frontend

### Completato:
1. **Creazione completa della nuova struttura di file**
   - Creata la directory `refood-mobile/app/admin/tipi-utente/`
   - Creati tutti i file necessari:
     - `_layout.tsx`: Configurazione del layout e routing
     - `index.tsx`: Pagina principale per gestire i tipi utente
     - `nuovo.tsx`: Pagina per creazione di nuovi tipi utente
     - `modifica.tsx`: Pagina per modifica dei tipi utente esistenti
     - `operatori.tsx`: Pagina per gestione operatori associati a un tipo utente

2. **Routing e navigazione**
   - Implementata navigazione parallela per supportare sia `/centri` che `/tipi-utente`
   - Predisposto il reindirizzamento per garantire compatibilità

3. **Documentazione**
   - `migrations/update_frontend_readme.md`: Contiene le istruzioni per le sostituzioni automatiche
   - `migrations/riepilogo_frontend_migrazione.md`: Tiene traccia dello stato della migrazione

### In sospeso:
1. **Esecuzione sostituzioni globali**
   - Seguire le istruzioni in `migrations/update_frontend_readme.md` per completare le sostituzioni nei file
   - Sostituire riferimenti, variabili e percorsi API

2. **Test e integrazione**
   - Verificare che le nuove pagine funzionino correttamente
   - Testare l'integrazione con le nuove API

### Prossimi passi:
1. Eseguire il script con le sostituzioni automatiche
2. Testare l'applicazione con i nuovi endpoint
3. Verificare che il reindirizzamento da `/centri` a `/tipi-utente` funzioni correttamente

## Considerazioni importanti

### Semantica

Valutare se il termine "Tipo Utente" è appropriato per l'interfaccia utente. È possibile mantenere termini più familiari all'utente nell'UI pur cambiando la struttura del database.

### Testing

Dopo la migrazione, testare a fondo tutte le funzionalità, in particolare:
- Gestione tipi utente
- Operazioni CRUD su lotti associati a tipi utente
- Prenotazioni
- Statistiche

## Rollback in caso di problemi

Se si verificano problemi gravi dopo la migrazione, è possibile ripristinare il backup:

```bash
cp database/refood.db.backup database/refood.db
```

Ricordarsi di ripristinare anche eventuali modifiche al codice. 