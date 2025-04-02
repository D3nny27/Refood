# Aggiornamento della Documentazione per il Setup del Database Refood

## Modifiche apportate

Per risolvere i problemi di parsing riscontrati con il file `schema.sql` originale, abbiamo diviso lo schema in più file e creato script di automazione per rendere il processo di setup più semplice e robusto:

1. **Divisione del file schema.sql in componenti più gestibili**:
   - `schema_tables.sql` - Definizione delle tabelle e dati di default
   - `schema_indexes.sql` - Definizione degli indici
   - `schema_triggers.sql` - Definizione dei trigger
   - `schema_maintenance.sql` - Procedure di manutenzione

2. **Creazione di script di automazione**:
   - `setup_db_refood.sh` - Per Linux/macOS
   - `setup_db_refood.bat` - Per Windows

3. **Creazione di documentazione aggiornata**:
   - `README_Schema_Refood.md` - Spiega la struttura e l'utilizzo dei file

## Motivazione delle modifiche

Il file `schema.sql` originale presentava problemi durante l'esecuzione, in particolare errori di parsing alle linee 388, 409, 472, 486, principalmente a causa di commenti multilinea estesi all'interno delle procedure di manutenzione. La divisione del file rende ogni componente più gestibile e aiuta a evitare problemi di sintassi.

## Come utilizzare i nuovi file

### In ambiente Linux/macOS

1. Assicurati che SQLite sia installato:
   ```bash
   sqlite3 --version
   ```

2. Rendi lo script di setup eseguibile:
   ```bash
   chmod +x setup_db_refood.sh
   ```

3. Esegui lo script:
   ```bash
   ./setup_db_refood.sh
   ```

### In ambiente Windows

1. Assicurati che SQLite sia installato e nel PATH del sistema o nella directory del progetto.

2. Esegui lo script batch:
   ```cmd
   setup_db_refood.bat
   ```

### Esecuzione manuale (alternativa)

Se preferisci eseguire manualmente i comandi:

```bash
# Crea la directory database
mkdir -p database

# Esegui i file SQL in sequenza
sqlite3 database/refood.db < schema_tables.sql
sqlite3 database/refood.db < schema_indexes.sql
sqlite3 database/refood.db < schema_triggers.sql
```

## Aggiornamenti necessari in altri file della documentazione

### In `setup_windows.bat` e `setup_windows_fixed.bat`

Nella sezione di inizializzazione del database, sostituire:

```batch
cd backend
..\database\sqlite3.exe ..\database\refood.db < schema.sql
..\database\sqlite3.exe ..\database\refood.db < custom_sqlite_functions.sql
..\database\sqlite3.exe ..\database\refood.db < setup_database_views.sql
cd ..
```

Con:

```batch
..\database\sqlite3.exe ..\database\refood.db < schema_tables.sql
..\database\sqlite3.exe ..\database\refood.db < schema_indexes.sql
..\database\sqlite3.exe ..\database\refood.db < schema_triggers.sql
..\database\sqlite3.exe ..\database\refood.db < custom_sqlite_functions.sql
..\database\sqlite3.exe ..\database\refood.db < setup_database_views.sql
```

### In `setup_unix.sh`

Nella sezione di inizializzazione del database, sostituire:

```bash
cd backend
sqlite3 ../database/refood.db < schema.sql
sqlite3 ../database/refood.db < custom_sqlite_functions.sql
sqlite3 ../database/refood.db < setup_database_views.sql
```

Con:

```bash
sqlite3 ../database/refood.db < schema_tables.sql
sqlite3 ../database/refood.db < schema_indexes.sql
sqlite3 ../database/refood.db < schema_triggers.sql
sqlite3 ../database/refood.db < custom_sqlite_functions.sql
sqlite3 ../database/refood.db < setup_database_views.sql
```

## Manutenzione del database

Il file `schema_maintenance.sql` contiene procedure che non sono parte integrante della creazione del database, ma che dovrebbero essere eseguite periodicamente per:

1. Aggiornare lo stato dei lotti in base alla data di scadenza
2. Pulire i token scaduti
3. Calcolare statistiche settimanali 
4. Aggiornare automaticamente lo stato delle prenotazioni
5. Verificare e correggere l'integrità referenziale del database

Queste procedure possono essere eseguite manualmente o attraverso job schedulati (come cron su Linux/macOS o Task Scheduler su Windows).

## Note aggiuntive

- I file SQL creati sono encoding UTF-8
- Gli script di setup eseguono un backup del database esistente prima di inizializzare uno nuovo
- Gli script verificano la disponibilità di SQLite prima di procedere 