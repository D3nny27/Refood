@echo on
setlocal

echo ===================================
echo DEBUG - Installazione Refood
echo ===================================

echo.
echo STEP 1: Verifica prerequisiti
echo.
where node
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Node.js non trovato!
    goto :fine
)
echo Node version:
node -v

echo.
echo npm version:
npm -v

echo.
echo VERIFICA PREREQUISITI COMPLETATA
pause

echo.
echo STEP 2: Vuoi installare i pacchetti globali? (S/N)
set /p risposta=
if /i "%risposta%"=="S" (
    echo.
    echo Installazione nodemon...
    npm install -g nodemon
    echo.
    echo Installazione expo-cli...
    npm install -g expo-cli
) else (
    echo Installazione pacchetti globali saltata.
)
echo.
pause

echo.
echo STEP 3: Installazione dipendenze backend
if not exist "backend" (
    echo ERRORE: La directory backend non esiste!
    goto :fine
)
echo Directory backend trovata.
cd backend
echo Esecuzione npm install nel backend...
npm install
cd ..
echo.
pause

echo.
echo STEP 4: Vuoi configurare il database SQLite? (S/N)
set /p risposta=
if /i "%risposta%"=="S" (
    echo.
    echo Creazione directory database...
    if not exist "database" mkdir database

    echo.
    echo Verifica SQLite...
    where sqlite3
    if %ERRORLEVEL% NEQ 0 (
        echo SQLite non trovato, vuoi scaricarlo? (S/N)
        set /p scarica=
        if /i "%scarica%"=="S" (
            echo Scaricamento SQLite in corso...
            mkdir temp
            cd temp
            powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.sqlite.org/2023/sqlite-tools-win32-x86-3400100.zip' -OutFile 'sqlite.zip'}"
            echo Estrazione...
            powershell -Command "& {Expand-Archive -Path 'sqlite.zip' -DestinationPath '.'}"
            echo Installazione...
            move sqlite-tools-win32-x86-3400100\*.* ..\database\
            cd ..
            rmdir /s /q temp
            set "PATH=%PATH%;%CD%\database"
        )
    ) else (
        echo SQLite trovato nel sistema.
    )

    echo.
    echo Creazione database...
    cd backend
    if exist "schema.sql" (
        echo Applicazione schema.sql...
        sqlite3 ..\database\refood.db < schema.sql
    ) else (
        echo AVVISO: schema.sql non trovato!
    )

    if exist "custom_sqlite_functions.sql" (
        echo Applicazione custom_sqlite_functions.sql...
        sqlite3 ..\database\refood.db < custom_sqlite_functions.sql
    ) else (
        echo AVVISO: custom_sqlite_functions.sql non trovato!
    )

    if exist "setup_database_views.sql" (
        echo Applicazione setup_database_views.sql...
        sqlite3 ..\database\refood.db < setup_database_views.sql
    ) else (
        echo AVVISO: setup_database_views.sql non trovato!
    )
) else (
    echo Configurazione database saltata.
)
echo.
pause

echo.
echo STEP 5: Creazione file .env del backend
cd backend
echo PORT=3000 > .env
echo JWT_SECRET=refood_secure_key_auto_generated >> .env
echo JWT_EXPIRATION=24h >> .env
echo DATABASE_PATH=../database/refood.db >> .env
echo NODE_ENV=development >> .env
echo API_PREFIX=/api/v1 >> .env
echo LOG_LEVEL=info >> .env
echo File .env creato.
cd ..
echo.
pause

echo.
echo STEP 6: Installazione dipendenze frontend mobile
if not exist "refood-mobile" (
    echo ERRORE: La directory refood-mobile non esiste!
    goto :fine
)
cd refood-mobile
echo Esecuzione npm install nel frontend...
npm install
echo.
pause

echo.
echo STEP 7: Creazione file .env del frontend
echo Utilizzo localhost come indirizzo IP...
echo # Configurazione API per il frontend mobile > .env
echo # Modifica questo indirizzo se necessario per dispositivi fisici >> .env
echo API_URL=http://127.0.0.1:3000/api/v1 >> .env
echo File .env creato.
cd ..
echo.
pause

echo.
echo STEP 8: Creazione directory per script manutenzione
if not exist "maintenance_scripts" mkdir maintenance_scripts
echo Directory maintenance_scripts creata.
echo.

echo ===================================
echo Installazione completata!
echo ===================================

:fine
echo.
echo Script terminato.
pause
endlocal 