# Refood Database Schema

## Struttura del Database

Il database di Refood è stato progettato per gestire in modo efficiente lotti alimentari, prenotazioni, utenti e altre entità rilevanti per l'ecosistema dell'applicazione contro lo spreco alimentare.

## File Schema Divisi

Per facilitare la manutenzione e migliorare la leggibilità, lo schema del database è stato suddiviso in più file:

1. **schema_tables.sql**: Contiene la definizione di tutte le tabelle e l'inserimento dei dati di default
2. **schema_indexes.sql**: Contiene tutti gli indici per ottimizzare le query
3. **schema_triggers.sql**: Contiene tutti i trigger per automazioni e vincoli
4. **schema_maintenance.sql**: Contiene le procedure di manutenzione da eseguire periodicamente

## Come Creare il Database

Per creare correttamente il database, esegui i file SQL nell'ordine seguente:

```bash
# Crea la directory per il database se non esiste
mkdir -p database

# 1. Crea le tabelle
sqlite3 database/refood.db < schema_tables.sql

# 2. Crea gli indici
sqlite3 database/refood.db < schema_indexes.sql

# 3. Crea i trigger
sqlite3 database/refood.db < schema_triggers.sql

# 4. (Opzionale) Verifica la struttura del database
sqlite3 database/refood.db ".schema"
```

Le procedure di manutenzione in `schema_maintenance.sql` non vengono eseguite direttamente durante la creazione del database, ma sono documentate per future operazioni di manutenzione automatizzata.

## Manutenzione Periodica

Per eseguire le procedure di manutenzione (come l'aggiornamento dello stato dei lotti in base alla scadenza), puoi utilizzare il file `schema_maintenance.sql`. Questo file contiene diverse procedure che dovrebbero essere eseguite a intervalli regolari.

Per eseguire una procedura di manutenzione specifica:

```bash
# Estrai la procedura desiderata dal file schema_maintenance.sql
# e salvala in un file separato, ad esempio update_status.sql

# Eseguila sul database
sqlite3 database/refood.db < update_status.sql
```

## Personalizzazione

È possibile personalizzare i parametri di sistema modificando i valori nella tabella `ParametriSistema` dopo la creazione del database:

```sql
-- Esempio: Modifica la soglia per lo stato arancione a 5 giorni
UPDATE ParametriSistema SET valore = '5' WHERE chiave = 'soglia_stato_arancione';
```

## Panoramica delle Principali Entità

- **Attori**: Utenti del sistema (Amministratori, Operatori, Utenti)
- **Tipo_Utente**: Tipologie specifiche di utenti (Privato, Canale sociale, Centro riciclo)
- **Lotti**: Prodotti alimentari disponibili
- **Prenotazioni**: Richieste di ritiro dei lotti
- **Notifiche**: Sistema di notifiche interno all'applicazione

## Avvisi di Sicurezza

1. Il file contiene una chiave JWT di default. In produzione, modificare questa chiave con un valore sicuro.
2. Assicurarsi che le directory e i file del database abbiano permessi appropriati.
3. Per ambienti di produzione, considerare l'utilizzo di un sistema di backup regolare del database. 