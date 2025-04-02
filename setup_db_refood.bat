@echo off
setlocal enabledelayedexpansion

echo ===================================
echo Inizializzazione Database Refood
echo ===================================
echo.

REM Crea la directory database se non esiste
if not exist "database" (
    echo Creazione directory database...
    mkdir database
    echo Directory database creata.
) else (
    echo Directory database gia' esistente.
)

REM Verifica se SQLite è installato
where sqlite3 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: SQLite3 non trovato. Installalo prima di continuare.
    goto :fine
) else (
    echo SQLite3 trovato: 
    sqlite3 --version
)

REM Verifica se i file schema esistono
set FILES_OK=1
for %%F in (schema_tables.sql schema_indexes.sql schema_triggers.sql) do (
    if not exist %%F (
        echo ERRORE: File %%F non trovato.
        set FILES_OK=0
    )
)

if !FILES_OK! EQU 0 (
    echo Uno o piu' file schema necessari non sono stati trovati.
    goto :fine
)

REM Backup del database esistente se presente
if exist database\refood.db (
    echo Backup del database esistente...
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (
        set mydate=%%c%%a%%b
    )
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do (
        set mytime=%%a%%b
    )
    set backup_name=database\refood_backup_!mydate!_!mytime!.db
    copy database\refood.db !backup_name! >nul
    echo Backup creato: !backup_name!
)

echo.
echo Inizializzazione del database...

REM 1. Crea le tabelle
echo Passo 1: Creazione tabelle...
sqlite3 database\refood.db < schema_tables.sql
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Impossibile creare le tabelle.
    goto :fine
)
echo Tabelle create con successo.

REM 2. Crea gli indici
echo Passo 2: Creazione indici...
sqlite3 database\refood.db < schema_indexes.sql
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Impossibile creare gli indici.
    goto :fine
)
echo Indici creati con successo.

REM 3. Crea i trigger
echo Passo 3: Creazione trigger...
sqlite3 database\refood.db < schema_triggers.sql
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Impossibile creare i trigger.
    goto :fine
)
echo Trigger creati con successo.

REM Verifica la creazione del database
echo.
echo Verifica della struttura del database...
for /f %%i in ('sqlite3 database\refood.db "SELECT count(*) FROM sqlite_master WHERE type='table'"') do set num_tables=%%i
echo Database creato con %num_tables% tabelle.

echo.
echo ===================================
echo Database inizializzato con successo!
echo ===================================
echo.
echo Nota: Il file schema_maintenance.sql contiene procedure di manutenzione
echo da eseguire periodicamente attraverso job schedulati.
echo.

REM Opzionale: mostra informazioni sul database
set /p risposta=Vuoi vedere la lista delle tabelle? (s/n) 
if /i "%risposta%"=="s" (
    echo.
    sqlite3 database\refood.db ".tables"
)

:fine
echo.
echo Premi un tasto per uscire...
pause >nul
endlocal 