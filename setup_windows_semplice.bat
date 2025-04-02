@echo off
echo ===================================
echo Installazione Semplificata Refood
echo ===================================
echo.

echo [1/8] Verifica Node.js e npm...
where node
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Node.js non trovato!
    echo Installalo da https://nodejs.org/
    goto :errore
)
echo Node.js trovato: 
node -v

where npm
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: npm non trovato!
    goto :errore
)
echo npm trovato:
npm -v

echo.
echo [2/8] Backend: creazione cartelle e .env
if not exist "backend" (
    echo ERRORE: La directory backend non esiste!
    goto :errore
)

cd backend
echo Creazione file .env per il backend...
echo PORT=3000 > .env
echo JWT_SECRET=refood_secure_key_auto_generated >> .env
echo JWT_EXPIRATION=24h >> .env
echo DATABASE_PATH=../database/refood.db >> .env
echo NODE_ENV=development >> .env
echo API_PREFIX=/api/v1 >> .env
echo LOG_LEVEL=info >> .env
cd ..

echo.
echo [3/8] Frontend: creazione file .env
if not exist "refood-mobile" (
    echo ERRORE: La directory refood-mobile non esiste!
    goto :errore
)

cd refood-mobile
echo Creazione file .env per il frontend...
echo # Configurazione API per il frontend mobile > .env
echo # Modifica questo indirizzo se necessario per dispositivi fisici >> .env
echo API_URL=http://127.0.0.1:3000/api/v1 >> .env
cd ..

echo.
echo [4/8] Creazione directory per database e script manutenzione
if not exist "database" mkdir database
if not exist "maintenance_scripts" mkdir maintenance_scripts

echo.
echo [5/8] Verifica SQLite e installazione se necessario
where sqlite3
if %ERRORLEVEL% NEQ 0 (
    echo SQLite non trovato. Scaricamento in corso...
    
    if not exist "temp" mkdir temp
    cd temp
    
    echo Scaricamento SQLite...
    powershell -Command "Invoke-WebRequest -Uri 'https://www.sqlite.org/2023/sqlite-tools-win32-x86-3400100.zip' -OutFile 'sqlite.zip'"
    
    echo Estrazione SQLite...
    powershell -Command "Expand-Archive -Path 'sqlite.zip' -DestinationPath '.'"
    
    echo Installazione SQLite...
    move sqlite-tools-win32-x86-3400100\*.* ..\database\
    
    cd ..
    rmdir /s /q temp
    
    echo SQLite installato localmente.
) else (
    echo SQLite trovato nel sistema.
)

echo.
echo [6/8] Installazione dipendenze backend
cd backend
echo Installazione npm del backend...
call npm install
cd ..

echo.
echo [7/8] Installazione dipendenze frontend
cd refood-mobile
echo Installazione npm del frontend...
call npm install
cd ..

echo.
echo [8/8] Installazione pacchetti globali
echo Installazione nodemon...
call npm install -g nodemon
echo Installazione expo-cli...
call npm install -g expo-cli

echo.
echo =======================================
echo Installazione completata con successo!
echo =======================================
echo.
echo Puoi avviare il backend con:
echo   cd backend
echo   npm run dev
echo.
echo Puoi avviare il frontend con:
echo   cd refood-mobile
echo   npx expo start
echo.
goto :fine

:errore
echo.
echo ERRORE: L'installazione è fallita.
echo Controlla i messaggi di errore sopra.

:fine
echo Premi un tasto qualsiasi per uscire...
pause >nul 