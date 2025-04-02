## Correzione: Inizializzazione del Database

### Problema Riscontrato
Nella documentazione attuale, la sezione per l'inizializzazione del database presuppone che i file SQL (`schema.sql`, `custom_sqlite_functions.sql`, `setup_database_views.sql`) si trovino nella directory `backend`, ma in realtà si trovano nella root del progetto.

### Versione Corretta

```powershell
# Crea la directory database se non esiste
if (-not (Test-Path -Path "database")) {
    New-Item -Path "database" -ItemType Directory
}

# Inizializza il database con lo schema
# CORREZIONE: I percorsi dei file SQL sono relativi alla posizione attuale
sqlite3.exe database\refood.db < schema.sql
sqlite3.exe database\refood.db < custom_sqlite_functions.sql
sqlite3.exe database\refood.db < setup_database_views.sql

# Alternativa se hai problemi con il reindirizzamento:
# Copia e incolla il contenuto dei file SQL direttamente nell'interfaccia SQLite
sqlite3.exe database\refood.db
# (all'interno di sqlite, usa .read schema.sql)
```

### Nota sulla Struttura delle Directory

Verifica la posizione esatta dei file SQL nel tuo progetto. La struttura corretta dovrebbe essere:

```
/Refood/                  (directory principale del progetto)
  ├── schema.sql
  ├── custom_sqlite_functions.sql
  ├── setup_database_views.sql
  ├── backend/            (directory del backend)
  │    └── ... 
  ├── database/           (directory del database, creata dallo script)
  │    └── refood.db      (creato dall'esecuzione dei file SQL)
  └── refood-mobile/      (directory del frontend)
       └── ...
```

Se i file SQL si trovano nella directory `backend` e non nella root, allora usa questi comandi:

```powershell
# Crea la directory database se non esiste
if (-not (Test-Path -Path "database")) {
    New-Item -Path "database" -ItemType Directory
}

# Posizionati nella directory backend dove si trovano i file SQL
cd backend

# Inizializza il database con lo schema
sqlite3.exe ..\database\refood.db < schema.sql
sqlite3.exe ..\database\refood.db < custom_sqlite_functions.sql
sqlite3.exe ..\database\refood.db < setup_database_views.sql

# Torna alla directory principale
cd ..
``` 