# Documentazione: Soluzione Completa per Prevenire Problemi di Schema

## Panoramica del Sistema

Il sistema di prevenzione e correzione dei problemi di schema è un'infrastruttura completa implementata per il database ReFood, progettata per rilevare, monitorare e correggere automaticamente eventuali discrepanze nello schema del database.

## Componenti del Sistema

### 1. Tabelle di Monitoraggio

Il sistema si basa su tre tabelle principali:

- **SchemaRiferimento**: Memorizza lo schema atteso del database, fungendo da "fonte di verità" per tutte le verifiche.
  ```sql
  CREATE TABLE SchemaRiferimento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tabella TEXT NOT NULL,
      colonna TEXT NOT NULL,
      tipo TEXT NOT NULL,
      not_null INTEGER NOT NULL DEFAULT 0,
      valore_default TEXT,
      primary_key INTEGER NOT NULL DEFAULT 0,
      versione INTEGER NOT NULL,
      ultimo_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tabella, colonna, versione)
  );
  ```

- **SchemaDiscrepanze**: Registra le discrepanze rilevate tra lo schema attuale e quello di riferimento.
  ```sql
  CREATE TABLE SchemaDiscrepanze (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_rilevamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tabella TEXT NOT NULL,
      colonna TEXT,
      tipo_discrepanza TEXT NOT NULL,
      valore_atteso TEXT,
      valore_rilevato TEXT,
      corretta INTEGER NOT NULL DEFAULT 0,
      data_correzione TIMESTAMP
  );
  ```

- **SchemaModifiche**: Traccia tutte le modifiche apportate allo schema nel tempo.
  ```sql
  CREATE TABLE SchemaModifiche (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_modifica TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tabella TEXT NOT NULL,
      tipo_operazione TEXT NOT NULL,
      descrizione TEXT NOT NULL,
      dettagli TEXT,
      script_origine TEXT,
      utente TEXT
  );
  ```

### 2. Script Principali

- **schema_monitor.sql**: Verifica lo schema del database confrontandolo con lo schema di riferimento e identifica discrepanze.
  
- **schema_fix.sql**: Corregge automaticamente le discrepanze rilevate, aggiungendo colonne mancanti o modificando quelle errate.

- **safe_schema_exec.sh**: Script bash per l'esecuzione sicura di modifiche allo schema, con backup automatici e verifiche pre/post esecuzione.

- **install_schema_monitoring.sh**: Script per installare e configurare il sistema di monitoraggio, integrandolo con i job cron esistenti.

## Funzionamento del Sistema

### Rilevamento Discrepanze

1. Lo script `schema_monitor.sql` viene eseguito periodicamente tramite un job cron.
2. Estrae lo schema attuale del database utilizzando le tabelle di sistema di SQLite.
3. Confronta lo schema attuale con quello memorizzato in `SchemaRiferimento`.
4. Registra eventuali discrepanze nella tabella `SchemaDiscrepanze`.

### Correzione Automatica

1. Quando vengono rilevate discrepanze, lo script `schema_fix.sql` può essere eseguito manualmente o automaticamente.
2. Per ogni discrepanza, genera e applica gli statement SQL necessari:
   - `ALTER TABLE` per aggiungere colonne mancanti
   - Eventuali altre modifiche di schema necessarie
3. Aggiorna la tabella `SchemaModifiche` per registrare ogni correzione.
4. Marca le discrepanze come corrette in `SchemaDiscrepanze`.

### Esecuzione Sicura delle Modifiche

Lo script `safe_schema_exec.sh` fornisce un meccanismo sicuro per eseguire modifiche allo schema:

1. Crea un backup del database prima di qualsiasi modifica.
2. Verifica lo schema prima dell'esecuzione.
3. Esegue lo script SQL di modifica.
4. Verifica lo schema dopo l'esecuzione per confermare che la modifica sia stata applicata correttamente.
5. Registra la modifica nella tabella `SchemaModifiche`.

## Integrazione con il Sistema di Manutenzione

Il sistema di monitoraggio dello schema è integrato con il sistema di manutenzione automatica esistente:

1. Viene eseguita una verifica dello schema come parte del controllo settimanale di integrità del database.
2. Il controllo è configurato come job cron che viene eseguito ogni domenica alle 2:30 AM.
3. Le discrepanze rilevate generano notifiche per l'amministratore del sistema.

## Vantaggi del Sistema

1. **Rilevamento Proattivo**: Identifica problemi nello schema prima che causino errori nell'applicazione.
2. **Correzione Automatica**: Risolve automaticamente problemi comuni come colonne mancanti.
3. **Tracciabilità**: Tutte le modifiche allo schema sono documentate e verificabili.
4. **Backup Automatici**: Crea backup prima di modifiche critiche, riducendo i rischi.
5. **Integrazione**: Si integra con il sistema di manutenzione esistente per una gestione completa del database.

## Utilizzo del Sistema

### Verifica Manuale dello Schema

```bash
sqlite3 database/refood.db < schema_monitor.sql
```

### Correzione Manuale delle Discrepanze

```bash
sqlite3 database/refood.db < schema_fix.sql
```

### Esecuzione Sicura di Script SQL

```bash
./safe_schema_exec.sh path/to/script.sql "descrizione_operazione"
```

## Conclusioni

La soluzione implementata fornisce un approccio completo e proattivo alla gestione dello schema del database, prevenendo errori e garantendo la coerenza del database nel tempo. Questo sistema ha già dimostrato la sua efficacia rilevando e correggendo la mancanza del campo "prezzo" nella tabella "Lotti". 