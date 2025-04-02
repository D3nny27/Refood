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

REM 4. Configura il monitoraggio dello schema usando Task Scheduler per Windows invece di crontab
echo.
echo Configurazione monitoraggio automatico dello schema...
if not exist "maintenance_scripts" mkdir maintenance_scripts
if not exist "maintenance_scripts\logs" mkdir maintenance_scripts\logs

REM Crea lo script di verifica per Windows
set VERIFY_SCRIPT=maintenance_scripts\verify_schema.bat
echo @echo off > %VERIFY_SCRIPT%
echo setlocal >> %VERIFY_SCRIPT%
echo set DB_PATH=%CD%\database\refood.db >> %VERIFY_SCRIPT%
echo set LOG_DIR=%CD%\maintenance_scripts\logs >> %VERIFY_SCRIPT%
echo set TIMESTAMP=%%date:~-4%%%%date:~3,2%%%%date:~0,2%%_%%time:~0,2%%%%time:~3,2%%%%time:~6,2%% >> %VERIFY_SCRIPT%
echo set TIMESTAMP=%%TIMESTAMP: =0%% >> %VERIFY_SCRIPT%
echo set LOG_FILE=%%LOG_DIR%%\schema_verify_%%TIMESTAMP%%.log >> %VERIFY_SCRIPT%
echo echo Avvio verifica schema database [%%date%% %%time%%] ^> %%LOG_FILE%% >> %VERIFY_SCRIPT%
echo sqlite3 %%DB_PATH%% ".schema" ^>^> %%LOG_FILE%% 2^>^&1 >> %VERIFY_SCRIPT%
echo echo Verifica schema completata [%%date%% %%time%%] ^>^> %%LOG_FILE%% >> %VERIFY_SCRIPT%
echo endlocal >> %VERIFY_SCRIPT%

echo Script di verifica creato: %VERIFY_SCRIPT%

REM Crea l'attività pianificata in Windows Task Scheduler
echo Configurazione Task Scheduler...
set TASK_NAME=Refood_Schema_Monitor
set TASK_FILE=maintenance_scripts\task_config.xml

echo ^<?xml version="1.0"?^> > %TASK_FILE%
echo ^<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"^> >> %TASK_FILE%
echo   ^<RegistrationInfo^> >> %TASK_FILE%
echo     ^<Description^>Monitora lo schema del database Refood^</Description^> >> %TASK_FILE%
echo   ^</RegistrationInfo^> >> %TASK_FILE%
echo   ^<Triggers^> >> %TASK_FILE%
echo     ^<CalendarTrigger^> >> %TASK_FILE%
echo       ^<StartBoundary^>2022-01-01T02:30:00^</StartBoundary^> >> %TASK_FILE%
echo       ^<Enabled^>true^</Enabled^> >> %TASK_FILE%
echo       ^<ScheduleByWeek^> >> %TASK_FILE%
echo         ^<WeeksInterval^>1^</WeeksInterval^> >> %TASK_FILE%
echo         ^<DaysOfWeek^> >> %TASK_FILE%
echo           ^<Sunday /^> >> %TASK_FILE%
echo         ^</DaysOfWeek^> >> %TASK_FILE%
echo       ^</ScheduleByWeek^> >> %TASK_FILE%
echo     ^</CalendarTrigger^> >> %TASK_FILE%
echo   ^</Triggers^> >> %TASK_FILE%
echo   ^<Principals^> >> %TASK_FILE%
echo     ^<Principal id="Author"^> >> %TASK_FILE%
echo       ^<LogonType^>InteractiveToken^</LogonType^> >> %TASK_FILE%
echo       ^<RunLevel^>HighestAvailable^</RunLevel^> >> %TASK_FILE%
echo     ^</Principal^> >> %TASK_FILE%
echo   ^</Principals^> >> %TASK_FILE%
echo   ^<Settings^> >> %TASK_FILE%
echo     ^<MultipleInstancesPolicy^>IgnoreNew^</MultipleInstancesPolicy^> >> %TASK_FILE%
echo     ^<DisallowStartIfOnBatteries^>false^</DisallowStartIfOnBatteries^> >> %TASK_FILE%
echo     ^<StopIfGoingOnBatteries^>false^</StopIfGoingOnBatteries^> >> %TASK_FILE%
echo     ^<AllowHardTerminate^>true^</AllowHardTerminate^> >> %TASK_FILE%
echo     ^<StartWhenAvailable^>true^</StartWhenAvailable^> >> %TASK_FILE%
echo     ^<RunOnlyIfNetworkAvailable^>false^</RunOnlyIfNetworkAvailable^> >> %TASK_FILE%
echo     ^<AllowStartOnDemand^>true^</AllowStartOnDemand^> >> %TASK_FILE%
echo     ^<Enabled^>true^</Enabled^> >> %TASK_FILE%
echo     ^<Hidden^>false^</Hidden^> >> %TASK_FILE%
echo     ^<RunOnlyIfIdle^>false^</RunOnlyIfIdle^> >> %TASK_FILE%
echo     ^<WakeToRun^>false^</WakeToRun^> >> %TASK_FILE%
echo     ^<ExecutionTimeLimit^>PT1H^</ExecutionTimeLimit^> >> %TASK_FILE%
echo     ^<Priority^>7^</Priority^> >> %TASK_FILE%
echo   ^</Settings^> >> %TASK_FILE%
echo   ^<Actions Context="Author"^> >> %TASK_FILE%
echo     ^<Exec^> >> %TASK_FILE%
echo       ^<Command^>%CD%\%VERIFY_SCRIPT%^</Command^> >> %TASK_FILE%
echo       ^<WorkingDirectory^>%CD%^</WorkingDirectory^> >> %TASK_FILE%
echo     ^</Exec^> >> %TASK_FILE%
echo   ^</Actions^> >> %TASK_FILE%
echo ^</Task^> >> %TASK_FILE%

schtasks /create /tn %TASK_NAME% /xml %TASK_FILE% /f >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Attività pianificata creata con successo: %TASK_NAME%
    echo Verrà eseguita automaticamente ogni domenica alle 2:30
) else (
    echo NOTA: Impossibile configurare automaticamente l'attività pianificata.
    echo Per configurarla manualmente:
    echo 1. Apri Task Scheduler ^(taskschd.msc^)
    echo 2. Importa il file %TASK_FILE%
    echo 3. Segui le istruzioni a schermo
)

del %TASK_FILE% >nul 2>&1

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