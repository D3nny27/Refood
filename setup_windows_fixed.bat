@echo off
setlocal enabledelayedexpansion

echo ===================================
echo Installazione automatica di Refood
echo ===================================
echo.

REM *** 1. Verifica dei prerequisiti ***
echo 1. Verifica dei prerequisiti...
set PREREQUISITES_OK=true

REM Verifica Node.js
where node >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo ERRORE: Node.js non trovato. Per favore installalo da https://nodejs.org/
    set PREREQUISITES_OK=false
) else (
    echo Node.js trovato:
    node -v
)

REM Verifica npm
where npm >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo ERRORE: npm non trovato. Per favore reinstalla Node.js da https://nodejs.org/
    set PREREQUISITES_OK=false
) else (
    echo npm trovato:
    npm -v
)

REM Verifica se i prerequisiti sono OK
if "%PREREQUISITES_OK%"=="false" (
    echo Risolvi i problemi dei prerequisiti e riprova.
    goto :end
)

echo Tutti i prerequisiti sono soddisfatti.
echo.

REM *** 2. Installazione delle dipendenze globali ***
echo 2. Installazione delle dipendenze globali...
call npm install -g nodemon
if !ERRORLEVEL! NEQ 0 (
    echo ERRORE durante l'installazione di nodemon. Continuo comunque...
)

call npm install -g expo-cli
if !ERRORLEVEL! NEQ 0 (
    echo ERRORE durante l'installazione di expo-cli. Continuo comunque...
)

echo Installazione dipendenze globali completata.
echo.

REM *** 3. Installazione delle dipendenze del backend ***
echo 3. Installazione delle dipendenze del progetto backend...
if not exist "backend" (
    echo ERRORE: La directory 'backend' non esiste!
    goto :end
)

cd backend
echo Installazione dipendenze backend in corso...
call npm install
if !ERRORLEVEL! NEQ 0 (
    echo AVVISO: Possibili errori durante l'installazione delle dipendenze backend.
    echo L'installazione proseguirà comunque.
)
echo Dipendenze backend installate.
cd ..
echo.

REM *** 4. Configurazione del database ***
echo 4. Configurazione automatica del database...
if not exist "database" (
    echo Creazione directory database...
    mkdir database
)

REM Controllo se SQLite è installato
set SQLITE_OK=true
where sqlite3 >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo SQLite non trovato. Scarico SQLite...
    set SQLITE_OK=false
    
    REM Crea directory temporanea
    if not exist "temp" mkdir temp
    cd temp
    
    echo Scaricamento SQLite in corso...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.sqlite.org/2023/sqlite-tools-win32-x86-3400100.zip' -OutFile 'sqlite.zip'}"
    
    if not exist "sqlite.zip" (
        echo ERRORE: Download SQLite fallito.
        cd ..
        goto :database_error
    )
    
    echo Estrazione SQLite...
    powershell -Command "& {Expand-Archive -Path 'sqlite.zip' -DestinationPath '.' -Force}"
    
    if not exist "sqlite-tools-win32-x86-3400100" (
        echo ERRORE: Estrazione SQLite fallita.
        cd ..
        goto :database_error
    )
    
    echo Installazione SQLite...
    move sqlite-tools-win32-x86-3400100\*.* ..\database\ >nul 2>&1
    
    cd ..
    rmdir /s /q temp
    
    echo Aggiunta SQLite al PATH temporaneo...
    set "PATH=%PATH%;%CD%\database"
) else (
    echo SQLite già installato nel sistema.
)

REM Test SQLite
echo.
echo Test SQLite in corso...
cd database
sqlite3 --version >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    cd ..
    echo ERRORE: SQLite non funziona correttamente.
    goto :database_error
)
cd ..
echo SQLite funziona correttamente.

REM Inizializza database
echo.
echo Inizializzazione del database...
cd backend

REM Verifica i file SQL
if not exist "schema.sql" (
    echo ERRORE: File schema.sql non trovato!
    cd ..
    goto :database_error
)

if not exist "custom_sqlite_functions.sql" (
    echo ERRORE: File custom_sqlite_functions.sql non trovato!
    cd ..
    goto :database_error
)

if not exist "setup_database_views.sql" (
    echo ERRORE: File setup_database_views.sql non trovato!
    cd ..
    goto :database_error
)

REM Crea schema database
echo Creazione schema database in corso...
if "%SQLITE_OK%"=="false" (
    ..\database\sqlite3.exe ..\database\refood.db < schema.sql
) else (
    sqlite3 ..\database\refood.db < schema.sql
)

if !ERRORLEVEL! NEQ 0 (
    echo ERRORE: Impossibile applicare lo schema al database.
    cd ..
    goto :database_error
)

REM Configura funzioni personalizzate SQLite
echo Configurazione funzioni personalizzate SQLite...
if "%SQLITE_OK%"=="false" (
    ..\database\sqlite3.exe ..\database\refood.db < custom_sqlite_functions.sql
) else (
    sqlite3 ..\database\refood.db < custom_sqlite_functions.sql
)

if !ERRORLEVEL! NEQ 0 (
    echo ERRORE: Impossibile applicare le funzioni personalizzate al database.
    cd ..
    goto :database_error
)

REM Configura viste database
echo Configurazione viste database...
if "%SQLITE_OK%"=="false" (
    ..\database\sqlite3.exe ..\database\refood.db < setup_database_views.sql
) else (
    sqlite3 ..\database\refood.db < setup_database_views.sql
)

if !ERRORLEVEL! NEQ 0 (
    echo ERRORE: Impossibile configurare le viste del database.
    cd ..
    goto :database_error
)

echo Database inizializzato con successo.
goto :database_ok

:database_error
echo ERRORE: Configurazione database fallita.
echo Tenta di eseguire questi passaggi manualmente o contatta l'assistenza.
goto :end

:database_ok
echo.

REM *** 5. Configurazione dell'ambiente backend ***
echo 5. Configurazione dell'ambiente backend...
echo Creazione del file .env per il backend...

echo PORT=3000 > .env
echo JWT_SECRET=refood_secure_key_auto_generated >> .env
echo JWT_EXPIRATION=24h >> .env
echo DATABASE_PATH=../database/refood.db >> .env
echo NODE_ENV=development >> .env
echo API_PREFIX=/api/v1 >> .env
echo LOG_LEVEL=info >> .env

echo File .env del backend creato con successo.
echo.

REM *** 6. Installazione delle dipendenze del frontend mobile ***
echo 6. Installazione delle dipendenze del frontend mobile...
cd ..

if not exist "refood-mobile" (
    echo ERRORE: La directory 'refood-mobile' non esiste!
    goto :end
)

cd refood-mobile
echo Installazione dipendenze frontend in corso...
call npm install
if !ERRORLEVEL! NEQ 0 (
    echo AVVISO: Possibili errori durante l'installazione delle dipendenze frontend.
    echo L'installazione proseguirà comunque.
)
echo Dipendenze frontend installate.
echo.

REM *** 7. Configurazione dell'ambiente frontend ***
echo 7. Configurazione dell'ambiente frontend...
echo Rilevamento indirizzo IP in corso...
set IP=127.0.0.1

REM Prova a ottenere l'IP con ipconfig
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    set IP=!IP:~1!
    goto :got_ip
)

:got_ip
if "!IP!"=="" set IP=127.0.0.1

echo Indirizzo IP rilevato: !IP!
echo Creazione del file .env per il frontend...

echo # Configurazione API per il frontend mobile > .env
echo # Modifica questo indirizzo se necessario per dispositivi fisici >> .env
echo API_URL=http://!IP!:3000/api/v1 >> .env

echo File .env del frontend creato con successo.
echo.

REM *** 8. Creazione dei file per la manutenzione automatica ***
echo 8. Creazione dei file per la manutenzione automatica...
cd ..
if not exist "maintenance_scripts" mkdir maintenance_scripts
echo Directory maintenance_scripts creata.
echo.

REM *** COMPLETATO ***
echo ===================================
echo Installazione completata con successo!
echo.
echo Per avviare il backend:
echo   cd backend
echo   npm run dev
echo.
echo Per avviare il frontend:
echo   cd refood-mobile
echo   npx expo start
echo.
echo Nota: Se stai usando un dispositivo fisico per testare,
echo modifica il file refood-mobile\.env per usare il tuo indirizzo IP reale
echo se quello rilevato automaticamente (!IP!) non funziona.
echo ===================================

:end
pause
endlocal 