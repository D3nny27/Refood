@echo off
echo ===================================
echo Installazione automatica di Refood
echo ===================================
echo.

echo 1. Verifica dei prerequisiti...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Node.js non trovato. Per favore installalo da https://nodejs.org/
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: npm non trovato. Per favore reinstalla Node.js da https://nodejs.org/
    exit /b 1
)

echo Node.js trovato: 
node -v
echo npm trovato:
npm -v
echo.

echo 2. Installazione delle dipendenze globali...
call npm install -g nodemon expo-cli
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Impossibile installare le dipendenze globali
    exit /b 1
)
echo Dipendenze globali installate correttamente.
echo.

echo 3. Installazione delle dipendenze del progetto backend...
cd backend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Impossibile installare le dipendenze del backend
    cd ..
    exit /b 1
)
echo Dipendenze del backend installate correttamente.
echo.

echo 4. Configurazione automatica del database...
cd ..
if not exist "database" mkdir database
echo Creazione directory database completata.

REM Controllo se SQLite è installato
where sqlite3 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo SQLite non trovato. Installazione in corso...
    
    REM Crea una directory temporanea per SQLite
    if not exist "temp" mkdir temp
    cd temp
    
    echo Scaricamento di SQLite...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.sqlite.org/2023/sqlite-tools-win32-x86-3400100.zip' -OutFile 'sqlite.zip'}"
    
    echo Estrazione di SQLite...
    powershell -Command "& {Expand-Archive -Path 'sqlite.zip' -DestinationPath '.'}"
    
    echo Installazione di SQLite...
    move sqlite-tools-win32-x86-3400100\*.* ..\database\ >nul
    
    cd ..
    echo Pulizia file temporanei...
    rmdir /s /q temp
    
    echo Aggiunta di SQLite al PATH temporaneo...
    set "PATH=%PATH%;%CD%\database"
    echo SQLite installato con successo.
) else (
    echo SQLite già installato nel sistema.
)

echo.
echo Inizializzazione del database...
pushd database
sqlite3 --version
popd

echo Applicazione dello schema al database...
cd backend
if not exist "schema.sql" (
    echo ERRORE: File schema.sql non trovato nella directory backend
    cd ..
    exit /b 1
)

if not exist "custom_sqlite_functions.sql" (
    echo ERRORE: File custom_sqlite_functions.sql non trovato nella directory backend
    cd ..
    exit /b 1
)

if not exist "setup_database_views.sql" (
    echo ERRORE: File setup_database_views.sql non trovato nella directory backend
    cd ..
    exit /b 1
)

echo Creazione schema database...
..\database\sqlite3.exe ..\database\refood.db < schema.sql
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Impossibile applicare lo schema al database
    cd ..
    exit /b 1
)

echo Configurazione funzioni personalizzate SQLite...
..\database\sqlite3.exe ..\database\refood.db < custom_sqlite_functions.sql
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Impossibile applicare le funzioni personalizzate al database
    cd ..
    exit /b 1
)

echo Configurazione viste database...
..\database\sqlite3.exe ..\database\refood.db < setup_database_views.sql
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Impossibile configurare le viste del database
    cd ..
    exit /b 1
)
echo Database inizializzato con successo.
echo.

echo 5. Configurazione dell'ambiente backend...
echo Creazione del file .env per il backend...
(
echo PORT=3000
echo JWT_SECRET=refood_secure_key_auto_generated
echo JWT_EXPIRATION=24h
echo DATABASE_PATH=../database/refood.db
echo NODE_ENV=development
echo API_PREFIX=/api/v1
echo LOG_LEVEL=info
) > .env
echo File .env del backend creato con successo.
echo.

echo 6. Installazione delle dipendenze del frontend mobile...
cd ..
cd refood-mobile
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Impossibile installare le dipendenze del frontend mobile
    cd ..
    exit /b 1
)

echo 7. Configurazione dell'ambiente frontend...
echo Rilevamento indirizzo IP in corso...
for /f "tokens=4" %%a in ('route print ^| find " 0.0.0.0"') do (
    set IP=%%a
    goto :break
)
:break

if "%IP%"=="" (
    echo AVVISO: Impossibile rilevare l'IP automaticamente. Utilizzo 127.0.0.1
    set IP=127.0.0.1
)

echo Creazione del file .env per il frontend...
(
echo # Configurazione API per il frontend mobile
echo # Modifica questo indirizzo se necessario per dispositivi fisici
echo API_URL=http://%IP%:3000/api/v1
) > .env
echo File .env del frontend creato con successo.
echo.

echo 8. Creazione dei file per la manutenzione automatica...
cd ..
if not exist "maintenance_scripts" mkdir maintenance_scripts
echo Directory maintenance_scripts creata.
echo.

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
echo se quello rilevato automaticamente (%IP%) non funziona.
echo =================================== 