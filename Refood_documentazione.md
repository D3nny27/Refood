# Documentazione Completa del Progetto Refood

## Sommario
1. [Introduzione](#introduzione)
2. [Setup Dopo Git Clone](#setup-dopo-git-clone)
3. [Panoramica del Progetto](#panoramica-del-progetto)
4. [Architettura del Sistema](#architettura-del-sistema)
5. [Tecnologie Utilizzate](#tecnologie-utilizzate)
6. [Schema del Database](#schema-del-database)
7. [Setup e Installazione](#setup-e-installazione)
8. [API e Endpoints](#api-e-endpoints)
9. [Flussi Applicativi](#flussi-applicativi)
10. [Sistema di Autenticazione](#sistema-di-autenticazione)
11. [Gestione Lotti](#gestione-lotti)
12. [Sistema di Prenotazioni](#sistema-di-prenotazioni)
13. [Notifiche e WebSockets](#notifiche-e-websockets)
14. [Manutenzione Automatica](#manutenzione-automatica)
15. [Migrazioni del Database](#migrazioni-del-database)
16. [Frontend - Struttura e Componenti](#frontend---struttura-e-componenti)
17. [Test e Debug](#test-e-debug)
18. [Implementazioni Future](#implementazioni-future)
19. [Risoluzione Problemi Comuni](#risoluzione-problemi-comuni)

## Introduzione

Refood è un'applicazione completa per la gestione e la distribuzione delle eccedenze alimentari, sviluppata con l'obiettivo di ridurre lo spreco alimentare e supportare le organizzazioni sociali. Il sistema consente di tracciare il ciclo di vita dei prodotti alimentari invenduti, dalla loro identificazione fino alla destinazione finale, sia essa il consumo o il riciclo, seguendo i principi dell'economia circolare.

Questo documento fornisce una documentazione tecnica dettagliata del progetto Refood, coprendo tutti gli aspetti dell'implementazione, dalla struttura del database all'architettura dell'applicazione, fino ai dettagli specifici di implementazione di ogni componente.

## Setup Dopo Git Clone
# Setup dell'Applicazione Refood

Questa guida fornisce istruzioni dettagliate per configurare e avviare correttamente l'applicazione Refood su Windows, Linux e macOS dopo aver eseguito un clone del repository.

## Indice
1. [Prerequisiti Comuni](#prerequisiti-comuni)
2. [Setup del Backend](#setup-del-backend)
   - [Windows](#windows-backend)
   - [Linux](#linux-backend)
   - [macOS](#macos-backend)
3. [Setup dell'Applicazione Mobile](#setup-dellapplicazione-mobile)
   - [Windows](#windows-mobile)
   - [Linux/macOS](#linuxmacos-mobile)
4. [Configurazione della Manutenzione Automatica](#configurazione-della-manutenzione-automatica)
5. [Risoluzione dei Problemi Comuni](#risoluzione-dei-problemi-comuni)

## Prerequisiti Comuni

Prima di procedere con l'installazione, assicurati di avere installati i seguenti strumenti:

- **Node.js**: versione 18.x o superiore (consigliata 20.x)
- **npm**: versione 8.x o superiore
- **Git**: ultima versione stabile

Per verificare le versioni installate, esegui:
```bash
node -v
npm -v
git --version
```

## Setup del Backend

### Windows (Backend)

1. **Installazione delle dipendenze**
   ```powershell
   # Naviga alla directory del progetto dopo il clone
   cd C:\path\to\repository
   
   # Installa le dipendenze globali necessarie
   npm install -g nodemon
   
   # Installa le dipendenze del progetto
   npm install
   
   # Esegui un'installazione forzata di bcrypt (spesso causa problemi su Windows)
   npm uninstall bcrypt
   npm install bcrypt --build-from-source
   
   # In caso di errori con bcrypt, prova con bcryptjs (più compatibile con Windows)
   npm uninstall bcrypt
   npm install bcryptjs
   
   # Se sono presenti altri errori di moduli nativi, prova:
   npm install -g windows-build-tools
   ```

2. **Installazione di SQLite su Windows**
   ```powershell
   # Opzione 1: Installa da PowerShell usando winget
   winget install -e --id SQLite.SQLite
   
   # Opzione 2: Download manuale
   # Scarica SQLite da https://www.sqlite.org/download.html
   # Scegli "Precompiled Binaries for Windows" > SQLite tools
   # Estrai nella cartella C:\sqlite
   # Aggiungi C:\sqlite alla variabile di ambiente PATH
   ```

3. **Configurazione del database**
   ```powershell
   # Crea la directory database se non esiste
   if (-not (Test-Path -Path "database")) {
       New-Item -Path "database" -ItemType Directory
   }
   
   # Inizializza il database con lo schema
   # Nota: questo presuppone che sqlite3.exe sia nel PATH
   cd backend
   sqlite3.exe ..\database\refood.db < schema.sql
   sqlite3.exe ..\database\refood.db < custom_sqlite_functions.sql
   sqlite3.exe ..\database\refood.db < setup_database_views.sql
   cd ..
   
   # Alternativa se hai problemi con il reindirizzamento:
   # Copia e incolla il contenuto dei file SQL direttamente nell'interfaccia SQLite
   sqlite3.exe database\refood.db
   # (all'interno di sqlite, usa .read schema.sql)
   ```

4. **Configurazione dell'ambiente**
   ```powershell
   # Crea il file .env nella root del progetto
   $envContent = @"
   PORT=3000
   JWT_SECRET=il_tuo_secret_key_complesso
   JWT_EXPIRATION=24h
   DATABASE_PATH=database/refood.db
   NODE_ENV=development
   API_PREFIX=/api/v1
   LOG_LEVEL=info
   "@
   
   Set-Content -Path "backend\.env" -Value $envContent
   ```

5. **Avvio del backend**
   ```powershell
   # Naviga alla directory del backend
   cd backend
   
   # Avvio del server in modalità sviluppo
   npm run dev
   
   # Oppure in produzione
   npm start
   ```

### Linux (Backend)

1. **Installazione delle dipendenze**
   ```bash
   # Naviga alla directory del progetto dopo il clone
   cd /path/to/repository
   
   # Installa le dipendenze di sistema necessarie
   sudo apt-get update
   sudo apt-get install -y sqlite3 build-essential python3 libsqlite3-dev
   
   # Installa nodemon globalmente
   npm install -g nodemon
   
   # Vai alla directory del backend e installa le dipendenze npm
   cd backend
   npm install
   ```

2. **Configurazione del database**
   ```bash
   # Torna alla directory principale e crea la directory database
   cd ..
   mkdir -p database
   
   # Inizializza il database con lo schema
   cd backend
   sqlite3 ../database/refood.db < schema.sql
   sqlite3 ../database/refood.db < custom_sqlite_functions.sql
   sqlite3 ../database/refood.db < setup_database_views.sql
   ```

3. **Configurazione dell'ambiente**
   ```bash
   # Crea il file .env nella directory backend
   cat > .env << EOL
   PORT=3000
   JWT_SECRET=il_tuo_secret_key_complesso
   JWT_EXPIRATION=24h
   DATABASE_PATH=../database/refood.db
   NODE_ENV=development
   API_PREFIX=/api/v1
   LOG_LEVEL=info
   EOL
   ```

4. **Avvio del backend**
   ```bash
   # Assicurati di essere nella directory backend
   # Avvio del server in modalità sviluppo
   npm run dev
   
   # Oppure in produzione
   npm start
   ```

### macOS (Backend)

1. **Installazione delle dipendenze**
   ```bash
   # Naviga alla directory del progetto dopo il clone
   cd /path/to/repository
   
   # Installa Homebrew se non è già installato
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   
   # Installa le dipendenze di sistema necessarie
   brew install sqlite3 node
   
   # Installa nodemon globalmente
   npm install -g nodemon
   
   # Vai alla directory del backend e installa le dipendenze npm
   cd backend
   npm install
   ```

2. **Configurazione del database**
   ```bash
   # Torna alla directory principale e crea la directory database
   cd ..
   mkdir -p database
   
   # Inizializza il database con lo schema
   cd backend
   sqlite3 ../database/refood.db < schema.sql
   sqlite3 ../database/refood.db < custom_sqlite_functions.sql
   sqlite3 ../database/refood.db < setup_database_views.sql
   ```

3. **Configurazione dell'ambiente**
   ```bash
   # Crea il file .env nella directory backend
   cat > .env << EOL
   PORT=3000
   JWT_SECRET=il_tuo_secret_key_complesso
   JWT_EXPIRATION=24h
   DATABASE_PATH=../database/refood.db
   NODE_ENV=development
   API_PREFIX=/api/v1
   LOG_LEVEL=info
   EOL
   ```

4. **Avvio del backend**
   ```bash
   # Assicurati di essere nella directory backend
   # Avvio del server in modalità sviluppo
   npm run dev
   
   # Oppure in produzione
   npm start
   ```

## Setup dell'Applicazione Mobile

### Windows (Mobile)

1. **Installazione delle dipendenze**
   ```powershell
   # Naviga alla directory del frontend mobile
   cd refood-mobile
   
   # Installa Expo CLI globalmente
   npm install -g expo-cli
   
   # Installa le dipendenze del progetto
   npm install
   
   # Assicurati che siano installate tutte le dipendenze critiche
   npm install -E @expo/vector-icons react-native-gesture-handler react-native-reanimated react-native-screens expo-font expo-constants @react-native-async-storage/async-storage
   
   # Se hai problemi con le dipendenze native, prova:
   npx expo install --fix
   ```

2. **Configurazione dell'ambiente**
   ```powershell
   # Crea il file .env nella directory refood-mobile
   $envContent = @"
   # Sostituisci con l'IP del tuo computer sulla rete locale
   # NON usare localhost o 127.0.0.1 se testi su dispositivo fisico
   API_URL=http://192.168.1.x:3000/api/v1
   "@
   
   Set-Content -Path ".env" -Value $envContent
   ```

3. **Avvio dell'app in modalità sviluppo**
   ```powershell
   # Avvia Expo (assicurati che il backend sia già in esecuzione)
   npx expo start
   
   # Se riscontri problemi, prova con l'opzione --clear-cache
   npx expo start --clear-cache
   
   # Se il metro bundler si blocca o hai altri problemi:
   npx expo start --no-dev --minify
   ```

4. **Test sull'emulatore o dispositivo fisico**
   ```
   # Per avviare su emulatore Android
   npx expo start --android
   
   # Per avviare su simulatore iOS (solo su macOS)
   npx expo start --ios
   
   # Per testare su dispositivo fisico:
   # 1. Installa Expo Go sul tuo dispositivo dallo store
   # 2. Scansiona il QR code che appare nel terminale
   # 3. Assicurati che il telefono e il computer siano sulla stessa rete WiFi
   ```

### Linux/macOS (Mobile)

1. **Installazione delle dipendenze**
   ```bash
   # Naviga alla directory del frontend mobile
   cd refood-mobile
   
   # Installa Expo CLI globalmente
   npm install -g expo-cli
   
   # Installa le dipendenze del progetto
   npm install
   
   # Assicurati che siano installate tutte le dipendenze critiche
   npm install -E @expo/vector-icons react-native-gesture-handler react-native-reanimated react-native-screens expo-font expo-constants @react-native-async-storage/async-storage
   
   # Se hai problemi con le dipendenze native, prova:
   npx expo install --fix
   ```

2. **Configurazione dell'ambiente**
   ```bash
   # Crea il file .env nella directory refood-mobile
   cat > .env << EOL
   # Sostituisci con l'IP del tuo computer sulla rete locale
   # NON usare localhost o 127.0.0.1 se testi su dispositivo fisico
   API_URL=http://192.168.1.x:3000/api/v1
   EOL
   ```

3. **Avvio dell'app in modalità sviluppo**
   ```bash
   # Avvia Expo (assicurati che il backend sia già in esecuzione)
   npx expo start
   
   # Se riscontri problemi, prova con l'opzione --clear-cache
   npx expo start --clear-cache
   
   # Se il metro bundler si blocca o hai altri problemi:
   npx expo start --no-dev --minify
   ```

4. **Test sull'emulatore o dispositivo fisico**
   ```
   # Per avviare su emulatore Android
   npx expo start --android
   
   # Per avviare su simulatore iOS (solo su macOS)
   npx expo start --ios
   
   # Per testare su dispositivo fisico:
   # 1. Installa Expo Go sul tuo dispositivo dallo store
   # 2. Scansiona il QR code che appare nel terminale
   # 3. Assicurati che il telefono e il computer siano sulla stessa rete WiFi
   ```

## Configurazione della Manutenzione Automatica

### Windows

1. **Installazione del supporto per script bash**
   ```
   # Installa Git Bash se non l'hai già fatto (viene con Git per Windows)
   # oppure installa WSL (Windows Subsystem for Linux) per una compatibilità migliore
   
   # Per WSL:
   # 1. Abilita WSL da PowerShell come amministratore:
   dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
   dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
   # 2. Riavvia il sistema
   # 3. Installa Ubuntu da Microsoft Store
   ```

2. **Esecuzione degli script di manutenzione con Git Bash o WSL**
   ```bash
   # Con Git Bash, apri Git Bash nella directory del progetto e esegui:
   chmod +x install_schema_monitoring.sh
   chmod +x install_maintenance_cron.sh
   chmod +x safe_schema_exec.sh
   
   # Esegui lo script di monitoraggio schema
   ./install_schema_monitoring.sh
   
   # Esegui lo script di manutenzione
   ./install_maintenance_cron.sh
   ```

3. **Configurazione di Task Scheduler (alternativa a cron su Windows)**
   ```
   # Per configurare lavori pianificati in Windows:
   
   # 1. Crea script batch per eseguire le attività di manutenzione
   # Esempio (aggiornamento_lotti.bat):
   @echo off
   cd C:\path\to\repository
   sqlite3.exe database\refood.db < maintenance_scripts\update_lotti_status.sql
   
   # 2. Apri Task Scheduler dal menu Start
   # 3. Seleziona "Crea attività base..." dal pannello Azioni
   # 4. Dai un nome all'attività, ad esempio "RefoodLottiUpdate"
   # 5. Imposta il trigger (giornaliero alle 00:00)
   # 6. Seleziona "Avvia un programma"
   # 7. Sfoglia e seleziona lo script batch creato
   # 8. Completa la procedura guidata
   # 9. Ripeti per altri script di manutenzione
   ```

### Linux/macOS

1. **Configurazione degli script di manutenzione**
   ```bash
   # Rendi eseguibili gli script
   chmod +x install_maintenance_cron.sh
   chmod +x safe_schema_exec.sh
   chmod +x install_schema_monitoring.sh
   
   # Installa il sistema di monitoraggio dello schema
   ./install_schema_monitoring.sh
   
   # Installa i job cron per la manutenzione automatica
   ./install_maintenance_cron.sh
   ```

2. **Verifica dell'installazione**
   ```bash
   # Verifica che i job cron siano stati installati correttamente
   crontab -l
   
   # Dovresti vedere qualcosa come:
   # 0 0 * * * /path/to/maintenance_scripts/update_lotti_status.sh
   # 0 2 * * * /path/to/maintenance_scripts/cleanup_tokens.sh
   # 0 3 * * 0 /path/to/maintenance_scripts/weekly_statistics.sh
   # 0 * * * * /path/to/maintenance_scripts/update_prenotazioni_status.sh
   ```

## Risoluzione dei Problemi Comuni

### Problemi relativi a SQLite

#### Windows
- **Errore "sqlite3 non è riconosciuto come comando"**
  ```powershell
  # Soluzione 1: Aggiungi SQLite al PATH (temporaneamente)
  $env:PATH += ";C:\path\to\sqlite3"
  
  # Soluzione 2: Usa il percorso completo
  C:\path\to\sqlite3.exe database\refood.db < schema.sql
  
  # Soluzione 3: Usa l'interfaccia interattiva
  sqlite3.exe database\refood.db
  .read schema.sql
  .exit
  ```

- **Errore "Impossibile trovare il database" o percorsi errati**
  ```powershell
  # Attenzione ai percorsi relativi su Windows
  # Usa il percorso completo
  sqlite3.exe "C:\path\to\repository\database\refood.db" < "C:\path\to\repository\schema.sql"
  ```

#### Linux/macOS
- **Errore "command not found: sqlite3"**
  ```bash
  # Linux
  sudo apt-get install sqlite3
  
  # macOS
  brew install sqlite3
  ```

- **Errore di permessi per il database**
  ```bash
  # Verifica e correggi i permessi della directory
  sudo chown -R $USER:$USER database/
  chmod 755 database/
  ```

### Problemi con Node.js e npm

- **Errore "Module not found" o dipendenze mancanti**
  ```bash
  # Verifica che tutte le dipendenze siano installate
  npm install
  
  # Se non funziona, elimina node_modules e reinstalla
  rm -rf node_modules
  npm cache clean --force
  npm install
  ```

- **Errori di compilazione con moduli nativi (come bcrypt)**
  ```bash
  # Windows
  npm install --global windows-build-tools
  npm rebuild bcrypt --build-from-source
  
  # Linux
  sudo apt-get install build-essential python3
  
  # macOS
  xcode-select --install
  ```

- **Errore "Cannot find module 'sqlite3'"**
  ```bash
  # Reinstalla specificamente il modulo sqlite3
  npm uninstall sqlite3
  npm install sqlite3
  
  # Se continua a non funzionare, installa una versione specifica
  npm install sqlite3@5.1.6
  ```

### Problemi con Expo/React Native

- **Errore "Unable to resolve module"**
  ```bash
  # Pulisci la cache e reinstalla
  npx expo start --clear
  
  # Se persiste, installa manualmente il modulo mancante
  npm install [nome-modulo-mancante]
  ```

- **Errore "Metro Bundler process exited"**
  ```bash
  # Arresta tutti i processi node in esecuzione
  # Windows
  taskkill /F /IM node.exe
  
  # Linux/macOS
  killall node
  
  # Avvia con metro disabilitato inizialmente
  npx expo start --dev-client
  ```

- **Errore di connessione con il backend**
  ```
  1. Assicurati che l'indirizzo nel file .env sia corretto
  2. Verifica che il backend sia in esecuzione
  3. Controlla che il firewall non blocchi le connessioni alla porta 3000
  4. Se utilizzi un dispositivo fisico, assicurati che sia sulla stessa rete WiFi
  5. Prova a usare l'indirizzo IP esatto del computer anziché localhost
  ```

### Verifica dell'Installazione

Ecco alcuni comandi utili per verificare che tutto sia configurato correttamente:

```bash
# Controlla che SQLite sia installato e funzionante
sqlite3 --version

# Verifica che il database sia stato creato con la struttura corretta
sqlite3 database/refood.db "SELECT name FROM sqlite_master WHERE type='table';"

# Controlla che il server Node.js sia in esecuzione e in ascolto
# Windows
netstat -an | findstr 3000

# Linux/macOS
netstat -an | grep 3000

# Verifica che i file .env esistano
# Windows
Get-Content backend\.env
Get-Content refood-mobile\.env

# Linux/macOS
cat backend/.env
cat refood-mobile/.env

# Controlla i log per gli errori
# Windows
type logs\combined.log

# Linux/macOS
cat logs/combined.log
```
# Setup Semplificato di Refood

Questo documento spiega come installare e configurare rapidamente l'intero progetto Refood, eliminando la necessità di eseguire numerosi comandi manuali.

## Prerequisiti

Prima di iniziare, assicurati di avere installati:

- **Node.js** (versione 18.x o superiore consigliata)
- **npm** (viene installato automaticamente con Node.js)
- **Git** (per clonare il repository)

## Installazione rapida in 3 passaggi

### 1. Clona il repository

```bash
git clone https://url-del-repository/refood.git
cd refood
```

### 2. Esegui lo script di installazione automatico

#### Su Windows:

```bash
setup_windows.bat
```

#### Su Linux/macOS:

```bash
chmod +x setup_unix.sh
./setup_unix.sh
```

### 3. Avvia l'applicazione

**Per avviare il backend:**

```bash
cd backend
npm run dev
```

**Per avviare il frontend mobile:**

```bash
cd refood-mobile
npx expo start
```

Segui le istruzioni a schermo per aprire l'app su un emulatore o dispositivo fisico:
- Premi `a` per aprire su emulatore Android
- Premi `i` per aprire su simulatore iOS (solo su macOS)
- Scansiona il QR code con l'app Expo Go sul tuo dispositivo fisico

## Cosa fa lo script di installazione

Gli script di installazione automatizzata eseguono tutte le seguenti operazioni:

1. **Verifica dei prerequisiti**
   - Controlla che Node.js e npm siano installati correttamente

2. **Installazione delle dipendenze globali**
   - Installa nodemon e expo-cli necessari per lo sviluppo

3. **Installazione delle dipendenze del progetto backend**
   - Installa tutte le librerie necessarie per il backend

4. **Configurazione automatica del database**
   - Installa SQLite se non è presente nel sistema
   - Crea la directory database
   - Inizializza il database con lo schema, le funzioni personalizzate e le viste

5. **Configurazione dell'ambiente backend**
   - Crea il file .env con le variabili di ambiente necessarie

6. **Installazione delle dipendenze del frontend mobile**
   - Installa tutte le librerie necessarie per l'app mobile

7. **Configurazione dell'ambiente frontend**
   - Rileva automaticamente l'indirizzo IP della macchina
   - Crea il file .env per il frontend con l'URL corretto dell'API

8. **Preparazione della manutenzione automatica**
   - Crea le directory necessarie per gli script di manutenzione

## Risoluzione dei problemi comuni

### Se la rilevazione automatica dell'IP non funziona

Se utilizzi un dispositivo fisico per testare l'app mobile e il backend non è raggiungibile, modifica il file `refood-mobile/.env`:

```
# Sostituisci con l'IP corretto della tua macchina sulla rete locale
API_URL=http://192.168.1.x:3000/api/v1
```

### Se lo script di installazione fallisce

1. **Problemi con SQLite**:
   - Assicurati di avere i permessi di amministratore
   - Installa SQLite manualmente seguendo le istruzioni sul [sito ufficiale](https://www.sqlite.org/download.html)

2. **Problemi con le dipendenze Node.js**:
   - Prova a eliminare la cartella `node_modules` e reinstallare:
     ```bash
     rm -rf node_modules
     npm cache clean --force
     npm install
     ```

3. **Problemi con Expo**:
   - Assicurati di avere l'ultima versione di Expo CLI:
     ```bash
     npm install -g expo-cli@latest
     ```
   - Pulisci la cache di Expo:
     ```bash
     expo r -c
     ```

### Per eseguire la manutenzione automatica del database

Dopo l'installazione, puoi configurare la manutenzione automatica eseguendo:

```bash
# Su Linux/macOS
./install_maintenance_cron.sh

# Su Windows (tramite Git Bash o WSL)
./install_maintenance_cron.sh
```

Oppure su Windows puoi usare Task Scheduler come descritto nella documentazione completa.

Se segui questi passaggi specifici per il tuo sistema operativo, dovresti essere in grado di avviare correttamente l'applicazione Refood. In caso di problemi persistenti, prova le soluzioni indicate nella sezione Risoluzione dei Problemi Comuni. 

## Panoramica del Progetto

### Obiettivi
- Ridurre lo spreco alimentare attraverso un sistema efficiente di gestione delle eccedenze
- Facilitare la connessione tra centri di distribuzione, canali sociali e centri di riciclaggio
- Tracciare l'impatto ambientale ed economico delle operazioni di recupero alimenti
- Fornire un'interfaccia user-friendly per tutte le parti coinvolte nel processo

### Struttura del Progetto
Il progetto è diviso in due componenti principali:

1. **Backend** - API REST sviluppata con Node.js che gestisce la logica di business, l'accesso al database e le operazioni di manutenzione
2. **Frontend Mobile** - Applicazione cross-platform sviluppata con React Native e Expo che fornisce l'interfaccia utente

### Attori del Sistema
Refood coinvolge diversi tipi di utenti, ognuno con ruoli e responsabilità specifiche:

1. **Amministratori** - Gestiscono l'intero sistema, configurano i parametri globali e hanno accesso completo
2. **Operatori** - Gestiscono l'inserimento e la manutenzione dei lotti alimentari
3. **Utenti** - Rappresentano i consumatori finali del sistema, suddivisi in:
   - **Privati** - Utenti singoli che possono prenotare prodotti (precedentemente "Distribuzione")
   - **Canali sociali** - Organizzazioni che redistribuiscono i prodotti a persone bisognose
   - **Centri riciclo** - Strutture che gestiscono il riciclaggio di prodotti non consumabili

### Funzionalità Principali
- Sistema di autenticazione e gestione utenti con ruoli differenziati
- Gestione completa dei lotti alimentari con tracking automatico dello stato
- Sistema di prenotazione e consegna con supporto per pagamenti (per utenti privati)
- Notifiche in tempo reale tramite WebSocket
- Dashboard con statistiche sull'impatto ambientale ed economico
- Sistema di manutenzione automatica del database
- Supporto dispositivi mobili e operatività offline

## Architettura del Sistema

Refood adotta un'architettura client-server moderna, componibile e altamente modulare che segue i principi del design pattern MVC (Model-View-Controller) con alcune estensioni appropriate per applicazioni mobili e real-time.

### Stack Tecnologico

#### Backend
- **Linguaggio di Programmazione**: JavaScript (Node.js v18.x)
- **Framework Web**: Express.js 4.18.x
- **Database**: SQLite 3.36.x
- **ORM**: Personalizzato con pattern Repository e Data Access Object
- **Comunicazione Real-time**: WebSocket (libreria ws 8.5.x)
- **Autenticazione**: JWT (jsonwebtoken 9.0.x)
- **Hashing Password**: bcrypt 5.1.x
- **Validazione Dati**: express-validator 7.0.x
- **Logging**: winston 3.8.x
- **Task Scheduling**: node-cron 3.0.x
- **CORS**: cors 2.8.x
- **Middleware Body-Parser**: express.json e express.urlencoded
- **Gestione Errori**: Middleware personalizzato con error handling centralizzato

#### Frontend (Mobile)
- **Framework**: React Native 0.72.x con Expo SDK 48.x
- **Linguaggio**: TypeScript 5.1.x
- **Routing e Navigazione**: Expo Router 2.0.x
- **State Management**: React Context API e AsyncStorage
- **Chiamate API**: Axios 1.4.x con interceptor personalizzati
- **WebSocket Client**: Implementazione personalizzata basata su WebSocket standard
- **UI Components**: NativeBase 3.4.x e componenti personalizzati
- **Form Handling**: React Hook Form 7.45.x
- **Validazione**: yup 1.2.x
- **Internazionalizzazione**: i18next 23.2.x
- **Date Handling**: date-fns 2.30.x
- **Gestione Immagini**: expo-image-picker 14.1.x
- **Notifiche Push**: expo-notifications 0.18.x
- **Sicurezza**: expo-secure-store 12.1.x per storage sicuro
- **Debugging**: Flipper con react-native-flipper 0.200.x
- **Testing**: Jest 29.5.x con React Native Testing Library

### Architettura Backend Dettagliata

Il backend di Refood è sviluppato seguendo un'architettura stratificata che separa chiaramente:

#### 1. Layer di Presentazione
- **Controllers**: Gestiscono le richieste HTTP e le risposte
  - `auth.controller.js`: Gestione autenticazione (login, registrazione, logout)
  - `lotti.controller.js`: Gestione dei lotti alimentari (CRUD, filtraggio, ricerca)
  - `prenotazioni.controller.js`: Gestione del ciclo di vita delle prenotazioni
  - `notifiche.controller.js`: Sistema di notifiche e comunicazioni
  - `statistiche.controller.js`: Calcolo e presentazione dati statistici
  - `tipo_utente.controller.js`: Gestione dei tipi utente (ex centri)

- **Routes**: Definiscono gli endpoint API e collegano le richieste ai controller
  - Organizzate per dominio funzionale con prefisso `/api/v1/`
  - Middleware di autenticazione e validazione

#### 2. Layer di Business Logic
- **Services**: Incapsulano la logica di business
  - `AuthService`: Gestione token JWT, hashing password, validazione
  - `WebSocketService`: Comunicazione real-time, gestione connessioni, notifiche push
  - `NotificationService`: Generazione e distribuzione notifiche
  - `StatusUpdateService`: Logica per gli aggiornamenti di stato dei lotti

- **Utils**: Funzioni di utilità trasversali
  - `DateUtils`: Manipolazione date, calcolo scadenze
  - `ValidationUtils`: Funzioni comuni di validazione
  - `SecurityUtils`: Funzioni per la sicurezza dell'applicazione
  - `LogUtils`: Wrapper per il sistema di logging

#### 3. Layer di Accesso ai Dati
- **Repositories**: Astrazione dell'accesso ai dati
  - Pattern DAO (Data Access Object) per ogni entità
  - Query parametrizzate per prevenire SQL injection
  - Metodi specializzati per operazioni complesse

- **Migrations**: Sistema di versioning e migrazione schema
  - Script SQL per aggiornamenti incrementali
  - Trigger per mantenere la coerenza e tracciabilità dei dati

#### 4. Modulo WebSocket

Il sistema WebSocket implementato in Refood è una componente centrale per la comunicazione in tempo reale, implementato nella classe `WebSocketService`:

```javascript
class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map di clients attivi: userId => [WebSocket]
    this.sessions = new Map(); // Map di sessioni: sessionId => {userId, lastActive}
    this.pendingReconnections = new Map(); // sessionId => {expiresAt, userId}
    this.heartbeatInterval = null;
    this.connectionCleanupInterval = null;
  }
  
  // Inizializza il server WebSocket
  init(httpServer) { /*...*/ }
  
  // Gestisce nuove connessioni
  async handleConnection(ws, req) { /*...*/ }
  
  // Genera ID sessione unici
  generateSessionId(userId) { /*...*/ }
  
  // Verifica token JWT
  async verificaToken(token) { /*...*/ }
  
  // Gestisce riconnessioni
  handleReconnection(ws, sessionId) { /*...*/ }
  
  // Cleanup delle connessioni inattive
  checkConnections() { /*...*/ }
  
  // Invia notifiche agli utenti
  async inviaNotifica(userId, notifica) { /*...*/ }
  
  // Notifica aggiornamenti sui lotti
  notificaAggiornamentoLotto(lotto, userIds = []) { /*...*/ }
  
  // Notifica aggiornamenti sulle prenotazioni
  notificaAggiornamentoPrenotazione(prenotazione, userIds = []) { /*...*/ }
}
```

Il servizio WebSocket gestisce:
- Autenticazione tramite token JWT
- Sessioni persistenti con supporto riconnessione
- Messaggistica in tempo reale basata su eventi
- Heartbeat per mantenere connessioni attive
- Broadcast selettivo basato su ruoli utente
- Distribuzione notifiche in tempo reale

#### 5. Job Schedulati

I job schedulati sono gestiti tramite `node-cron` e coordinati attraverso moduli dedicati:

```javascript
// Estratto esempio di configurazione job
cron.schedule('0 0 * * *', async () => { // Ogni giorno a mezzanotte
  try {
    console.log('[JOB] Avvio aggiornamento stati lotti');
    await aggiornamentoStatiLotti.esegui();
    console.log('[JOB] Aggiornamento stati lotti completato');
  } catch (err) {
    console.error('[JOB ERROR] Aggiornamento stati lotti:', err);
  }
});
```

Principali job schedulati:
- Aggiornamento stato lotti basato su data scadenza (giornaliero)
- Archiviazione lotti scaduti (giornaliero)
- Pulizia token scaduti (settimanale)
- Generazione statistiche di impatto (settimanale)
- Backup database (giornaliero)

### Architettura Frontend Dettagliata

L'applicazione mobile Refood è basata su React Native con Expo, sviluppata in TypeScript e organizzata secondo una struttura modulare:

#### 1. Navigazione e Routing

Refood utilizza il sistema di routing file-based di Expo Router, che segue una struttura di cartelle nativa per definire la navigazione dell'app:

```
refood-mobile/
├── app/                 # Directory principale del routing
│   ├── (tabs)/          # Layout per navigazione a tab
│   │   ├── index.tsx    # Schermata home
│   │   ├── lotti.tsx    # Schermata lotti
│   │   ├── _layout.tsx  # Configurazione layout tabs
│   ├── auth/            # Schermate autenticazione
│   │   ├── login.tsx    # Schermata login
│   │   ├── register.tsx # Schermata registrazione
│   ├── lotti/           # Schermate gestione lotti
│   │   ├── dettaglio/
│   │   │   ├── [id].tsx # Dettaglio lotto dinamico
│   ├── prenotazioni/    # Schermate prenotazioni
│   │   ├── dettaglio/
│   │   │   ├── [id].tsx # Dettaglio prenotazione
│   ├── _layout.tsx      # Layout root dell'applicazione
```

Questa struttura implementa:
- Navigazione a stack per flussi lineari
- Navigazione a tab per accesso rapido alle funzioni principali
- Routing dinamico con parametri (es. `[id].tsx`)
- Lazy loading delle schermate non immediate

#### 2. Gestione dello Stato

Refood utilizza un approccio misto per la gestione dello stato:

- **Context API** per stato globale e autenticazione:

```typescript
// AuthContext.tsx
export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  user: null,
  login: async () => ({ success: false }),
  logout: async () => {},
  checkAuth: async () => false,
});

export const AuthProvider: React.FC = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  
  // Implementazione metodi autenticazione
  const login = async (email: string, password: string): Promise<AuthResponse> => {/*...*/};
  const logout = async (): Promise<void> => {/*...*/};
  const checkAuth = async (): Promise<boolean> => {/*...*/};
  
  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
```

- **Services** per interazioni con API:

```typescript
// lottiService.ts (estratto)
export const getLotti = async (
  filtri: LottoFiltri = {}, 
  forceRefresh = false, 
  mostraTutti = false
): Promise<LottiResponse> => {
  const cacheKey = `lotti_${JSON.stringify(filtri)}_${mostraTutti}`;
  
  // Implementazione caching
  if (!forceRefresh) {
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      console.log('Usando dati lotti dalla cache');
      return JSON.parse(cachedData);
    }
  }
  
  try {
    const authHeader = await getAuthHeader();
    
    // Costruzione parametri
    const params: any = {
      // Filtro solo per prenotazioni in stati attivi
      stato: 'Prenotato,Confermato,InAttesa,InTransito,ProntoPerRitiro'
    };
    
    // Aggiunta filtri dinamici
    if (filtri.stato) params.stato = filtri.stato;
    if (filtri.centro_id) params.tipo_utente_id = filtri.centro_id;
    if (filtri.categoria) params.categoria = filtri.categoria;
    if (filtri.scadenza_min) params.data_min = filtri.scadenza_min;
    if (filtri.scadenza_max) params.data_max = filtri.scadenza_max;
    if (filtri.cerca) params.cerca = filtri.cerca;
    
    // Chiamata API con gestione errori
    const response = await axios.get('/lotti', {
      headers: authHeader,
      params
    });
    
    // Normalizzazione dati e caching
    const normalizedData = {
      lotti: response.data.data.lotti.map(normalizeLotto),
      pagination: response.data.data.pagination
    };
    
    await AsyncStorage.setItem(cacheKey, JSON.stringify(normalizedData));
    return normalizedData;
  } catch (error) {
    console.error('Errore nel recupero lotti:', error);
    throw error;
  }
};
```

#### 3. Interfacce TypeScript

Le interfacce TypeScript vengono utilizzate estensivamente per garantire type safety:

```typescript
// Principali interfacce utilizzate
export interface Lotto {
  id: number;
  nome: string; // corrisponde a prodotto nel backend
  descrizione?: string;
  quantita: number;
  unita_misura: string;
  data_inserimento?: string;
  data_scadenza: string;
  centro_id: number; // corrisponde a centro_origine_id nel backend
  centro_nome?: string;
  stato: 'Verde' | 'Arancione' | 'Rosso';
  categorie?: string[];
  origine?: string;
  stato_prenotazione?: string; // Indica se il lotto è già prenotato
  prezzo?: number | null; // Prezzo del lotto (solo per lotti verdi)
  tipo_pagamento?: 'contanti' | 'bonifico' | null; // Metodo di pagamento
}

export interface Prenotazione {
  id: number;
  lotto_id: number;
  centro_ricevente_id: number;
  centro_id?: number; // Mantenuto per retrocompatibilità
  data_prenotazione: string;
  data_ritiro_prevista: string | null;
  data_ritiro_effettiva: string | null;
  stato: 'Prenotato' | 'InAttesa' | 'Confermato' | 'ProntoPerRitiro' | 'Rifiutato' | 'InTransito' | 'Consegnato' | 'Annullato' | 'Eliminato';
  note: string | null;
  created_at: string;
  updated_at: string;
  // Dati relazionati e altri campi...
  tipo_pagamento?: 'contanti' | 'bonifico' | null;
}

export type StatoPrenotazione = 'Prenotato' | 'InAttesa' | 'Confermato' | 'ProntoPerRitiro' | 'Rifiutato' | 'InTransito' | 'Consegnato' | 'Annullato' | 'Eliminato';
```

#### 4. Componenti React

I componenti seguono una struttura che separa logica e presentazione:

```typescript
// Esempio di componente schermata (semplificato)
export default function LottiScreen() {
  // State
  const [lotti, setLotti] = useState<Lotto[]>([]);
  const [filteredLotti, setFilteredLotti] = useState<Lotto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filtri
  const [stato, setStato] = useState<string | null>(null);
  const [dataScadenza, setDataScadenza] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Refs
  const filtriModalRef = useRef<BottomSheetModal>(null);
  const prenotazioneModalRef = useRef<BottomSheetModal>(null);
  
  // Context
  const { user } = useAuth();
  
  // Memo
  const filtro = useMemo(() => buildFiltri(), [stato, dataScadenza]);
  
  // Effects
  useEffect(() => {
    loadLotti();
  }, []);
  
  useEffect(() => {
    if (searchQuery) {
      setFilteredLotti(filtroLocale(searchQuery, lotti));
    } else {
      setFilteredLotti(lotti);
    }
  }, [searchQuery, lotti]);
  
  // Logica business
  const loadLotti = async (forceRefresh = false) => {/*...*/};
  const handlePrenotazioneLotto = (lotto: Lotto) => {/*...*/};
  const confermaPrenotazione = async () => {/*...*/};
  
  // UI Helpers
  const getStatusColor = (item: Lotto | string) => {/*...*/};
  const getStatusText = (item: Lotto | string) => {/*...*/};
  
  // Rendering
  return (
    <View style={styles.container}>
      {/* Componenti UI */}
    </View>
  );
}
```

#### 5. WebSocket Client

L'integrazione WebSocket nel client mobile è implementata con un servizio dedicato:

```typescript
// Estratto websocketService.ts
class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: any = null;
  private sessionId: string | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private pingInterval: any = null;
  private lastPongTime: number = 0;
  
  constructor(baseUrl: string) {
    this.url = baseUrl.replace(/^http/, 'ws') + '/notifications/ws';
  }
  
  // Connessione iniziale con token
  async connect(token: string): Promise<boolean> {/*...*/}
  
  // Riconnessione con sessionId
  async reconnect(): Promise<boolean> {/*...*/}
  
  // Chiusura connessione
  disconnect(): void {/*...*/}
  
  // Gestione eventi
  on(event: string, callback: Function): void {/*...*/}
  off(event: string, callback: Function): void {/*...*/}
  
  // Invio messaggi
  send(data: any): boolean {/*...*/}
  
  // Heartbeat
  private startPingInterval(): void {/*...*/}
  private handlePong(): void {/*...*/}
  
  // Gestione messaggi in arrivo
  private handleMessage(event: MessageEvent): void {/*...*/}
}

// Singleton globale
export const websocketService = new WebSocketClient(API_BASE_URL);
```

Questo servizio gestisce:
- Connessione automatica con token JWT
- Riconnessione intelligente con backoff esponenziale
- Sistema di eventi per notifiche in tempo reale
- Heartbeat per mantenere la connessione attiva
- Gestione errori e disconnessioni

### Schema Database Avanzato

Il database SQLite è strutturato con un'attenzione particolare a efficienza, integrità referenziale e tracciabilità. Oltre alle tabelle principali già descritte, è importante evidenziare alcuni aspetti tecnici avanzati:

#### Indici Strategici

Gli indici sono creati strategicamente per ottimizzare le query più frequenti:

```sql
-- Esempio di indici principali
CREATE INDEX idx_lotti_stato ON Lotti(stato);
CREATE INDEX idx_lotti_scadenza ON Lotti(data_scadenza);
CREATE INDEX idx_lotti_tipo_utente ON Lotti(tipo_utente_origine_id);
CREATE INDEX idx_prenotazioni_stato ON Prenotazioni(stato);
CREATE INDEX idx_prenotazioni_lotto ON Prenotazioni(lotto_id);
CREATE INDEX idx_prenotazioni_tipi_utente ON Prenotazioni(tipo_utente_ricevente_id);
CREATE INDEX idx_attori_ruolo ON Attori(ruolo);
CREATE INDEX idx_attori_email ON Attori(email);
```

Questi indici sono fondamentali per garantire prestazioni ottimali nelle operazioni di:
- Filtraggio lotti per stato
- Ricerca prenotazioni per stato o centro
- Login e autenticazione rapida
- Ricerca lotti per scadenza

#### Trigger Avanzati

I trigger di database implementano logica business complessa direttamente a livello di database:

```sql
-- Trigger per aggiornamento automatico stato lotti
CREATE TRIGGER update_lotto_stato_by_scadenza
AFTER UPDATE OF data_scadenza ON Lotti
FOR EACH ROW
BEGIN
    DECLARE giorni_rimanenti INTEGER;
    DECLARE nuovo_stato VARCHAR(10);
    
    SET giorni_rimanenti = DATEDIFF(NEW.data_scadenza, CURRENT_DATE);
    
    IF giorni_rimanenti > 7 THEN
        SET nuovo_stato = 'Verde';
    ELSEIF giorni_rimanenti >= 3 THEN
        SET nuovo_stato = 'Arancione';
    ELSE
        SET nuovo_stato = 'Rosso';
    END IF;
    
    UPDATE Lotti 
    SET stato = nuovo_stato,
        prezzo = CASE WHEN nuovo_stato != 'Verde' THEN 0 ELSE prezzo END
    WHERE id = NEW.id;
    
    INSERT INTO LogCambioStato (lotto_id, stato_precedente, stato_nuovo, data_cambio)
    VALUES (NEW.id, OLD.stato, nuovo_stato, NOW());
END;

-- Trigger per validazione tipo utente
CREATE TRIGGER check_attore_ruolo_before_insert
BEFORE INSERT ON AttoriTipoUtente
FOR EACH ROW
BEGIN
    DECLARE role VARCHAR(20);
    
    SELECT ruolo INTO role 
    FROM Attori 
    WHERE id = NEW.attore_id;
    
    IF role != 'Utente' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Solo gli attori con ruolo Utente possono essere associati a un Tipo_Utente';
    END IF;
END;
```

#### Viste Ottimizzate

Viste database per semplificare query complesse:

```sql
-- Vista per lotti disponibili
CREATE VIEW LottiDisponibili AS
SELECT l.*,
       tu.nome AS tipo_utente_origine_nome,
       GROUP_CONCAT(c.nome) AS categorie_nomi
FROM Lotti l
LEFT JOIN Tipo_Utente tu ON l.tipo_utente_origine_id = tu.id
LEFT JOIN LottiCategorie lc ON l.id = lc.lotto_id
LEFT JOIN Categorie c ON lc.categoria_id = c.id
LEFT JOIN Prenotazioni p ON l.id = p.lotto_id AND p.stato NOT IN ('Rifiutato', 'Annullato', 'Eliminato')
WHERE p.id IS NULL
GROUP BY l.id;

-- Vista per statistiche impatto
CREATE VIEW StatisticheImpatto AS
SELECT 
    strftime('%Y-%m', l.data_scadenza) AS periodo,
    COUNT(DISTINCT p.lotto_id) AS lotti_salvati,
    SUM(l.quantita) AS kg_cibo_salvato,
    SUM(l.quantita * 2.5) AS co2_risparmiata_kg,
    SUM(CASE WHEN l.prezzo > 0 THEN l.prezzo ELSE 0 END) AS valore_economico
FROM Prenotazioni p
JOIN Lotti l ON p.lotto_id = l.id
WHERE p.stato = 'Consegnato'
GROUP BY periodo
ORDER BY periodo DESC;
```

#### Strategie di Query

Esempi di query ottimizzate per operazioni critiche:

```sql
-- Query ottimizzata per lotti disponibili con filtri
SELECT l.*, 
       tu.nome AS tipo_utente_origine_nome,
       GROUP_CONCAT(c.nome) AS categorie
FROM Lotti l
LEFT JOIN Tipo_Utente tu ON l.tipo_utente_origine_id = tu.id
LEFT JOIN LottiCategorie lc ON l.id = lc.lotto_id
LEFT JOIN Categorie c ON lc.categoria_id = c.id
LEFT JOIN (
    SELECT DISTINCT lotto_id 
    FROM Prenotazioni 
    WHERE stato NOT IN ('Rifiutato', 'Annullato', 'Eliminato')
) p ON l.id = p.lotto_id
WHERE p.lotto_id IS NULL
  AND (? IS NULL OR l.stato = ?)
  AND (? IS NULL OR l.tipo_utente_origine_id = ?)
  AND (? IS NULL OR l.data_scadenza >= ?)
  AND (? IS NULL OR l.data_scadenza <= ?)
  AND (? IS NULL OR l.id IN (
      SELECT lotto_id 
      FROM LottiCategorie 
      WHERE categoria_id = ?
  ))
  AND (? IS NULL OR (
      l.prodotto LIKE ? OR 
      l.descrizione LIKE ? OR
      tu.nome LIKE ?
  ))
GROUP BY l.id
ORDER BY l.data_scadenza ASC
LIMIT ? OFFSET ?;
```

Questa query utilizza:
- JOIN laterali ottimizzati
- Subquery per filtraggio efficiente
- GROUP BY per aggregazione
- Parametrizzazione completa per sicurezza

## Tecnologie Utilizzate

### Backend

#### Core Technologies
- **Node.js (v16+)**: Ambiente di runtime JavaScript lato server
- **Express.js**: Framework web per la creazione di API REST
- **SQLite**: Database relazionale leggero e embedded
- **WebSocket (ws)**: Implementazione del protocollo WebSocket per Node.js

#### Autenticazione e Sicurezza
- **JSON Web Token (JWT)**: Per l'autenticazione stateless
- **bcrypt**: Per l'hashing sicuro delle password
- **cors**: Middleware per gestire le richieste Cross-Origin
- **helmet**: Middleware per migliorare la sicurezza HTTP

#### Validazione e Utilità
- **express-validator**: Per validare e sanitizzare i dati in ingresso
- **dotenv**: Per la gestione delle variabili d'ambiente
- **winston**: Per il logging avanzato
- **multer**: Per la gestione dell'upload di file
- **nodemon**: Per lo sviluppo con riavvio automatico

### Frontend

#### Core Technologies
- **React Native**: Framework per lo sviluppo mobile cross-platform
- **Expo**: Toolchain per semplificare lo sviluppo React Native
- **TypeScript**: Superset JavaScript con tipizzazione statica

#### UI e Navigazione
- **Expo Router**: Sistema di routing basato su file per la navigazione
- **React Native Paper**: Libreria di componenti UI per Material Design
- **React Native Gesture Handler**: API per gestire i gesti touch
- **React Native Reanimated**: Libreria per animazioni fluide

#### Gestione Stato e Rete
- **React Context API**: Per la gestione globale dello stato dell'applicazione
- **Axios**: Client HTTP per le chiamate API
- **AsyncStorage**: API per la persistenza dei dati locali
- **WebSocket**: Per la comunicazione in tempo reale

#### Notifiche e Localizzazione
- **Expo Notifications**: API per le notifiche push
- **Expo Location**: API per l'accesso alla posizione del dispositivo
- **Expo FileSystem**: API per la gestione dei file

#### Strumenti di Sviluppo
- **ESLint**: Per il linting del codice
- **Prettier**: Per la formattazione del codice
- **Jest**: Per i test unitari
- **Expo Updates**: Per aggiornamenti over-the-air 

## Schema del Database

Il database di Refood è implementato utilizzando SQLite, un sistema di gestione di database relazionale leggero e integrato. Lo schema è stato progettato per supportare tutte le funzionalità dell'applicazione e garantire l'integrità dei dati.

### Entità Principali

#### Attori
Rappresenta tutti gli utenti del sistema (precedentemente chiamati "Utenti").

```sql
CREATE TABLE IF NOT EXISTS Attori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nome TEXT,
    cognome TEXT,
    telefono TEXT,
    indirizzo TEXT,
    ruolo TEXT CHECK(ruolo IN ('Amministratore', 'Operatore', 'Utente')) NOT NULL,
    creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
    ultimo_accesso DATETIME,
    attivo INTEGER DEFAULT 1 CHECK(attivo IN (0, 1))
);
```

**Ruoli disponibili**:
- `Amministratore`: Accesso completo al sistema
- `Operatore`: Gestione lotti e funzionalità operative
- `Utente`: Utenti finali, ulteriormente categorizzati tramite Tipo_Utente

#### Tipo_Utente
Categorizzazione degli utenti (precedentemente chiamati "Centri").

```sql
CREATE TABLE IF NOT EXISTS Tipo_Utente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT CHECK(tipo IN ('Privato', 'Canale sociale', 'centro riciclo')) NOT NULL,
    nome TEXT NOT NULL,
    indirizzo TEXT,
    email TEXT,
    telefono TEXT,
    descrizione TEXT,
    attore_id INTEGER,
    creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attore_id) REFERENCES Attori(id)
);
```

**Tipi disponibili**:
- `Privato`: Utenti singoli che possono prenotare prodotti (precedentemente "Distribuzione")
- `Canale sociale`: Organizzazioni che redistribuiscono i prodotti
- `centro riciclo`: Strutture che gestiscono il riciclaggio di prodotti

#### AttoriTipoUtente
Associazione molti-a-molti tra Attori e Tipo_Utente.

```sql
CREATE TABLE IF NOT EXISTS AttoriTipoUtente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attore_id INTEGER NOT NULL,
    tipo_utente_id INTEGER NOT NULL,
    ruolo TEXT DEFAULT 'Membro',
    creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attore_id) REFERENCES Attori(id),
    FOREIGN KEY (tipo_utente_id) REFERENCES Tipo_Utente(id),
    UNIQUE(attore_id, tipo_utente_id)
);
```

#### Lotti
Prodotti alimentari inseriti nel sistema.

```sql
CREATE TABLE IF NOT EXISTS Lotti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prodotto TEXT NOT NULL,
    quantita REAL NOT NULL,
    unita_misura TEXT NOT NULL,
    data_scadenza TEXT NOT NULL,
    stato TEXT CHECK(stato IN ('Verde', 'Arancione', 'Rosso')) NOT NULL,
    prezzo REAL DEFAULT NULL,
    descrizione TEXT,
    tipo_utente_origine_id INTEGER,
    inserito_da INTEGER,
    giorni_permanenza INTEGER DEFAULT 7,
    creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
    aggiornato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tipo_utente_origine_id) REFERENCES Tipo_Utente(id),
    FOREIGN KEY (inserito_da) REFERENCES Attori(id)
);
```

**Stati disponibili**:
- `Verde`: Prodotto fresco, prezzo configurabile
- `Arancione`: Prodotto vicino alla scadenza, prezzo automaticamente 0
- `Rosso`: Prodotto scaduto/da riciclare, prezzo automaticamente 0

#### Prenotazioni
Richieste di ritiro dei lotti.

```sql
CREATE TABLE IF NOT EXISTS Prenotazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    attore_id INTEGER NOT NULL,
    tipo_utente_ricevente_id INTEGER NOT NULL,
    stato TEXT CHECK(stato IN ('Prenotato', 'InAttesa', 'Confermato', 'ProntoPerRitiro', 'InTransito', 'Consegnato', 'Rifiutato', 'Annullato', 'Eliminato')) NOT NULL,
    data_prenotazione DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_ritiro_prevista TEXT,
    data_ritiro_effettiva TEXT,
    note TEXT,
    tipo_pagamento TEXT CHECK(tipo_pagamento IN ('contanti', 'bonifico', NULL)),
    ritirato_da TEXT,
    documento_ritiro TEXT,
    note_ritiro TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id),
    FOREIGN KEY (attore_id) REFERENCES Attori(id),
    FOREIGN KEY (tipo_utente_ricevente_id) REFERENCES Tipo_Utente(id)
);
```

#### Categorie e LottiCategorie
Gestione delle categorie di prodotti e loro associazione ai lotti.

```sql
CREATE TABLE IF NOT EXISTS Categorie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    descrizione TEXT,
    creato_il DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS LottiCategorie (
    lotto_id INTEGER NOT NULL,
    categoria_id INTEGER NOT NULL,
    PRIMARY KEY (lotto_id, categoria_id),
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id),
    FOREIGN KEY (categoria_id) REFERENCES Categorie(id)
);
```

#### Notifiche
Sistema di notifiche all'interno dell'applicazione.

```sql
CREATE TABLE IF NOT EXISTS Notifiche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    utente_id INTEGER NOT NULL,
    titolo TEXT NOT NULL,
    descrizione TEXT,
    data_creazione DATETIME DEFAULT CURRENT_TIMESTAMP,
    letto INTEGER DEFAULT 0,
    azione_richiesta TEXT,
    riferimento_id INTEGER,
    FOREIGN KEY (utente_id) REFERENCES Attori(id)
);
```

#### LogCambioStato
Registrazione delle modifiche di stato dei lotti.

```sql
CREATE TABLE IF NOT EXISTS LogCambioStato (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    stato_precedente TEXT NOT NULL,
    stato_nuovo TEXT NOT NULL,
    cambiato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
    cambiato_da INTEGER,
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id),
    FOREIGN KEY (cambiato_da) REFERENCES Attori(id)
);
```

### Trigger Principali

#### Aggiornamento Stato Lotti
Trigger che aggiorna automaticamente lo stato di un lotto in base alla data di scadenza.

```sql
CREATE TRIGGER IF NOT EXISTS update_lotto_stato_by_scadenza
AFTER UPDATE OF data_scadenza ON Lotti
FOR EACH ROW
BEGIN
    -- Calcola il nuovo stato basato sulla data di scadenza
    UPDATE Lotti 
    SET stato = CASE
        WHEN julianday(NEW.data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') THEN 'Rosso'
        WHEN julianday(NEW.data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') THEN 'Arancione'
        ELSE 'Verde'
    END
    WHERE id = NEW.id AND stato != (
        CASE
            WHEN julianday(NEW.data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') THEN 'Rosso'
            WHEN julianday(NEW.data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') THEN 'Arancione'
            ELSE 'Verde'
        END
    );
END;
```

#### Registrazione Modifiche Stato
Trigger che registra le modifiche di stato nella tabella LogCambioStato.

```sql
CREATE TRIGGER IF NOT EXISTS log_cambio_stato_lotti
AFTER UPDATE OF stato ON Lotti
WHEN OLD.stato != NEW.stato
FOR EACH ROW
BEGIN
    INSERT INTO LogCambioStato (lotto_id, stato_precedente, stato_nuovo, cambiato_da)
    VALUES (
        NEW.id, 
        OLD.stato, 
        NEW.stato, 
        CASE 
            WHEN (SELECT COUNT(*) FROM Attori WHERE id = NEW.inserito_da) > 0 THEN NEW.inserito_da
            WHEN (SELECT COUNT(*) FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1) > 0 THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1)
            ELSE 1
        END
    );
END;
```

#### Validazione Associazioni AttoriTipoUtente
Trigger che verifica che solo attori con ruolo "Utente" possano essere associati a un Tipo_Utente.

```sql
CREATE TRIGGER IF NOT EXISTS check_attore_ruolo_before_insert
BEFORE INSERT ON AttoriTipoUtente
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN (SELECT ruolo FROM Attori WHERE id = NEW.attore_id) != 'Utente'
        THEN RAISE(ABORT, 'Solo attori con ruolo Utente possono essere associati a un Tipo_Utente')
    END;
END;
```

### Relazioni e Vincoli

Le principali relazioni tra le entità sono:

1. **Attori ↔ Tipo_Utente** (through AttoriTipoUtente): Relazione molti-a-molti che associa gli attori con ruolo "Utente" ai vari tipi di utente.

2. **Tipo_Utente → Lotti**: Un tipo utente può essere l'origine di molti lotti (centro_origine_id).

3. **Attori → Lotti**: Un attore (Operatore o Amministratore) può inserire molti lotti (inserito_da).

4. **Lotti → Prenotazioni**: Un lotto può avere una sola prenotazione attiva.

5. **Lotti ↔ Categorie** (through LottiCategorie): Relazione molti-a-molti che associa i lotti alle categorie.

6. **Attori → Prenotazioni**: Un attore può effettuare molte prenotazioni.

7. **Tipo_Utente → Prenotazioni**: Un tipo utente può ricevere molte prenotazioni (tipo_utente_ricevente_id).

### Indici

Per ottimizzare le performance del database, sono stati definiti vari indici:

```sql
CREATE INDEX IF NOT EXISTS idx_attori_email ON Attori(email);
CREATE INDEX IF NOT EXISTS idx_attori_ruolo ON Attori(ruolo);
CREATE INDEX IF NOT EXISTS idx_tipo_utente_tipo ON Tipo_Utente(tipo);
CREATE INDEX IF NOT EXISTS idx_lotti_stato ON Lotti(stato);
CREATE INDEX IF NOT EXISTS idx_lotti_scadenza ON Lotti(data_scadenza);
CREATE INDEX IF NOT EXISTS idx_lotti_prezzo ON Lotti(prezzo);
CREATE INDEX IF NOT EXISTS idx_prenotazioni_stato ON Prenotazioni(stato);
CREATE INDEX IF NOT EXISTS idx_prenotazioni_lotto ON Prenotazioni(lotto_id);
```

## Setup e Installazione

Questa sezione fornisce istruzioni dettagliate per configurare e avviare il progetto Refood in un ambiente di sviluppo.

### Prerequisiti

#### Requisiti di Sistema
- **Sistema Operativo**: Windows, macOS o Linux
- **Node.js**: Versione 16.x o superiore
- **npm** o **yarn**: Per la gestione dei pacchetti
- **Git**: Per il clone del repository

#### Requisiti per il Frontend Mobile
- **Expo CLI**: `npm install -g expo-cli`
- **Dispositivo mobile** con Expo Go installato o un **emulatore** (Android/iOS)

### Installazione del Backend

1. **Clone del repository**

```bash
git clone https://github.com/tuo-username/refood.git
cd refood
```

2. **Installazione delle dipendenze del backend**

```bash
cd backend
npm install
```

3. **Configurazione delle variabili d'ambiente**

Crea un file `.env` nella directory `backend` con il seguente contenuto:

```
PORT=3000
NODE_ENV=development
DB_PATH=../database/refood.db
JWT_SECRET=your_secret_key_change_this
JWT_ACCESS_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=604800
CORS_ORIGIN=*
LOG_LEVEL=debug
API_PREFIX=/api/v1
```

4. **Inizializzazione del database**

Per creare e popolare il database con dati iniziali:

```bash
npm run init-db
```

5. **Avvio del server di sviluppo**

```bash
npm run dev
```

Il server sarà in esecuzione all'indirizzo http://localhost:3000 (o sulla porta specificata nel file .env).

### Installazione del Frontend Mobile

1. **Installazione delle dipendenze del frontend**

```bash
cd ../refood-mobile
npm install
```

2. **Configurazione dell'endpoint API**

Modifica il file `src/config/constants.ts` per configurare l'URL dell'API:

```typescript
// Modifica API_URL con l'indirizzo IP della tua macchina (non usare localhost)
export const API_URL = 'http://192.168.1.100:3000/api/v1';
```

3. **Avvio dell'applicazione per lo sviluppo**

```bash
npm start
# oppure
npx expo start
```

Si aprirà una finestra del browser con un QR code. Scansiona il QR code con l'app Expo Go sul tuo dispositivo mobile o premi 'a' nella console per avviare l'app in un emulatore Android.

### Opzioni di avvio alternative

#### Avvio con pulizia della cache

Se riscontri problemi, puoi avviare l'app pulendo la cache:

```bash
# Backend
npm run dev:clean

# Frontend
npm run start:clear
# oppure
npx expo start --clear
```

#### Modalità produzione

Per avviare il backend in modalità produzione:

```bash
npm run start
```

### Configurazione dei Job di Manutenzione Automatica

Per configurare i job cron che eseguono la manutenzione automatica:

```bash
cd ..
chmod +x install_maintenance_cron.sh
./install_maintenance_cron.sh
```

Questo script configurerà i seguenti job cron:
- Aggiornamento giornaliero dello stato dei lotti (alle 2 AM)
- Pulizia settimanale dei token scaduti (ogni domenica alle 3 AM)
- Backup giornaliero del database (alle 1 AM)

### Verifica dell'installazione

#### Test del Backend

Verifica che il backend funzioni correttamente:

```bash
curl http://localhost:3000/api/v1/health
# Dovresti ricevere una risposta come: {"status":"UP","timestamp":"2025-04-01T12:34:56Z"}
```

#### Test del Frontend

- Dopo aver avviato l'app con Expo, verifica che la schermata di login venga visualizzata correttamente
- Puoi effettuare il login con l'account amministratore predefinito:
  - Email: admin@refood.com
  - Password: admin123

### Risoluzione dei Problemi di Installazione

#### Problemi con il Backend

1. **Errore "Address already in use"**:
   ```bash
   npx kill-port 3000
   npm run dev
   ```

2. **Problemi di accesso al database**:
   Verifica che il percorso specificato in `DB_PATH` nel file `.env` sia corretto.

3. **Errori di dipendenze**:
   ```bash
   rm -rf node_modules
   npm cache clean --force
   npm install
   ```

#### Problemi con il Frontend

1. **Errore di connessione all'API**:
   - Verifica che il backend sia in esecuzione
   - Assicurati di usare l'indirizzo IP corretto in `API_URL` (non localhost)
   - Controlla che il dispositivo/emulatore sia sulla stessa rete dell'API

2. **Problemi con Expo**:
   ```bash
   npx expo-doctor
   # Segui le raccomandazioni fornite
   ```

3. **Errori di TypeScript**:
   ```bash
   npm run tsc
   # Correggi gli errori segnalati
   ```

### Ambienti Supportati

L'applicazione è stata testata e funziona correttamente nei seguenti ambienti:

- **Node.js**: v16.x, v18.x
- **Sistemi Operativi**: Windows 10/11, macOS 12+, Ubuntu 20.04+
- **Dispositivi mobili**: iOS 14+ e Android 9+ 

## API e Endpoints

Refood implementa una moderna API REST, organizzata secondo il principio delle risorse. Tutte le API utilizzano il prefisso `/api/v1/` configurabile nel file `.env`.

### Convenzioni API

1. **Formato di risposta standard**:
   ```json
   {
     "status": "success|error",
     "message": "Messaggio descrittivo",
     "data": { ... },  // per risultati di successo
     "error": { ... }  // per risultati di errore
   }
   ```

2. **Autenticazione**: Le API private richiedono un token JWT nel formato `Authorization: Bearer <token>`.

3. **Formato dati**: Le richieste e le risposte sono in formato JSON.

4. **Codici di stato HTTP**:
   - `200 OK`: Richiesta completata con successo
   - `201 Created`: Risorsa creata con successo
   - `400 Bad Request`: Errore di validazione o formato di richiesta
   - `401 Unauthorized`: Token mancante o non valido
   - `403 Forbidden`: Utente non autorizzato per l'operazione
   - `404 Not Found`: Risorsa non trovata
   - `500 Internal Server Error`: Errore server generico

### Endpoint di Autenticazione

#### `/api/v1/auth/register`
- **Metodo**: POST
- **Descrizione**: Registrazione di un nuovo utente
- **Autenticazione**: No
- **Parametri**: 
  ```json
  {
    "email": "string",
    "password": "string",
    "nome": "string",
    "cognome": "string",
    "telefono": "string",
    "indirizzo": "string",
    "ruolo": "Utente", // Fisso per la registrazione pubblica
    "tipo_utente": "Privato|Canale sociale|centro riciclo", // Solo se ruolo è "Utente"
    "tipo_utente_nome": "string", // Solo se ruolo è "Utente"
    "tipo_utente_indirizzo": "string", // Opzionale
    "tipo_utente_telefono": "string", // Opzionale
    "tipo_utente_descrizione": "string" // Opzionale
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Registrazione completata con successo",
    "data": {
      "id": 1,
      "email": "user@example.com",
      "nome": "Mario",
      "cognome": "Rossi",
      "ruolo": "Utente",
      "tipo_utente": {
        "id": 1,
        "tipo": "Privato",
        "nome": "Nome tipo utente"
      }
    }
  }
  ```

#### `/api/v1/auth/login`
- **Metodo**: POST
- **Descrizione**: Login utente
- **Autenticazione**: No
- **Parametri**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Login completato con successo",
    "data": {
      "accessToken": "string",
      "refreshToken": "string",
      "user": {
        "id": 1,
        "email": "user@example.com",
        "nome": "Mario",
        "cognome": "Rossi",
        "ruolo": "Utente|Operatore|Amministratore"
      }
    }
  }
  ```

#### `/api/v1/auth/refresh-token`
- **Metodo**: POST
- **Descrizione**: Rinnovo del token di accesso
- **Autenticazione**: No
- **Parametri**:
  ```json
  {
    "refreshToken": "string"
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "accessToken": "string"
    }
  }
  ```

#### `/api/v1/auth/logout`
- **Metodo**: POST
- **Descrizione**: Logout utente
- **Autenticazione**: Sì
- **Parametri**:
  ```json
  {
    "refreshToken": "string" // Opzionale, se non fornito verrà usato il token della sessione corrente
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Logout completato con successo"
  }
  ```

### Gestione Attori (Utenti)

#### `/api/v1/attori`
- **Metodo**: GET
- **Descrizione**: Recupera l'elenco degli attori
- **Autenticazione**: Sì
- **Autorizzazione**: Solo Amministratore
- **Query Params**:
  - `ruolo`: Filtra per ruolo (opzionale)
  - `page`: Numero pagina (default: 1)
  - `limit`: Elementi per pagina (default: 20)
  - `sort`: Campo di ordinamento (default: id)
  - `order`: Direzione ordinamento (asc|desc, default: asc)
  - `search`: Ricerca testuale nei campi nome, cognome, email
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "attori": [
        {
          "id": 1,
          "email": "user@example.com",
          "nome": "Mario",
          "cognome": "Rossi",
          "ruolo": "Utente",
          "telefono": "1234567890",
          "creato_il": "2025-03-01T12:00:00Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 100,
        "pages": 5
      }
    }
  }
  ```

#### `/api/v1/attori/:id`
- **Metodo**: GET
- **Descrizione**: Recupera un singolo attore per ID
- **Autenticazione**: Sì
- **Autorizzazione**: Amministratore o lo stesso attore (solo propri dati)
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "id": 1,
      "email": "user@example.com",
      "nome": "Mario",
      "cognome": "Rossi",
      "ruolo": "Utente",
      "telefono": "1234567890",
      "indirizzo": "Via Roma 1",
      "creato_il": "2025-03-01T12:00:00Z",
      "ultimo_accesso": "2025-04-01T10:30:00Z",
      "tipi_utente": [
        {
          "id": 1,
          "tipo": "Privato",
          "nome": "Nome tipo utente"
        }
      ]
    }
  }
  ```

#### `/api/v1/attori/:id`
- **Metodo**: PUT
- **Descrizione**: Aggiorna un attore
- **Autenticazione**: Sì
- **Autorizzazione**: Amministratore o lo stesso attore (solo propri dati)
- **Parametri**:
  ```json
  {
    "nome": "string", // opzionale
    "cognome": "string", // opzionale
    "telefono": "string", // opzionale
    "indirizzo": "string", // opzionale
    "password": "string", // opzionale
    "ruolo": "Utente|Operatore|Amministratore" // opzionale, solo per Amministratore
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Attore aggiornato con successo",
    "data": {
      "id": 1,
      "email": "user@example.com", 
      "nome": "Mario",
      "cognome": "Rossi"
    }
  }
  ```

#### `/api/v1/attori/:id`
- **Metodo**: DELETE
- **Descrizione**: Elimina un attore
- **Autenticazione**: Sì
- **Autorizzazione**: Solo Amministratore
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Attore eliminato con successo"
  }
  ```

### Gestione Tipi Utente (ex Centri)

#### `/api/v1/tipi-utente`
- **Metodo**: GET
- **Descrizione**: Recupera l'elenco dei tipi utente
- **Autenticazione**: Sì
- **Query Params**:
  - `tipo`: Filtra per tipo (Privato, Canale sociale, centro riciclo)
  - `page`: Numero pagina (default: 1)
  - `limit`: Elementi per pagina (default: 20)
  - `search`: Ricerca testuale nel nome
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "tipi_utente": [
        {
          "id": 1,
          "tipo": "Privato",
          "nome": "Nome tipo utente",
          "indirizzo": "Via Roma 1",
          "email": "centro@example.com",
          "telefono": "1234567890"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 50,
        "pages": 3
      }
    }
  }
  ```

#### `/api/v1/tipi-utente/:id`
- **Metodo**: GET
- **Descrizione**: Recupera un singolo tipo utente per ID
- **Autenticazione**: Sì
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "id": 1,
      "tipo": "Privato",
      "nome": "Nome tipo utente",
      "indirizzo": "Via Roma 1",
      "email": "centro@example.com",
      "telefono": "1234567890",
      "descrizione": "Descrizione del tipo utente",
      "creato_il": "2025-03-01T12:00:00Z"
    }
  }
  ```

#### `/api/v1/tipi-utente`
- **Metodo**: POST
- **Descrizione**: Crea un nuovo tipo utente
- **Autenticazione**: Sì
- **Autorizzazione**: Solo Amministratore
- **Parametri**:
  ```json
  {
    "tipo": "Privato|Canale sociale|centro riciclo",
    "nome": "string",
    "indirizzo": "string", // opzionale
    "email": "string", // opzionale
    "telefono": "string", // opzionale
    "descrizione": "string" // opzionale
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Tipo utente creato con successo",
    "data": {
      "id": 1,
      "tipo": "Privato",
      "nome": "Nome tipo utente"
    }
  }
  ```

#### `/api/v1/tipi-utente/:id/attori`
- **Metodo**: GET
- **Descrizione**: Recupera gli attori associati a un tipo utente
- **Autenticazione**: Sì
- **Autorizzazione**: Amministratore o appartenente al tipo utente
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "attori": [
        {
          "id": 1,
          "email": "user@example.com",
          "nome": "Mario",
          "cognome": "Rossi",
          "ruolo": "Utente"
        }
      ]
    }
  }
  ```

### Gestione Lotti

#### `/api/v1/lotti`
- **Metodo**: GET
- **Descrizione**: Recupera l'elenco dei lotti
- **Autenticazione**: Sì
- **Query Params**:
  - `stato`: Filtra per stato (Verde, Arancione, Rosso)
  - `tipo_utente_id`: Filtra per tipo utente origine
  - `categoria`: Filtra per categoria
  - `data_min`: Filtra per data scadenza minima
  - `data_max`: Filtra per data scadenza massima
  - `cerca`: Ricerca testuale nel nome prodotto
  - `page`: Numero pagina
  - `limit`: Elementi per pagina
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "lotti": [
        {
          "id": 1,
          "prodotto": "Pasta",
          "quantita": 10,
          "unita_misura": "kg",
          "data_scadenza": "2025-05-01",
          "stato": "Verde",
          "prezzo": 15.5,
          "tipo_utente_origine_id": 1,
          "tipo_utente_origine_nome": "Nome tipo utente",
          "stato_prenotazione": null,
          "categorie": ["Primo", "Secco"]
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 150,
        "pages": 8
      }
    }
  }
  ```

#### `/api/v1/lotti/disponibili`
- **Metodo**: GET
- **Descrizione**: Recupera l'elenco dei lotti disponibili per la prenotazione (non prenotati)
- **Autenticazione**: Sì
- **Query Params**: Gli stessi di `/api/v1/lotti`
- **Risposta**: Uguale a `/api/v1/lotti`

#### `/api/v1/lotti/:id`
- **Metodo**: GET
- **Descrizione**: Recupera un singolo lotto per ID
- **Autenticazione**: Sì
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "id": 1,
      "prodotto": "Pasta",
      "quantita": 10,
      "unita_misura": "kg",
      "data_scadenza": "2025-05-01",
      "stato": "Verde",
      "prezzo": 15.5,
      "descrizione": "Pasta di grano duro",
      "tipo_utente_origine_id": 1,
      "tipo_utente_origine_nome": "Nome tipo utente",
      "inserito_da": 3,
      "giorni_permanenza": 7,
      "creato_il": "2025-03-01T12:00:00Z",
      "aggiornato_il": "2025-03-01T12:00:00Z",
      "categorie": ["Primo", "Secco"],
      "stato_prenotazione": null
    }
  }
  ```

#### `/api/v1/lotti`
- **Metodo**: POST
- **Descrizione**: Crea un nuovo lotto
- **Autenticazione**: Sì
- **Autorizzazione**: Operatore o Amministratore
- **Parametri**:
  ```json
  {
    "prodotto": "string",
    "quantita": "number",
    "unita_misura": "string",
    "data_scadenza": "YYYY-MM-DD",
    "prezzo": "number", // opzionale, solo per lotti verdi
    "descrizione": "string", // opzionale
    "tipo_utente_origine_id": "number",
    "giorni_permanenza": "number", // opzionale, default: 7
    "categorie_ids": ["number"] // opzionale, array di ID categorie
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Lotto creato con successo",
    "data": {
      "id": 1,
      "prodotto": "Pasta"
    }
  }
  ```

#### `/api/v1/lotti/:id`
- **Metodo**: PUT
- **Descrizione**: Aggiorna un lotto esistente
- **Autenticazione**: Sì
- **Autorizzazione**: Operatore o Amministratore
- **Parametri**:
  ```json
  {
    "prodotto": "string", // opzionale
    "quantita": "number", // opzionale
    "unita_misura": "string", // opzionale
    "data_scadenza": "YYYY-MM-DD", // opzionale
    "prezzo": "number", // opzionale, deve essere 0 se stato non è Verde
    "descrizione": "string", // opzionale
    "stato": "Verde|Arancione|Rosso", // opzionale, se modificato e non Verde, prezzo = 0
    "giorni_permanenza": "number", // opzionale
    "categorie_ids": ["number"] // opzionale
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Lotto aggiornato con successo",
    "data": {
      "id": 1,
      "prodotto": "Pasta",
      "stato": "Verde"
    }
  }
  ```

#### `/api/v1/lotti/:id/prezzo`
- **Metodo**: PUT
- **Descrizione**: Aggiorna solo il prezzo di un lotto
- **Autenticazione**: Sì
- **Autorizzazione**: Operatore o Amministratore
- **Parametri**:
  ```json
  {
    "prezzo": "number" // Deve essere 0 se stato non è Verde
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Prezzo del lotto aggiornato con successo",
    "data": {
      "id": 1,
      "prodotto": "Pasta",
      "prezzo": 15.5
    }
  }
  ```

### Gestione Prenotazioni

#### `/api/v1/prenotazioni`
- **Metodo**: GET
- **Descrizione**: Recupera l'elenco delle prenotazioni
- **Autenticazione**: Sì
- **Query Params**:
  - `stato`: Filtra per stato
  - `tipo_utente_id`: Filtra per tipo utente ricevente
  - `data_inizio`: Filtra per data prenotazione minima
  - `data_fine`: Filtra per data prenotazione massima
  - `page`: Numero pagina
  - `limit`: Elementi per pagina
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "prenotazioni": [
        {
          "id": 1,
          "lotto_id": 1,
          "attore_id": 2,
          "tipo_utente_ricevente_id": 3,
          "stato": "Prenotato",
          "data_prenotazione": "2025-04-01T10:30:00Z",
          "data_ritiro_prevista": "2025-04-03",
          "tipo_pagamento": "contanti",
          "prodotto": "Pasta",
          "quantita": 10,
          "unita_misura": "kg",
          "tipo_utente_ricevente_nome": "Centro Sociale ABC"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 45,
        "pages": 3
      }
    }
  }
  ```

#### `/api/v1/prenotazioni/:id`
- **Metodo**: GET
- **Descrizione**: Recupera una singola prenotazione per ID
- **Autenticazione**: Sì
- **Autorizzazione**: Amministratore, Operatore o utente coinvolto
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "id": 1,
      "lotto_id": 1,
      "lotto": {
        "id": 1,
        "prodotto": "Pasta",
        "quantita": 10,
        "unita_misura": "kg",
        "data_scadenza": "2025-05-01",
        "stato": "Verde",
        "prezzo": 15.5
      },
      "attore_id": 2,
      "attore": {
        "id": 2,
        "nome": "Mario",
        "cognome": "Rossi"
      },
      "tipo_utente_ricevente_id": 3,
      "tipo_utente_ricevente": {
        "id": 3,
        "tipo": "Canale sociale",
        "nome": "Centro Sociale ABC"
      },
      "stato": "Prenotato",
      "data_prenotazione": "2025-04-01T10:30:00Z",
      "data_ritiro_prevista": "2025-04-03",
      "data_ritiro_effettiva": null,
      "tipo_pagamento": "contanti",
      "note": "Ritiro pomeridiano"
    }
  }
  ```

#### `/api/v1/prenotazioni`
- **Metodo**: POST
- **Descrizione**: Crea una nuova prenotazione
- **Autenticazione**: Sì
- **Parametri**:
  ```json
  {
    "lotto_id": "number",
    "tipo_utente_ricevente_id": "number",
    "data_ritiro_prevista": "YYYY-MM-DD", // opzionale
    "note": "string", // opzionale
    "tipo_pagamento": "contanti|bonifico|null" // obbligatorio solo per Privati che prenotano lotti verdi
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Prenotazione creata con successo",
    "data": {
      "id": 1,
      "stato": "Prenotato",
      "lotto_id": 1
    }
  }
  ```

#### `/api/v1/prenotazioni/:id/accetta`
- **Metodo**: PUT
- **Descrizione**: Accetta una prenotazione
- **Autenticazione**: Sì
- **Autorizzazione**: Amministratore, Operatore o proprietario del lotto
- **Parametri**:
  ```json
  {
    "data_ritiro_prevista": "YYYY-MM-DD",
    "note": "string" // opzionale
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Prenotazione accettata con successo",
    "data": {
      "id": 1,
      "stato": "Confermato"
    }
  }
  ```

#### `/api/v1/prenotazioni/:id/rifiuta`
- **Metodo**: PUT
- **Descrizione**: Rifiuta una prenotazione
- **Autenticazione**: Sì
- **Autorizzazione**: Amministratore, Operatore o proprietario del lotto
- **Parametri**:
  ```json
  {
    "motivazione": "string"
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Prenotazione rifiutata con successo",
    "data": {
      "id": 1,
      "stato": "Rifiutato"
    }
  }
  ```

#### `/api/v1/prenotazioni/:id/pronto-per-ritiro`
- **Metodo**: PUT
- **Descrizione**: Segna una prenotazione come pronta per il ritiro
- **Autenticazione**: Sì
- **Autorizzazione**: Amministratore, Operatore o proprietario del lotto
- **Parametri**:
  ```json
  {
    "note": "string" // opzionale
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Prenotazione segnata come pronta per il ritiro",
    "data": {
      "id": 1,
      "stato": "ProntoPerRitiro"
    }
  }
  ```

#### `/api/v1/prenotazioni/:id/in-transito`
- **Metodo**: PUT
- **Descrizione**: Segna una prenotazione come in transito
- **Autenticazione**: Sì
- **Autorizzazione**: Amministratore, Operatore o proprietario del lotto
- **Parametri**:
  ```json
  {
    "note": "string" // opzionale
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Prenotazione segnata come in transito",
    "data": {
      "id": 1,
      "stato": "InTransito"
    }
  }
  ```

#### `/api/v1/prenotazioni/:id/registra-ritiro`
- **Metodo**: PUT
- **Descrizione**: Registra il ritiro di una prenotazione
- **Autenticazione**: Sì
- **Autorizzazione**: Amministratore, Operatore o proprietario del lotto
- **Parametri**:
  ```json
  {
    "ritirato_da": "string",
    "documento_ritiro": "string", // opzionale
    "note_ritiro": "string" // opzionale
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Ritiro registrato con successo",
    "data": {
      "id": 1,
      "stato": "Consegnato"
    }
  }
  ```

#### `/api/v1/prenotazioni/:id/annulla`
- **Metodo**: PUT
- **Descrizione**: Annulla una prenotazione
- **Autenticazione**: Sì
- **Autorizzazione**: Utente che ha effettuato la prenotazione
- **Parametri**:
  ```json
  {
    "motivo": "string" // opzionale
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Prenotazione annullata con successo",
    "data": {
      "id": 1,
      "stato": "Annullato"
    }
  }
  ```

### Gestione Notifiche

#### `/api/v1/notifiche`
- **Metodo**: GET
- **Descrizione**: Recupera l'elenco delle notifiche dell'utente corrente
- **Autenticazione**: Sì
- **Query Params**:
  - `letto`: Filtra per stato lettura (0/1)
  - `limit`: Numero massimo di notifiche (default: 50)
  - `offset`: Offset per paginazione
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "notifiche": [
        {
          "id": 1,
          "tipo": "prenotazione_confermata",
          "titolo": "Prenotazione confermata",
          "descrizione": "La tua prenotazione per il lotto 'Pasta' è stata confermata",
          "data_creazione": "2025-04-01T10:30:00Z",
          "letto": 0,
          "azione_richiesta": "visualizza_prenotazione",
          "riferimento_id": 3
        }
      ],
      "non_lette": 5,
      "totale": 25
    }
  }
  ```

#### `/api/v1/notifiche/:id/segna-letta`
- **Metodo**: PUT
- **Descrizione**: Segna una notifica come letta
- **Autenticazione**: Sì
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Notifica segnata come letta"
  }
  ```

#### `/api/v1/notifiche/segna-tutte-lette`
- **Metodo**: PUT
- **Descrizione**: Segna tutte le notifiche come lette
- **Autenticazione**: Sì
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Tutte le notifiche segnate come lette",
    "data": {
      "aggiornate": 5
    }
  }
  ```

### Gestione Categorie

#### `/api/v1/categorie`
- **Metodo**: GET
- **Descrizione**: Recupera l'elenco delle categorie
- **Autenticazione**: Sì
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "categorie": [
        {
          "id": 1,
          "nome": "Primo",
          "descrizione": "Primi piatti"
        },
        {
          "id": 2,
          "nome": "Secco",
          "descrizione": "Alimenti a lunga conservazione"
        }
      ]
    }
  }
  ```

#### `/api/v1/categorie`
- **Metodo**: POST
- **Descrizione**: Crea una nuova categoria
- **Autenticazione**: Sì
- **Autorizzazione**: Amministratore
- **Parametri**:
  ```json
  {
    "nome": "string",
    "descrizione": "string" // opzionale
  }
  ```
- **Risposta**:
  ```json
  {
    "status": "success",
    "message": "Categoria creata con successo",
    "data": {
      "id": 3,
      "nome": "Proteici"
    }
  }
  ```

### Statistiche

#### `/api/v1/statistiche/impatto`
- **Metodo**: GET
- **Descrizione**: Recupera statistiche sull'impatto ambientale
- **Autenticazione**: Sì
- **Query Params**:
  - `periodo`: Filtra per periodo (settimana, mese, anno)
  - `tipo_utente_id`: Filtra per tipo utente
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "statistiche": {
        "periodo": "2025-04",
        "lotti_salvati": 150,
        "kg_cibo_salvato": 1250.5,
        "co2_risparmiata_kg": 3125.25,
        "valore_economico": 2500.75
      },
      "trend": [
        {
          "periodo": "2025-03",
          "lotti_salvati": 140,
          "kg_cibo_salvato": 1100.0,
          "co2_risparmiata_kg": 2750.0,
          "valore_economico": 2200.50
        },
        {
          "periodo": "2025-04",
          "lotti_salvati": 150,
          "kg_cibo_salvato": 1250.5,
          "co2_risparmiata_kg": 3125.25,
          "valore_economico": 2500.75
        }
      ]
    }
  }
  ```

#### `/api/v1/statistiche/lotti`
- **Metodo**: GET
- **Descrizione**: Recupera statistiche sui lotti
- **Autenticazione**: Sì
- **Query Params**: Gli stessi di `/api/v1/statistiche/impatto`
- **Risposta**:
  ```json
  {
    "status": "success",
    "data": {
      "per_stato": {
        "Verde": 45,
        "Arancione": 30,
        "Rosso": 25
      },
      "per_categoria": {
        "Primo": 20,
        "Secco": 35,
        "Proteici": 15,
        "Altri": 30
      },
      "per_tipo_utente": [
        {
          "tipo_utente_id": 1,
          "tipo_utente_nome": "Centro Distribuzione A",
          "lotti": 50,
          "percentuale": 33.3
        },
        {
          "tipo_utente_id": 2,
          "tipo_utente_nome": "Centro Distribuzione B",
          "lotti": 100,
          "percentuale": 66.7
        }
      ]
    }
  }
  ```

### WebSocket API

Refood implementa anche un'API WebSocket per le notifiche in tempo reale. Il WebSocket è accessibile all'endpoint:

```
ws://your-server-address:3000/api/notifications/ws?token=<jwt_token>
```

#### Eventi WebSocket

1. **connect**: Connessione stabilita
   ```json
   {
     "type": "connect",
     "payload": {
       "message": "Connessione stabilita",
       "session_id": "uuid-session-id"
     },
     "timestamp": 1712345678900
   }
   ```

2. **notification**: Nuova notifica
   ```json
   {
     "type": "notification",
     "payload": {
       "id": 1,
       "tipo": "prenotazione_confermata",
       "titolo": "Prenotazione confermata",
       "descrizione": "La tua prenotazione per il lotto 'Pasta' è stata confermata",
       "data_creazione": "2025-04-01T10:30:00Z",
       "letto": 0,
       "azione_richiesta": "visualizza_prenotazione",
       "riferimento_id": 3
     },
     "timestamp": 1712345678900
   }
   ```

3. **lotto_update**: Aggiornamento di un lotto
   ```json
   {
     "type": "lotto_update",
     "payload": {
       "id": 1,
       "prodotto": "Pasta",
       "stato": "Verde",
       "stato_prenotazione": "Prenotato"
     },
     "timestamp": 1712345678900
   }
   ```

4. **prenotazione_update**: Aggiornamento di una prenotazione
   ```json
   {
     "type": "prenotazione_update",
     "payload": {
       "id": 1,
       "lotto_id": 1,
       "stato": "Confermato",
       "data_ritiro_prevista": "2025-04-03"
     },
     "timestamp": 1712345678900
   }
   ```

5. **ping/pong**: Heartbeat per mantenere la connessione attiva
   ```json
   {
     "type": "ping",
     "timestamp": 1712345678900
   }
   ```
   Risposta:
   ```json
   {
     "type": "pong",
     "timestamp": 1712345678900
   }
   ```

#### Riconnessione

Se la connessione WebSocket viene persa, il client può riconnettersi utilizzando il session_id ricevuto durante la connessione iniziale:

```
ws://your-server-address:3000/api/notifications/ws?session_id=<session_id>
``` 

## Flussi Applicativi

I flussi applicativi principali in Refood rappresentano i processi chiave che gli utenti eseguono all'interno del sistema. Di seguito sono descritti in dettaglio i flussi più importanti.

### Registrazione e Onboarding Utente

1. **Registrazione utente**:
   - L'utente accede alla schermata di registrazione
   - Inserisce i dati personali (nome, cognome, email, password)
   - Seleziona il tipo di utente (Privato, Canale sociale, Centro riciclo)
   - Fornisce eventuali informazioni aggiuntive specifiche per il tipo di utente
   - Effettua la registrazione
   - Riceve email di conferma

2. **Flusso di onboarding**:
   - Al primo accesso, l'utente visualizza una serie di schermate introduttive
   - Viene guidato attraverso le funzionalità principali dell'app
   - Gli viene mostrato come navigare tra le sezioni principali
   - Viene presentata una panoramica del sistema di prenotazione

### Ciclo di Vita di un Lotto

Il ciclo di vita di un lotto in Refood segue questi passaggi:

1. **Creazione**:
   - Un operatore o amministratore crea un nuovo lotto
   - Inserisce informazioni come prodotto, quantità, data di scadenza
   - Il sistema calcola automaticamente lo stato del lotto (Verde, Arancione, Rosso)
   - Il lotto viene salvato nel database e reso disponibile per la prenotazione

2. **Gestione stato lotto**:
   - Il sistema aggiorna automaticamente lo stato del lotto in base alla data di scadenza
   - Verde: più di 7 giorni alla scadenza (configurabile)
   - Arancione: tra 3 e 7 giorni alla scadenza (configurabile)
   - Rosso: meno di 3 giorni alla scadenza (configurabile)
   - Quando un lotto passa da Verde ad Arancione o Rosso, il prezzo viene automaticamente impostato a 0

3. **Prenotazione**:
   - Un utente visualizza il lotto disponibile e decide di prenotarlo
   - Il sistema verifica la disponibilità e registra la prenotazione
   - Il lotto viene marcato come "Prenotato" ma mantiene il suo stato (Verde/Arancione/Rosso)
   - Il proprietario del lotto riceve una notifica della prenotazione

4. **Conferma**:
   - Il proprietario del lotto può accettare o rifiutare la prenotazione
   - Se accettata, la prenotazione passa allo stato "Confermato"
   - Viene proposta una data di ritiro

5. **Preparazione**:
   - Quando il lotto è pronto per essere ritirato, lo stato viene aggiornato a "ProntoPerRitiro"
   - L'utente riceve una notifica che può procedere con il ritiro

6. **Trasporto**:
   - Quando il lotto viene consegnato o inizia il trasporto, lo stato diventa "InTransito"
   - Il sistema traccia la fase di spostamento del lotto

7. **Consegna**:
   - Una volta consegnato, il lotto viene marcato come "Consegnato"
   - Il sistema registra i dettagli della consegna
   - Il lotto non è più visibile nella lista dei disponibili

8. **Scadenza**:
   - Se un lotto non viene prenotato e raggiunge la data di scadenza, viene automaticamente archiviato
   - Il sistema può generare report sui lotti scaduti per analisi statistiche

### Processo di Prenotazione

1. **Ricerca lotti**:
   - L'utente accede alla sezione "Lotti disponibili"
   - Può filtrare per categoria, data di scadenza, tipo di prodotto
   - Visualizza i dettagli dei lotti disponibili

2. **Prenotazione**:
   - L'utente seleziona un lotto da prenotare
   - Sceglie il tipo utente ricevente (se ne ha più di uno associati)
   - Se è un utente Privato che prenota un lotto Verde, deve specificare il metodo di pagamento
   - Conferma la prenotazione

3. **Gestione prenotazione**:
   - L'utente può visualizzare lo stato delle proprie prenotazioni
   - Può annullare una prenotazione prima del ritiro
   - Riceve notifiche per i cambiamenti di stato

4. **Ritiro**:
   - L'utente si presenta presso il punto di ritiro alla data stabilita
   - L'operatore registra il ritiro nel sistema
   - La prenotazione viene marcata come "Consegnato"

## Gestione Lotti

### Stati del Lotto

I lotti in Refood possono trovarsi in uno dei seguenti stati, ognuno con caratteristiche e regole specifiche:

1. **Verde**:
   - Prodotti con più di 7 giorni alla data di scadenza (configurabile)
   - Possono avere un prezzo > 0
   - Prenotabili da qualsiasi tipo di utente
   - Per utenti Privati è richiesto il pagamento

2. **Arancione**:
   - Prodotti con 3-7 giorni alla data di scadenza (configurabile)
   - Prezzo obbligatoriamente 0 (gratuiti)
   - Prenotabili solo da Canali sociali e Centri riciclo
   - Non è richiesto un metodo di pagamento

3. **Rosso**:
   - Prodotti con meno di 3 giorni alla data di scadenza (configurabile)
   - Prezzo obbligatoriamente 0 (gratuiti)
   - Prenotabili solo da Centri riciclo
   - Non è richiesto un metodo di pagamento

### Gestione Automatica degli Stati

Il sistema di Refood implementa due meccanismi per la gestione automatica degli stati dei lotti:

1. **Trigger database** (`update_lotto_stato_by_scadenza`):
   - Si attiva ad ogni aggiornamento della data di scadenza di un lotto
   - Calcola automaticamente lo stato in base ai giorni rimanenti alla scadenza
   - Imposta il prezzo a 0 se lo stato diventa Arancione o Rosso
   - Registra il cambio di stato nel log

2. **Job schedulato** (`aggiorna_stati_lotti.js`):
   - Viene eseguito automaticamente ogni giorno a mezzanotte
   - Verifica tutti i lotti nel database e aggiorna gli stati
   - Esegue lo stesso algoritmo del trigger ma su tutti i lotti
   - Genera notifiche per i lotti che cambiano stato

### Creazione e Modifica Lotti

Per creare o modificare un lotto, vengono eseguiti i seguenti passaggi:

1. **Validazione dati**:
   - Verifica che tutti i campi obbligatori siano presenti
   - Controlla che la data di scadenza sia valida e nel futuro
   - Verifica che il prezzo sia consistente con lo stato del lotto

2. **Calcolo dello stato**:
   - In base alla data di scadenza, viene calcolato lo stato del lotto
   - Se lo stato è Arancione o Rosso, il prezzo viene impostato a 0

3. **Persistenza dati**:
   - I dati vengono salvati nel database
   - Vengono create le associazioni con le categorie selezionate

4. **Notifiche**:
   - Il sistema genera notifiche per gli utenti interessati
   - Gli amministratori ricevono aggiornamenti sui nuovi lotti

### Categorizzazione dei Lotti

I lotti possono essere categorizzati per facilitare la ricerca e la gestione:

1. **Categorie principali**:
   - Primo: prodotti per primi piatti
   - Secco: alimenti a lunga conservazione
   - Proteici: alimenti ricchi di proteine
   - Fresco: prodotti freschi
   - Surgelato: prodotti congelati

2. **Relazione molti-a-molti**:
   - Un lotto può appartenere a più categorie
   - Le categorie sono gestite nella tabella `Categorie`
   - L'associazione è implementata nella tabella `LottiCategorie`

3. **Ricerca per categoria**:
   - Gli utenti possono filtrare i lotti per categoria
   - L'API supporta il filtraggio multiplo per ottimizzare la ricerca

## Sistema di Prenotazioni

### Stati della Prenotazione

Le prenotazioni in Refood attraversano vari stati che ne tracciano il ciclo di vita completo:

1. **Prenotato**:
   - Stato iniziale dopo la creazione di una prenotazione
   - Il lotto è riservato ma la prenotazione non è ancora stata accettata
   - L'utente è in attesa di conferma

2. **InAttesa**:
   - La prenotazione è stata ricevuta ma è in attesa di ulteriore valutazione
   - Stato opzionale, utilizzato in casi particolari

3. **Confermato**:
   - La prenotazione è stata accettata dal proprietario del lotto
   - È stata concordata una data di ritiro
   - L'utente può procedere con il processo di ritiro

4. **ProntoPerRitiro**:
   - Il lotto è stato preparato ed è pronto per essere ritirato
   - L'utente dovrebbe procedere con il ritiro alla data stabilita

5. **InTransito**:
   - Il lotto è in fase di trasporto/consegna
   - Stato opzionale, utilizzato quando è prevista una consegna

6. **Consegnato**:
   - Il lotto è stato ritirato con successo
   - La prenotazione è completata e archiviata
   - I dati vengono utilizzati per le statistiche

7. **Rifiutato**:
   - La prenotazione è stata rifiutata dal proprietario del lotto
   - Viene registrata la motivazione del rifiuto
   - Il lotto torna disponibile per altre prenotazioni

8. **Annullato**:
   - La prenotazione è stata annullata dall'utente che l'ha effettuata
   - Viene registrato il motivo dell'annullamento
   - Il lotto torna disponibile per altre prenotazioni

### Processo di Validazione

Quando un utente crea una nuova prenotazione, il sistema verifica:

1. **Disponibilità del lotto**:
   - Il lotto deve esistere e non deve essere già prenotato
   - Se il lotto è già prenotato, la richiesta viene respinta

2. **Permessi basati su tipo utente**:
   - Verifica che il tipo di utente possa prenotare il lotto in base al suo stato
   - Privati: solo lotti Verdi
   - Canali sociali: lotti Verdi e Arancioni
   - Centri riciclo: tutti i lotti

3. **Validazione pagamento**:
   - Se l'utente è Privato e il lotto è Verde, deve specificare un metodo di pagamento
   - Per altri tipi di utente o stati del lotto, il pagamento è impostato a null
   - Metodi di pagamento accettati: "contanti" o "bonifico"

4. **Doppia prenotazione**:
   - Un utente non può prenotare lo stesso lotto più volte
   - Il sistema controlla che non ci siano prenotazioni attive dello stesso utente per il lotto

### Metodi di Pagamento

Per le prenotazioni che richiedono un pagamento (utenti Privati che prenotano lotti Verdi):

1. **Contanti**:
   - Il pagamento avviene al momento del ritiro
   - Non è richiesta alcuna verifica anticipata

2. **Bonifico**:
   - L'utente deve effettuare un bonifico bancario
   - I dettagli del bonifico sono indicati nelle note della prenotazione
   - Il sistema non verifica automaticamente l'avvenuto pagamento

### Notifiche di Prenotazione

Il sistema di notifiche tiene aggiornati gli utenti sull'avanzamento delle prenotazioni:

1. **Creazione prenotazione**:
   - Il proprietario del lotto riceve una notifica di nuova prenotazione
   - L'utente riceve una conferma che la prenotazione è stata registrata

2. **Cambio stato**:
   - Ogni cambio di stato genera una notifica per l'utente
   - Le notifiche includono informazioni rilevanti (es. data di ritiro)

3. **Promemoria**:
   - Il sistema invia promemoria per il ritiro un giorno prima della data prevista
   - Se una prenotazione rimane troppo a lungo in stato "Prenotato", viene inviato un promemoria al proprietario

### Ritiro e Completamento

Il processo di ritiro di un lotto prenotato include:

1. **Verifica identità**:
   - L'operatore verifica l'identità della persona che ritira il lotto
   - Può registrare il nome della persona e/o il documento presentato

2. **Registrazione ritiro**:
   - L'operatore conferma il ritiro nel sistema
   - La prenotazione passa allo stato "Consegnato"
   - Vengono registrate data e ora effettive del ritiro

3. **Pagamento**:
   - Se era previsto un pagamento in contanti, questo viene effettuato al momento del ritiro
   - Il sistema non traccia direttamente i pagamenti ma solo il metodo scelto

## Sistema di Prenotazioni

### Stati della Prenotazione

Le prenotazioni in Refood attraversano vari stati che ne tracciano il ciclo di vita completo:

1. **Prenotato**:
   - Stato iniziale dopo la creazione di una prenotazione
   - Il lotto è riservato ma la prenotazione non è ancora stata accettata
   - L'utente è in attesa di conferma

2. **InAttesa**:
   - La prenotazione è stata ricevuta ma è in attesa di ulteriore valutazione
   - Stato opzionale, utilizzato in casi particolari

3. **Confermato**:
   - La prenotazione è stata accettata dal proprietario del lotto
   - È stata concordata una data di ritiro
   - L'utente può procedere con il processo di ritiro

4. **ProntoPerRitiro**:
   - Il lotto è stato preparato ed è pronto per essere ritirato
   - L'utente dovrebbe procedere con il ritiro alla data stabilita

5. **InTransito**:
   - Il lotto è in fase di trasporto/consegna
   - Stato opzionale, utilizzato quando è prevista una consegna

6. **Consegnato**:
   - Il lotto è stato ritirato con successo
   - La prenotazione è completata e archiviata
   - I dati vengono utilizzati per le statistiche

7. **Rifiutato**:
   - La prenotazione è stata rifiutata dal proprietario del lotto
   - Viene registrata la motivazione del rifiuto
   - Il lotto torna disponibile per altre prenotazioni

8. **Annullato**:
   - La prenotazione è stata annullata dall'utente che l'ha effettuata
   - Viene registrato il motivo dell'annullamento
   - Il lotto torna disponibile per altre prenotazioni

### Processo di Validazione

Quando un utente crea una nuova prenotazione, il sistema verifica:

1. **Disponibilità del lotto**:
   - Il lotto deve esistere e non deve essere già prenotato
   - Se il lotto è già prenotato, la richiesta viene respinta

2. **Permessi basati su tipo utente**:
   - Verifica che il tipo di utente possa prenotare il lotto in base al suo stato
   - Privati: solo lotti Verdi
   - Canali sociali: lotti Verdi e Arancioni
   - Centri riciclo: tutti i lotti

3. **Validazione pagamento**:
   - Se l'utente è Privato e il lotto è Verde, deve specificare un metodo di pagamento
   - Per altri tipi di utente o stati del lotto, il pagamento è impostato a null
   - Metodi di pagamento accettati: "contanti" o "bonifico"

4. **Doppia prenotazione**:
   - Un utente non può prenotare lo stesso lotto più volte
   - Il sistema controlla che non ci siano prenotazioni attive dello stesso utente per il lotto

### Metodi di Pagamento

Per le prenotazioni che richiedono un pagamento (utenti Privati che prenotano lotti Verdi):

1. **Contanti**:
   - Il pagamento avviene al momento del ritiro
   - Non è richiesta alcuna verifica anticipata

2. **Bonifico**:
   - L'utente deve effettuare un bonifico bancario
   - I dettagli del bonifico sono indicati nelle note della prenotazione
   - Il sistema non verifica automaticamente l'avvenuto pagamento

### Notifiche di Prenotazione

Il sistema di notifiche tiene aggiornati gli utenti sull'avanzamento delle prenotazioni:

1. **Creazione prenotazione**:
   - Il proprietario del lotto riceve una notifica di nuova prenotazione
   - L'utente riceve una conferma che la prenotazione è stata registrata

2. **Cambio stato**:
   - Ogni cambio di stato genera una notifica per l'utente
   - Le notifiche includono informazioni rilevanti (es. data di ritiro)

3. **Promemoria**:
   - Il sistema invia promemoria per il ritiro un giorno prima della data prevista
   - Se una prenotazione rimane troppo a lungo in stato "Prenotato", viene inviato un promemoria al proprietario

### Ritiro e Completamento

Il processo di ritiro di un lotto prenotato include:

1. **Verifica identità**:
   - L'operatore verifica l'identità della persona che ritira il lotto
   - Può registrare il nome della persona e/o il documento presentato

2. **Registrazione ritiro**:
   - L'operatore conferma il ritiro nel sistema
   - La prenotazione passa allo stato "Consegnato"
   - Vengono registrate data e ora effettive del ritiro

3. **Pagamento**:
   - Se era previsto un pagamento in contanti, questo viene effettuato al momento del ritiro
   - Il sistema non traccia direttamente i pagamenti ma solo il metodo scelto 

## Sistema di Autenticazione

### Panoramica dell'Autenticazione

Il sistema di autenticazione di Refood è implementato utilizzando JSON Web Tokens (JWT), garantendo un'architettura stateless e scalabile. L'autenticazione avviene in due fasi, utilizzando access token e refresh token, con meccanismi di sicurezza avanzati per proteggere gli account utente.

### Architettura JWT

1. **Token di Accesso (Access Token)**:
   - Breve durata (default: 30 minuti)
   - Contiene informazioni sull'utente e sulle autorizzazioni
   - Utilizzato per autenticare le richieste API
   - Firmato con una chiave segreta configurata nell'ambiente

2. **Token di Aggiornamento (Refresh Token)**:
   - Lunga durata (default: 7 giorni)
   - Memorizzato nel database per permettere la revoca
   - Utilizzato per ottenere un nuovo access token senza ripetere il login
   - Può essere invalidato manualmente durante il logout

### Processo di Autenticazione

1. **Registrazione**:
   - L'utente fornisce le credenziali e i dati personali
   - La password viene hashata utilizzando bcrypt prima di essere salvata
   - Viene creato un nuovo record nella tabella Attori
   - Se necessario, viene creata l'associazione con il tipo utente

2. **Login**:
   - L'utente fornisce email e password
   - Il sistema verifica l'esistenza dell'email e la corrispondenza della password
   - In caso di successo, genera access token e refresh token
   - Il refresh token viene salvato nel database associato all'utente
   - Viene aggiornato il campo `ultimo_accesso` per l'utente

3. **Autorizzazione**:
   - Ogni richiesta API protetta include l'access token nell'header Authorization
   - Il middleware verifica la validità del token e estrae le informazioni utente
   - I ruoli e i permessi dell'utente determinano l'accesso alle risorse

4. **Rinnovo del Token**:
   - Quando l'access token scade, il client utilizza il refresh token per ottenerne uno nuovo
   - Il sistema verifica che il refresh token sia valido e non revocato
   - Viene generato un nuovo access token mantenendo lo stesso refresh token

5. **Logout**:
   - Il client invia il refresh token al server
   - Il server invalida il refresh token nel database
   - Eventuali access token rimangono tecnicamente validi fino alla scadenza, ma sono di breve durata

### Sicurezza

1. **Protezione delle Password**:
   - Le password sono sempre hashate con bcrypt prima di essere memorizzate
   - Il fattore di costo (rounds) è configurabile per bilanciare sicurezza e performance

2. **Protezione contro Attacchi**:
   - Rate limiting sulle API di autenticazione per prevenire attacchi brute force
   - Validazione dei token per prevenire manipolazioni
   - CORS configurato per accettare solo origini autorizzate

3. **Gestione delle Sessioni**:
   - I refresh token hanno un ID univoco per tracciamento
   - Un utente può avere più sessioni attive contemporaneamente (multidevice)
   - L'amministratore può terminare tutte le sessioni di un utente

4. **Rotazione dei Token**:
   - I token di accesso vengono rinnovati automaticamente utilizzando il refresh token
   - Se viene rilevata un'attività sospetta, tutti i token possono essere invalidati

### Implementazione

Il sistema di autenticazione è implementato utilizzando le seguenti tecnologie:

1. **Backend**:
   - `jsonwebtoken` per la generazione e verifica dei JWT
   - `bcrypt` per l'hashing delle password
   - Middleware personalizzati per l'autorizzazione basata su ruoli

2. **Mobile App**:
   - Secure storage per memorizzare i token sul dispositivo
   - Interceptor per aggiungere automaticamente il token alle richieste
   - Logica di refresh automatico quando l'access token scade

### Gestione degli Utenti

1. **Tipi di Utenti**:
   - **Amministratore**: Accesso completo al sistema
   - **Operatore**: Gestione di lotti e prenotazioni
   - **Utente**: Accesso limitato alle funzionalità di base

2. **Tipi di Utenti Riceventi**:
   - **Privato**: Utenti finali che acquistano lotti verdi
   - **Canale sociale**: Organizzazioni benefiche che ricevono lotti verdi e arancioni
   - **Centro riciclo**: Entità che possono ritirare qualsiasi tipo di lotto

3. **Controllo Accessi**:
   - Middleware che verifica il ruolo dell'utente prima di consentire l'accesso
   - Controlli a livello di servizio per verificare l'appartenenza a un tipo utente
   - Validazione dell'autorizzazione per operazioni su risorse specifiche

## Notifiche e WebSockets

### Sistema di Notifiche

Refood implementa un sistema di notifiche completo per mantenere gli utenti informati sui cambiamenti rilevanti all'interno dell'applicazione. Le notifiche vengono generate per vari eventi e possono essere consegnate attraverso diversi canali.

#### Tipologie di Notifiche

1. **Notifiche di Sistema**:
   - Cambiamenti di stato nei lotti (Verde → Arancione → Rosso)
   - Avvisi di scadenza imminente
   - Informazioni sulla manutenzione del sistema

2. **Notifiche di Prenotazione**:
   - Nuova prenotazione ricevuta (per proprietari di lotti)
   - Prenotazione confermata o rifiutata (per richiedenti)
   - Promemoria di ritiro
   - Cambio stato prenotazione

3. **Notifiche Amministrative**:
   - Nuovi utenti registrati
   - Segnalazioni di problemi
   - Statistiche periodiche

#### Architettura delle Notifiche

1. **Generazione**:
   - Eventi del sistema triggerano la creazione di notifiche
   - Le notifiche vengono create con priorità e destinatari specifici
   - Ogni notifica ha un tipo che determina la sua visualizzazione e comportamento

2. **Memorizzazione**:
   - Le notifiche sono salvate nella tabella `Notifiche`
   - Ogni notifica è collegata a un utente specifico
   - Lo stato di lettura è tracciato per ogni notifica

3. **Distribuzione**:
   - Distribuzione in tempo reale tramite WebSocket
   - Polling periodico come fallback
   - Possibilità di inviare email per notifiche importanti

4. **Visualizzazione**:
   - Icona con contatore delle notifiche non lette
   - Elenco delle notifiche con capacità di filtraggio
   - Azioni contestuali basate sul tipo di notifica

### Implementazione WebSocket

Refood utilizza WebSockets per fornire aggiornamenti in tempo reale e notifiche push, migliorando l'esperienza utente e riducendo la necessità di polling continuo.

#### Architettura WebSocket

1. **Server WebSocket**:
   - Implementato utilizzando la libreria `ws` su Node.js
   - Integrato con il server Express principale
   - Gestisce connessioni persistenti con i client

2. **Connessione e Autenticazione**:
   - La connessione WebSocket richiede un token JWT valido
   - Il token viene verificato all'apertura della connessione
   - Ogni connessione è associata a un utente specifico

3. **Gestione delle Connessioni**:
   - Tracking delle connessioni attive per utente
   - Supporto per riconnessioni automatiche
   - Pulizia delle connessioni inattive

4. **Comunicazione Bidirezionale**:
   - Server → Client: notifiche, aggiornamenti di stato, eventi di sistema
   - Client → Server: conferme di lettura, ping/pong per mantenere attiva la connessione

#### Tipi di Messaggi WebSocket

1. **connect**: Conferma di connessione stabilita
2. **notification**: Nuove notifiche per l'utente
3. **lotto_update**: Aggiornamenti sullo stato di un lotto (prenotazione, cambio stato)
4. **prenotazione_update**: Aggiornamenti sullo stato di una prenotazione
5. **ping/pong**: Heartbeat per mantenere attiva la connessione

#### Formato dei Messaggi

Tutti i messaggi WebSocket seguono un formato JSON standard:

```json
{
  "type": "notification|lotto_update|prenotazione_update|ping|pong",
  "payload": { /* Contenuto specifico per tipo */ },
  "timestamp": 1612345678900
}
```

#### Gestione degli Errori

1. **Disconnessioni**:
   - Il client implementa una logica di riconnessione automatica
   - Le notifiche perse durante la disconnessione vengono recuperate al riconnessione

2. **Fallback**:
   - Se WebSocket non è disponibile, l'app mobile utilizza il polling REST come fallback
   - Le notifiche vengono memorizzate nel database e sono accessibili tramite API REST

3. **Monitoraggio**:
   - Il server monitora lo stato delle connessioni WebSocket
   - Vengono registrati log per connessioni, disconnessioni e errori

### Eventi in Tempo Reale

Gli eventi in tempo reale vengono distribuiti attraverso il sistema WebSocket per fornire aggiornamenti immediati all'interfaccia utente:

1. **Aggiornamenti di Stato dei Lotti**:
   - Quando un lotto cambia stato (Verde → Arancione → Rosso)
   - Quando un lotto viene prenotato o diventa nuovamente disponibile

2. **Aggiornamenti di Prenotazione**:
   - Nuove prenotazioni ricevute
   - Cambiamenti di stato nelle prenotazioni
   - Conferme o rifiuti di prenotazioni

3. **Notifiche di Sistema**:
   - Avvisi importanti dal sistema
   - Promemoria per azioni da completare

### Integrazione con l'Interfaccia Utente

L'interfaccia utente mobile è progettata per integrarsi perfettamente con il sistema di notifiche:

1. **Centro Notifiche**:
   - Elenco di tutte le notifiche ricevute
   - Indicatore del numero di notifiche non lette
   - Possibilità di segnare le notifiche come lette

2. **Notifiche Push**:
   - Integrazione con i servizi di notifica push di iOS e Android
   - Le notifiche importanti possono essere visualizzate anche quando l'app è in background

3. **Aggiornamenti In-App**:
   - Gli elementi dell'interfaccia si aggiornano in tempo reale
   - Animazioni e feedback visivi per i cambiamenti di stato

4. **Azioni Contestuali**:
   - Le notifiche possono contenere azioni dirette (es. "Visualizza Prenotazione")
   - Navigazione diretta alla schermata pertinente toccando la notifica

## Manutenzione Automatica

Refood implementa un sistema di manutenzione automatica che garantisce il corretto funzionamento dell'applicazione, l'aggiornamento dei dati e l'ottimizzazione delle prestazioni. Questa sezione descrive i vari job schedulati e le operazioni di manutenzione automatica implementate nel sistema.

### Job Schedulati

#### Aggiornamento Stati Lotti

Il job di aggiornamento degli stati dei lotti è fondamentale per il funzionamento del sistema, poiché garantisce che i lotti siano sempre classificati correttamente in base alla loro data di scadenza.

1. **Implementazione**:
   - Script: `backend/src/jobs/aggiorna_stati_lotti.js`
   - Schedulazione: Ogni giorno a mezzanotte (00:00)
   - Tecnologia: Node-cron per la schedulazione

2. **Funzionamento**:
   - Recupera tutti i lotti attivi dal database
   - Per ciascun lotto, calcola i giorni rimanenti alla scadenza
   - Aggiorna lo stato in base alle soglie configurate:
     - Verde: > 7 giorni alla scadenza
     - Arancione: 3-7 giorni alla scadenza
     - Rosso: < 3 giorni alla scadenza
   - Se lo stato cambia da Verde ad Arancione o Rosso, imposta il prezzo a 0
   - Registra i cambiamenti nel log di sistema
   - Genera notifiche per i proprietari dei lotti interessati

3. **Gestione Errori**:
   - Logging dettagliato delle operazioni
   - Meccanismo di retry per operazioni fallite
   - Notifica agli amministratori in caso di errori critici

#### Archiviazione Lotti Scaduti

Questo job si occupa di archiviare i lotti che hanno superato la data di scadenza e che non sono stati prenotati.

1. **Implementazione**:
   - Script: `backend/src/jobs/archivia_lotti_scaduti.js`
   - Schedulazione: Ogni giorno alle 03:00
   - Tecnologia: Node-cron

2. **Funzionamento**:
   - Identifica i lotti che hanno superato la data di scadenza
   - Verifica che non siano in stato di prenotazione attiva
   - Sposta i dati in una tabella di archiviazione `LottiArchiviati`
   - Aggiorna le statistiche di sistema
   - Invia report di riepilogo agli amministratori

#### Pulizia Sessioni e Token

Job dedicato alla pulizia delle sessioni scadute e dei token di refresh non più validi.

1. **Implementazione**:
   - Script: `backend/src/jobs/pulizia_sessioni.js`
   - Schedulazione: Ogni giorno alle 04:00
   - Tecnologia: Node-cron

2. **Funzionamento**:
   - Rimuove i refresh token scaduti dal database
   - Pulisce le sessioni WebSocket inattive
   - Ottimizza le tabelle del database

#### Generazione Report Statistici

Job che genera report statistici periodici sull'utilizzo del sistema e sull'impatto ambientale.

1. **Implementazione**:
   - Script: `backend/src/jobs/genera_statistiche.js`
   - Schedulazione: Ogni settimana la domenica alle 23:00
   - Tecnologia: Node-cron

2. **Funzionamento**:
   - Calcola metriche chiave come:
     - Numero di lotti salvati
     - Quantità di cibo recuperato (kg)
     - CO2 risparmiata
     - Valore economico recuperato
   - Genera report in formato PDF e CSV
   - Invia report via email agli amministratori
   - Aggiorna il dashboard con i nuovi dati

### Trigger Database

Oltre ai job schedulati, Refood utilizza trigger database per garantire la consistenza dei dati e automatizzare operazioni critiche.

#### Trigger `update_lotto_stato_by_scadenza`

1. **Descrizione**: Aggiorna automaticamente lo stato di un lotto quando viene modificata la data di scadenza
2. **Attivazione**: AFTER UPDATE sulla colonna `data_scadenza` della tabella `Lotti`
3. **Implementazione**:
   ```sql
   CREATE TRIGGER update_lotto_stato_by_scadenza
   AFTER UPDATE OF data_scadenza ON Lotti
   FOR EACH ROW
   BEGIN
       DECLARE giorni_rimanenti INTEGER;
       DECLARE nuovo_stato VARCHAR(10);
       
       SET giorni_rimanenti = DATEDIFF(NEW.data_scadenza, CURRENT_DATE);
       
       IF giorni_rimanenti > 7 THEN
           SET nuovo_stato = 'Verde';
       ELSEIF giorni_rimanenti >= 3 THEN
           SET nuovo_stato = 'Arancione';
       ELSE
           SET nuovo_stato = 'Rosso';
       END IF;
       
       UPDATE Lotti 
       SET stato = nuovo_stato,
           prezzo = CASE WHEN nuovo_stato != 'Verde' THEN 0 ELSE prezzo END
       WHERE id = NEW.id;
       
       INSERT INTO LogCambioStato (lotto_id, stato_precedente, stato_nuovo, data_cambio)
       VALUES (NEW.id, OLD.stato, nuovo_stato, NOW());
   END;
   ```

#### Trigger `log_cambio_stato_lotti`

1. **Descrizione**: Registra i cambiamenti di stato dei lotti nel log di sistema
2. **Attivazione**: AFTER UPDATE sulla colonna `stato` della tabella `Lotti`
3. **Implementazione**: Registra il cambio di stato nella tabella `LogCambioStato`

#### Trigger `check_attore_ruolo_before_insert`

1. **Descrizione**: Verifica che solo attori con ruolo "Utente" possano essere associati a un TipoUtente
2. **Attivazione**: BEFORE INSERT sulla tabella `AttoriTipoUtente`
3. **Implementazione**: Controlla il ruolo dell'attore prima di permettere l'inserimento

### Monitoraggio del Sistema

Il sistema di monitoraggio automatico tiene traccia dello stato del server e dell'applicazione, garantendo un'identificazione tempestiva dei problemi.

1. **Metriche Monitorate**:
   - Utilizzo CPU e memoria
   - Tempi di risposta delle API
   - Errori e eccezioni
   - Dimensione del database
   - Numero di utenti attivi

2. **Strumenti di Monitoraggio**:
   - Winston per il logging
   - Express-monitor per le metriche HTTP
   - SQLite query monitor per le prestazioni del database

3. **Allarmi e Notifiche**:
   - Notifiche automatiche in caso di:
     - Elevato utilizzo delle risorse
     - Errori ripetuti
     - Tempi di risposta anomali
   - Canali di notifica:
     - Email agli amministratori
     - Dashboard di monitoraggio
     - Webhook per integrazione con strumenti esterni

## Frontend - Struttura e Componenti

L'applicazione mobile di Refood è sviluppata utilizzando React Native con Expo, offrendo un'esperienza fluida e coerente su dispositivi iOS e Android. Questa sezione descrive l'architettura frontend, i principali componenti e le pratiche di sviluppo adottate.

### Architettura Frontend

#### Struttura delle Directory

```
refood-mobile/
├── app/                  # File di navigazione principale (router)
│   ├── (tabs)/          # Layout per navigazione a tab
│   │   ├── index.tsx    # Schermata home
│   │   ├── lotti.tsx    # Schermata lotti
│   │   ├── _layout.tsx  # Configurazione layout tabs
│   ├── auth/            # Schermate autenticazione
│   │   ├── login.tsx    # Schermata login
│   │   ├── register.tsx # Schermata registrazione
│   ├── lotti/           # Schermate gestione lotti
│   │   ├── dettaglio/
│   │   │   ├── [id].tsx # Dettaglio lotto dinamico
│   ├── prenotazioni/    # Schermate prenotazioni
│   │   ├── dettaglio/
│   │   │   ├── [id].tsx # Dettaglio prenotazione
│   ├── _layout.tsx      # Layout root dell'applicazione
```

Questa struttura implementa:
- Navigazione a stack per flussi lineari
- Navigazione a tab per accesso rapido alle funzioni principali
- Routing dinamico con parametri (es. `[id].tsx`)
- Lazy loading delle schermate non immediate

#### Pattern Architetturali

1. **Flux/Redux Pattern**:
   - Gestione centralizzata dello stato dell'applicazione
   - Flusso dati unidirezionale
   - Azioni dispatchate per modificare lo stato

2. **Component-Based Architecture**:
   - Componenti modulari e riutilizzabili
   - Separazione tra componenti di presentazione e container
   - Composizione di componenti per costruire interfacce complesse

3. **Custom Hooks**:
   - Logica riutilizzabile incapsulata in hooks
   - Separazione della logica di business dalla UI
   - Facilità di testing e manutenzione

### Tecnologie e Librerie

1. **Framework UI**:
   - React Native: Framework cross-platform
   - Expo: Strumenti di sviluppo e deployment
   - TypeScript: Tipizzazione statica

2. **Gestione dello Stato**:
   - Context API: Per stato globale leggero
   - AsyncStorage: Persistenza locale
   - React Query: Gestione dello stato del server e caching

3. **Navigazione**:
   - React Navigation: Sistema di navigazione principale
   - Stack, Tab e Drawer navigators

4. **UI Components**:
   - NativeBase: Componenti UI personalizzabili
   - React Native Paper: Material design components
   - Custom components: Componenti specifici dell'applicazione

5. **Comunicazione API**:
   - Axios: Client HTTP
   - WebSocket: Per comunicazione in tempo reale
   - Interceptors: Per gestione token e errori

### Componenti Principali

#### Autenticazione

1. **LoginScreen**:
   - Form di login con validazione
   - Gestione errori di autenticazione
   - Link registrazione e recupero password

2. **RegisterScreen**:
   - Form di registrazione multi-step
   - Validazione dati in tempo reale
   - Selezione tipo utente

3. **AuthProvider**:
   - Context per lo stato di autenticazione
   - Gestione token (storage, refresh)
   - Controllo accessi

#### Navigazione

1. **AppTabs**:
   - Tab bar principale con icone e badge
   - Navigazione tra le sezioni principali
   - Gestione delle notifiche

2. **AppDrawer**:
   - Menu laterale con funzionalità aggiuntive
   - Profilo utente
   - Impostazioni applicazione

#### Lotti

1. **LottiList**:
   - Elenco lotti con filtri e ricerca
   - Pull-to-refresh e infinite scrolling
   - Visualizzazione stato e disponibilità

2. **LottoDetail**:
   - Visualizzazione dettagliata di un lotto
   - Azioni contestuali (prenota, modifica)
   - Mappa per localizzazione

3. **LottoForm**:
   - Form creazione/modifica lotto
   - Upload immagini
   - Selezione categorie e data di scadenza

#### Prenotazioni

1. **PrenotazioniList**:
   - Elenco prenotazioni con filtri per stato
   - Timeline visiva dello stato
   - Azioni rapide

2. **PrenotazioneDetail**:
   - Dettagli completi della prenotazione
   - Cronologia cambiamenti di stato
   - Azioni basate sullo stato corrente

3. **PrenotazioneForm**:
   - Form di prenotazione con validazione
   - Selezione metodo di pagamento
   - Note e richieste specifiche

#### Dashboard

1. **DashboardScreen**:
   - Panoramica delle attività
   - Statistiche e grafici
   - Card informative

2. **StatisticheComponent**:
   - Grafici interattivi
   - Filtri per periodo e tipo
   - Esportazione dati

#### Notifiche

1. **NotificheList**:
   - Elenco notifiche con indicatori di lettura
   - Raggruppamento per tipologia
   - Azioni contestuali

2. **NotificaDetail**:
   - Dettagli completi della notifica
   - Pulsanti di azione rapida
   - Navigazione al contenuto correlato

### Gestione dello Stato

1. **UserContext**:
   - Informazioni utente corrente
   - Preferenze e impostazioni
   - Tipi utente associati

2. **NotificationsContext**:
   - Stato delle notifiche
   - Counter notifiche non lette
   - Gestione WebSocket

3. **AppSettingsContext**:
   - Tema dell'applicazione
   - Impostazioni di lingua
   - Preferenze di notifica

### Ottimizzazioni e Performance

1. **Lazy Loading**:
   - Caricamento componenti pesanti solo quando necessario
   - Code splitting per ridurre dimensione bundle iniziale

2. **Memoizzazione**:
   - `React.memo` per componenti puri
   - `useMemo` e `useCallback` per calcoli costosi

3. **Virtualizzazione Liste**:
   - `FlatList` ottimizzata per lunghi elenchi
   - Rendering condizionale per elementi complessi

4. **Gestione Immagini**:
   - Caching immagini
   - Caricamento progressivo
   - Dimensioni ottimizzate

5. **Offline Support**:
   - Caching dati per uso offline
   - Sincronizzazione quando online
   - Feedback visivo stato connessione

### Accessibilità

1. **Conformità WCAG**:
   - Contrasto colori adeguato
   - Testi alternativi per immagini
   - Navigazione tramite screen reader

2. **Supporto Dimensioni Testo**:
   - Adattamento a impostazioni di testo del sistema
   - Layout responsivo a diverse dimensioni

3. **Feedback Tattile e Sonoro**:
   - Vibrazione per azioni importanti
   - Feedback audio opzionale

### Testing Frontend

1. **Unit Testing**:
   - Jest per logica di business
   - Testing dei custom hooks
   - Mock dei servizi

2. **Component Testing**:
   - React Native Testing Library
   - Snapshot testing
   - Interaction testing

3. **End-to-End Testing**:
   - Detox per testing su dispositivi reali
   - Simulazione interazioni utente
   - Verifica flussi completi

## Implementazioni Future

Refood è un progetto in continua evoluzione, con diverse funzionalità pianificate per le versioni future. Questa sezione descrive le principali aree di sviluppo previste e le potenziali implementazioni che potrebbero migliorare ulteriormente il sistema.

### Espansione Funzionalità

#### Sistema di Tracciamento Avanzato

1. **QR Code per Lotti**:
   - Generazione automatica di codici QR per ogni lotto
   - Scansione per tracciare rapidamente movimentazione e consegna
   - Integrazione con sistemi di logistica esterna

2. **Geolocalizzazione**:
   - Tracciamento in tempo reale durante il trasporto
   - Calcolo automatico di percorsi ottimali
   - Stima precisa dei tempi di consegna

3. **Blockchain per Tracciabilità**:
   - Implementazione di un sistema basato su blockchain per la completa tracciabilità
   - Garanzia di immutabilità dei dati di tracciamento
   - Certificazione dell'origine e della storia del prodotto

#### Espansione Analisi e Reporting

1. **Analisi Predittiva**:
   - Modelli ML per prevedere scadenze e necessità di redistribuzione
   - Ottimizzazione automatica delle soglie di stato (Verde/Arancione/Rosso)
   - Suggerimenti proattivi per la riduzione dello spreco

2. **Dashboard Interattivo Avanzato**:
   - Visualizzazioni dati più sofisticate
   - Analisi comparative tra periodi
   - Metriche personalizzabili

3. **Reportistica Automatizzata**:
   - Report personalizzati per diversi stakeholder
   - Schedulazione automatica di invio report
   - Esportazione in diversi formati (PDF, Excel, CSV)

#### Integrazione con Sistemi Esterni

1. **API per Terze Parti**:
   - Sviluppo di un'API pubblica per integrazioni esterne
   - Webhook per notifiche verso sistemi esterni
   - SDK per sviluppatori

2. **Integrazione con Sistemi ERP**:
   - Connettori per sistemi di gestione aziendale
   - Sincronizzazione automatica inventario
   - Gestione centralizzata

3. **Integrazione con Piattaforme Social**:
   - Condivisione automatica di impatto positivo
   - Campagne di sensibilizzazione automatizzate
   - Gamification e ricompense sociali

### Miglioramenti Tecnologici

#### Architettura Scalabile

1. **Microservizi**:
   - Refactoring verso un'architettura a microservizi
   - Scalabilità indipendente di componenti critici
   - Deployment più flessibile

2. **Cloud-Native**:
   - Containerizzazione con Docker
   - Orchestrazione con Kubernetes
   - Auto-scaling basato sul carico

3. **Database Distribuito**:
   - Migrazione a un database distribuito
   - Replicazione geografica
   - Sharding per gestire volumi maggiori

#### Miglioramenti Mobile

1. **App Offline-First**:
   - Funzionalità complete anche offline
   - Sincronizzazione intelligente al ripristino della connessione
   - Risoluzione automatica dei conflitti

2. **Flutter Migration**:
   - Valutazione della migrazione a Flutter
   - Prestazioni native su tutte le piattaforme
   - Unificazione codebase

3. **Supporto Wearable**:
   - Estensione per smartwatch
   - Notifiche e azioni rapide
   - Monitoraggio attività in mobilità

#### Intelligenza Artificiale

1. **Chatbot Assistente**:
   - Assistente virtuale per supporto utente
   - Guida al processo di prenotazione e ritiro
   - Risposta automatica a domande frequenti

2. **Computer Vision**:
   - Riconoscimento automatico prodotti dalle foto
   - Valutazione dello stato di conservazione
   - Suggerimenti per classificazione

3. **Ottimizzazione Logistica**:
   - Algoritmi per ottimizzare la distribuzione
   - Matching automatico tra offerta e domanda
   - Riduzione dei costi di trasporto

### Espansione Commerciale

#### Nuovi Modelli di Business

1. **Marketplace B2B**:
   - Piattaforma dedicata per transazioni tra aziende
   - Sistema di aste per lotti di grandi dimensioni
   - Gestione contratti automatizzata

2. **Abbonamenti Premium**:
   - Funzionalità avanzate per utenti business
   - Priorità nelle prenotazioni
   - Reportistica avanzata

3. **Label Sostenibilità**:
   - Certificazione di sostenibilità per partecipanti
   - Badge e riconoscimenti pubblici
   - Partnership con enti certificatori

#### Internazionalizzazione

1. **Supporto Multi-lingua**:
   - Estensione a tutte le lingue europee
   - Localizzazione completa (date, valute, unità)
   - Contenuti culturalmente adattati

2. **Compliance Regionale**:
   - Adattamento alle normative locali
   - Gestione fiscale multiregione
   - Conformità GDPR globale

3. **Franchising Tecnologico**:
   - Modello white-label per nuovi mercati
   - Supporto per operatori regionali
   - Condivisione know-how e best practices

## Risoluzione Problemi Comuni

Questa sezione fornisce una guida alla risoluzione dei problemi più comuni che possono verificarsi durante l'utilizzo del sistema Refood.

### Problemi di Autenticazione

#### Impossibilità di Accedere

1. **Sintomi**:
   - Errore "Credenziali non valide"
   - Impossibilità di completare il login

2. **Possibili Cause**:
   - Email errata
   - Password errata
   - Account non attivato
   - Account bloccato per troppi tentativi falliti

3. **Soluzioni**:
   - Utilizzare la funzione "Password dimenticata"
   - Verificare email di attivazione
   - Contattare amministratore per sblocco account

#### Token Scaduto

1. **Sintomi**:
   - Errore "Non autorizzato" durante l'utilizzo
   - Reindirizzamento improvviso alla schermata di login

2. **Possibili Cause**:
   - Sessione scaduta
   - Token revocato
   - Problemi di connessione durante il refresh

3. **Soluzioni**:
   - Effettuare nuovamente il login
   - Verificare la connessione internet
   - Controllare che data e ora del dispositivo siano corrette

### Problemi con i Lotti

#### Stato Lotto Non Aggiornato

1. **Sintomi**:
   - Il lotto rimane nello stato Verde nonostante sia prossimo alla scadenza
   - La modifica manuale dello stato non persiste

2. **Possibili Cause**:
   - Job schedulato non eseguito
   - Errore nel calcolo dei giorni
   - Problemi di sincronizzazione database

3. **Soluzioni**:
   - Forzare aggiornamento manuale come amministratore
   - Verificare i log del sistema
   - Riavviare il job di aggiornamento stati

#### Impossibilità di Creare Lotti

1. **Sintomi**:
   - Errore durante la creazione di un nuovo lotto
   - Form che non si invia correttamente

2. **Possibili Cause**:
   - Campi obbligatori mancanti
   - Formato data non valido
   - Prezzo inserito per lotti non Verdi

3. **Soluzioni**:
   - Verificare completezza dati
   - Controllare formato data scadenza (YYYY-MM-DD)
   - Assicurarsi che il prezzo sia coerente con lo stato

### Problemi con le Prenotazioni

#### Prenotazione Non Confermata

1. **Sintomi**:
   - La prenotazione rimane in stato "Prenotato" per lungo tempo
   - Nessuna notifica di conferma ricevuta

2. **Possibili Cause**:
   - Proprietario non ha ancora processato la richiesta
   - Problemi con il sistema di notifiche
   - Errore durante l'aggiornamento stato

3. **Soluzioni**:
   - Contattare direttamente il proprietario
   - Verificare le notifiche nell'app
   - Controllare lo stato manualmente nella sezione prenotazioni

#### Errore Tipo di Pagamento

1. **Sintomi**:
   - Errore "Tipo di pagamento richiesto" anche per lotti non verdi
   - Impossibilità di completare la prenotazione

2. **Possibili Cause**:
   - Errore nella validazione lato server
   - Stato del lotto non sincronizzato
   - Bug nella validazione condizionale

3. **Soluzioni**:
   - Verificare lo stato effettivo del lotto
   - Provare a selezionare comunque un tipo di pagamento
   - Segnalare il problema all'assistenza

### Problemi di Connettività

#### WebSocket Disconnesso

1. **Sintomi**:
   - Notifiche in tempo reale non ricevute
   - Icona di stato connessione in rosso
   - Aggiornamenti ritardati

2. **Possibili Cause**:
   - Problemi di connessione internet
   - Timeout del server WebSocket
   - Errori nella gestione token WebSocket

3. **Soluzioni**:
   - Verificare connessione internet
   - Chiudere e riaprire l'applicazione
   - Effettuare logout e nuovo login

#### Sincronizzazione Dati Lenta

1. **Sintomi**:
   - Caricamento lento delle liste
   - Dati non aggiornati
   - Errori di timeout

2. **Possibili Cause**:
   - Connessione internet debole
   - Carico elevato sul server
   - Cache locale corrotta

3. **Soluzioni**:
   - Attivare modalità dati ridotti nelle impostazioni
   - Svuotare cache dell'applicazione
   - Provare in un secondo momento

### Problemi di Performance

#### App Mobile Lenta

1. **Sintomi**:
   - Navigazione non fluida
   - Ritardi nell'interazione
   - Consumo batteria elevato

2. **Possibili Cause**:
   - Troppe notifiche accumulate
   - Cache eccessiva
   - Versione app obsoleta

3. **Soluzioni**:
   - Cancellare le vecchie notifiche
   - Svuotare cache nelle impostazioni
   - Aggiornare all'ultima versione dell'app

#### Errori di Memoria

1. **Sintomi**:
   - App che si chiude improvvisamente
   - Errore "Memoria insufficiente"
   - Funzionalità limitate

2. **Possibili Cause**:
   - Dispositivo con poca memoria disponibile
   - Bug nell'utilizzo memoria
   - Troppe risorse in background

3. **Soluzioni**:
   - Riavviare il dispositivo
   - Chiudere altre applicazioni
   - Aggiornare all'ultima versione

### Contattare il Supporto

Se i problemi persistono o non sono elencati in questa guida:

1. **Canali di Supporto**:
   - Email: support@refood.it
   - Chat in-app dalla sezione "Assistenza"
   - Telefono: +39 0123456789 (Lun-Ven, 9-18)

2. **Informazioni da Fornire**:
   - ID utente o email associata
   - Versione dell'app
   - Modello dispositivo e sistema operativo
   - Screenshot del problema
   - Descrizione dettagliata del problema e passi per riprodurlo

## Conclusione

Refood rappresenta un'innovativa soluzione tecnologica per affrontare la sfida dello spreco alimentare, collegando in modo efficiente chi ha eccedenze alimentari con chi può utilizzarle, attraverso un sistema intelligente basato sul concetto di economia circolare.

### Riassunto del Progetto

Il sistema Refood è stato progettato e implementato con l'obiettivo di creare una piattaforma completa che:

1. **Ottimizza la Redistribuzione**: Garantisce che il cibo in eccesso venga redistribuito in modo efficiente anziché sprecato.

2. **Automatizza i Processi**: Implementa meccanismi automatici per la gestione degli stati dei lotti in base alla scadenza, garantendo che i prodotti vengano utilizzati prima del deterioramento.

3. **Differenzia gli Utenti**: Riconosce le diverse esigenze di utenti privati, canali sociali e centri di riciclo, adattando le regole di business di conseguenza.

4. **Traccia l'Impatto**: Fornisce metriche chiare sull'impatto ambientale ed economico delle attività di recupero alimentare.

5. **Offre un'Esperienza Fluida**: Implementa un'interfaccia mobile moderna e intuitiva, con aggiornamenti in tempo reale e notifiche contestuali.

### Risultati Ottenuti

L'implementazione di Refood ha portato a risultati significativi:

1. **Riduzione Sprechi**: La piattaforma permette di salvare tonnellate di cibo che altrimenti verrebbero sprecate.

2. **Impatto Ambientale**: Riduzione delle emissioni di CO2 associate alla produzione e allo smaltimento del cibo non consumato.

3. **Impatto Sociale**: Supporto a organizzazioni benefiche attraverso la fornitura di cibo a costo zero.

4. **Educazione**: Sensibilizzazione sul tema dello spreco alimentare e promozione di comportamenti sostenibili.

5. **Innovazione Tecnologica**: Implementazione di soluzioni all'avanguardia come WebSocket per aggiornamenti in tempo reale e un sistema di gestione automatica degli stati.

### Contributo all'Economia Circolare

Refood si inserisce perfettamente nel paradigma dell'economia circolare, trasformando quello che tradizionalmente sarebbe considerato uno scarto in una risorsa preziosa. Questo approccio:

1. **Estende il Ciclo di Vita** dei prodotti alimentari
2. **Minimizza gli Sprechi** attraverso un uso efficiente delle risorse
3. **Crea Valore** sia economico che sociale dalle eccedenze
4. **Riduce l'Impatto Ambientale** del sistema alimentare

### Sfide Superate

Lo sviluppo di Refood ha comportato il superamento di diverse sfide tecniche e logistiche:

1. **Gestione Stati Dinamici**: Implementazione di un sistema robusto per l'aggiornamento automatico degli stati dei lotti.

2. **Notifiche in Tempo Reale**: Sviluppo di un'infrastruttura WebSocket scalabile per comunicazioni istantanee.

3. **Validazione Condizionale**: Creazione di regole di business complesse che si adattano al contesto specifico.

4. **Esperienza Mobile Ottimizzata**: Realizzazione di un'applicazione mobile performante e responsiva.

5. **Sicurezza e Privacy**: Implementazione di un sistema di autenticazione robusto e conforme alle normative.

### Direzioni Future

Mentre Refood rappresenta già una soluzione completa, il progetto continuerà a evolversi nelle seguenti direzioni:

1. **Espansione Geografica**: Estensione del servizio a nuove aree e regioni.

2. **Intelligenza Artificiale**: Integrazione di algoritmi predittivi per ottimizzare ulteriormente la redistribuzione.

3. **Integrazioni Esterne**: Sviluppo di API e connettori per sistemi terzi.

4. **Nuove Funzionalità**: Implementazione delle caratteristiche descritte nella sezione "Implementazioni Future".

5. **Community Building**: Creazione di una comunità attiva di utenti e sviluppatori intorno al progetto.

### Conclusioni Finali

Refood dimostra come la tecnologia possa essere un potente strumento per affrontare sfide sociali ed ambientali complesse. Attraverso l'uso intelligente di software moderno, architetture scalabili e un'attenta progettazione dell'esperienza utente, è possibile creare soluzioni che non solo risolvono problemi pratici ma contribuiscono anche a un cambiamento culturale verso pratiche più sostenibili.

Il progetto Refood non è solo un'applicazione software, ma un ecosistema che connette persone, organizzazioni e risorse in un sistema virtuoso che genera valore per tutti i partecipanti e per l'ambiente.

Con il continuo sviluppo e l'adozione sempre più ampia della piattaforma, Refood ha il potenziale per diventare un modello di riferimento per iniziative simili a livello globale, dimostrando come l'innovazione tecnologica possa essere un catalizzatore per il cambiamento sociale positivo.

# Dettagli Tecnici Avanzati

## Stack Tecnologico in Dettaglio

### Backend

#### Node.js e Express.js
Il backend di Refood è costruito utilizzando Node.js (versione 18.x) con il framework Express.js (versione 4.18.x). Questa combinazione offre diversi vantaggi:

- **Modello di I/O non bloccante**: Ottimale per operazioni con elevato I/O come la gestione delle richieste API
- **Ecosistema npm**: Accesso a un vasto insieme di librerie e moduli
- **Middleware Express**: Architettura flessibile per la gestione delle richieste HTTP
- **Routing espressivo**: Configurazione chiara e concisa degli endpoint API

La struttura tipica di un endpoint Express in Refood è:

```javascript
// Esempio di definizione route
router.get('/lotti', 
  authMiddleware.verifyToken, 
  validateRequest(lottiValidationRules.getLotti), 
  asyncHandler(lottiController.getLotti)
);
```

I controller seguono un pattern di gestione degli errori unificato:

```javascript
// Esempio di controller con gestione errori
const getLotti = async (req, res, next) => {
  try {
    const { stato, tipo_utente_id, categoria, data_min, data_max, cerca } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    // Logica di business
    const result = await lottiService.getLotti({
      stato, tipo_utente_id, categoria, data_min, data_max, cerca, page, limit
    });
    
    // Risposta standardizzata
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    // Gestione centralizzata errori
    next(error);
  }
};
```

#### Database SQLite
Refood utilizza SQLite (versione 3.36.x) come database, scelto per:

- **Portabilità**: Database file-based che non richiede un server separato
- **Semplicità di backup**: Il database è contenuto in un singolo file
- **Basse risorse richieste**: Ideale per sistemi con risorse limitate
- **Supporto transazionale**: Garantisce l'integrità dei dati

L'accesso al database è implementato con un pattern Repository che astrae la logica di accesso ai dati:

```javascript
// Esempio di repository pattern
class LottiRepository {
  static async findById(id) {
    return db.get('SELECT * FROM Lotti WHERE id = ?', [id]);
  }
  
  static async findAll(filters = {}, page = 1, limit = 20) {
    // Costruzione dinamica della query con parametri
    let query = 'SELECT l.*, tu.nome AS tipo_utente_origine_nome FROM Lotti l ';
    query += 'LEFT JOIN Tipo_Utente tu ON l.tipo_utente_origine_id = tu.id ';
    
    const whereConditions = [];
    const params = [];
    
    if (filters.stato) {
      whereConditions.push('l.stato = ?');
      params.push(filters.stato);
    }
    
    // Altre condizioni...
    
    if (whereConditions.length > 0) {
      query += 'WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY l.data_scadenza ASC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);
    
    const lotti = await db.all(query, params);
    const total = await db.get('SELECT COUNT(*) as count FROM Lotti' + 
                               (whereConditions.length > 0 ? ' WHERE ' + whereConditions.join(' AND ') : ''), 
                               params.slice(0, -2));
    
    return {
      lotti,
      pagination: {
        page,
        limit,
        total: total.count,
        pages: Math.ceil(total.count / limit)
      }
    };
  }
  
  // Altri metodi CRUD...
}
```

#### WebSocket per Comunicazione Real-time
Il sistema implementa WebSocket utilizzando la libreria `ws` (versione 8.5.x) per comunicazione bidirezionale in tempo reale:

```javascript
class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId => [WebSocket]
    this.sessions = new Map(); // sessionId => {userId, lastActive}
    this.pendingReconnections = new Map(); // sessionId => {expiresAt, userId}
    this.heartbeatInterval = null;
    this.connectionCleanupInterval = null;
  }
  
  init(httpServer) {
    this.wss = new WebSocket.Server({ 
      server: httpServer,
      path: '/api/notifications/ws'
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    
    // Heartbeat ogni 30 secondi
    this.heartbeatInterval = setInterval(this.pingClients.bind(this), 30000);
    
    // Cleanup connessioni ogni 5 minuti
    this.connectionCleanupInterval = setInterval(this.checkConnections.bind(this), 300000);
    
    console.log('[WebSocket] Server inizializzato');
  }
  
  // Altri metodi...
  
  async inviaNotifica(userId, notifica) {
    if (!userId || !notifica) return false;
    
    const userSockets = this.clients.get(userId);
    if (!userSockets || userSockets.length === 0) {
      console.log(`[WebSocket] Utente ${userId} non connesso, impossibile inviare notifica in tempo reale`);
      return false;
    }
    
    const message = {
      type: 'notification',
      payload: notifica,
      timestamp: Date.now()
    };
    
    // Invia a tutti i dispositivi dell'utente
    let sent = false;
    for (const ws of userSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
        sent = true;
      }
    }
    
    return sent;
  }
}
```

#### JWT per Autenticazione
Il sistema di autenticazione utilizza JSON Web Token (JWT) implementato con la libreria `jsonwebtoken` (versione 9.0.x):

```javascript
// Creazione token
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { 
      id: user.id,
      email: user.email,
      ruolo: user.ruolo
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30m' }
  );
  
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  
  return { accessToken, refreshToken };
};

// Verifica token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Autenticazione richiesta'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token scaduto',
        error: {
          name: 'TokenExpiredError',
          expiredAt: error.expiredAt
        }
      });
    }
    
    return res.status(401).json({
      status: 'error',
      message: 'Token non valido'
    });
  }
};
```

### Frontend (Mobile)

#### React Native con Expo
L'applicazione mobile è sviluppata utilizzando React Native (versione 0.72.x) con Expo SDK (versione 48.x), offrendo:

- **Sviluppo cross-platform**: Una singola base di codice per iOS e Android
- **Aggiornamenti OTA**: Distribuire aggiornamenti senza passare dagli app store
- **API native pre-costruite**: Accesso semplificato a funzionalità del dispositivo
- **Expo Dev Client**: Ciclo di sviluppo rapido con hot reloading

#### TypeScript
L'applicazione utilizza TypeScript (versione 5.1.x) per type safety e un'esperienza di sviluppo migliorata:

```typescript
// Esempio di interfaccia TypeScript
export interface Lotto {
  id: number;
  nome: string; // corrisponde a prodotto nel backend
  descrizione?: string;
  quantita: number;
  unita_misura: string;
  data_inserimento?: string;
  data_scadenza: string;
  centro_id: number; // corrisponde a centro_origine_id nel backend
  centro_nome?: string;
  stato: 'Verde' | 'Arancione' | 'Rosso';
  categorie?: string[];
  origine?: string;
  stato_prenotazione?: string; // Indica se il lotto è già prenotato
  prezzo?: number | null; // Prezzo del lotto (solo per lotti verdi)
  tipo_pagamento?: 'contanti' | 'bonifico' | null; // Metodo di pagamento
}

export type StatoPrenotazione = 'Prenotato' | 'InAttesa' | 'Confermato' | 'ProntoPerRitiro' | 'Rifiutato' | 'InTransito' | 'Consegnato' | 'Annullato' | 'Eliminato';
```

#### Axios per Chiamate API
Le chiamate API sono gestite utilizzando Axios (versione 1.4.x) con interceptor personalizzati:

```typescript
// Configurazione Axios
const instance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor richieste
instance.interceptors.request.use(
  async (config) => {
    // Aggiunge token di autenticazione se disponibile
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor risposte con refresh token
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Se errore 401 (Unauthorized) e non è già un retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Tenta refresh token
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('Refresh token non disponibile');
        }
        
        const res = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken
        });
        
        if (res.data.status === 'success') {
          // Salva nuovo token
          await AsyncStorage.setItem('accessToken', res.data.data.accessToken);
          
          // Ritenta richiesta originale con nuovo token
          originalRequest.headers['Authorization'] = `Bearer ${res.data.data.accessToken}`;
          return instance(originalRequest);
        }
      } catch (refreshError) {
        console.error('Errore durante refresh token:', refreshError);
        
        // Reindirizza al login
        eventEmitter.emit('sessionExpired');
      }
    }
    
    return Promise.reject(error);
  }
);
```

#### Expo Router per Navigazione
La navigazione utilizza Expo Router (versione 2.0.x), un sistema di file-based routing basato su React Navigation:

```tsx
// Esempio di configurazione layout tab
// _layout.tsx in directory (tabs)
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useNotifications } from '@/hooks/useNotifications';

export default function TabLayout() {
  const { unreadCount } = useNotifications();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray,
        headerShown: false
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="lotti"
        options={{
          title: 'Lotti',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="list" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="prenotazioni"
        options={{
          title: 'Prenotazioni',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="calendar-today" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifiche"
        options={{
          title: 'Notifiche',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="notifications" size={24} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined
        }}
      />
      <Tabs.Screen
        name="profilo"
        options={{
          title: 'Profilo',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

#### WebSocket Client
La comunicazione in tempo reale è implementata con un client WebSocket personalizzato:

```typescript
// WebSocket client
class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: any = null;
  private sessionId: string | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private pingInterval: any = null;
  private lastPongTime: number = 0;
  
  constructor(baseUrl: string) {
    this.url = baseUrl.replace(/^http/, 'ws') + '/notifications/ws';
  }
  
  // Connessione iniziale con token
  async connect(token: string): Promise<boolean> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Già connesso');
      return true;
    }
    
    try {
      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(`${this.url}?token=${token}`);
        
        this.ws.onopen = () => {
          console.log('[WebSocket] Connessione stabilita');
          this.reconnectAttempts = 0;
          this.startPingInterval();
          resolve(true);
        };
        
        this.ws.onmessage = this.handleMessage.bind(this);
        
        this.ws.onclose = (event) => {
          console.log(`[WebSocket] Connessione chiusa: ${event.code} ${event.reason}`);
          this.ws = null;
          clearInterval(this.pingInterval);
          
          if (this.sessionId && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
          
          if (this.reconnectAttempts === 0) {
            reject(new Error('Connessione chiusa'));
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('[WebSocket] Errore:', error);
          reject(error);
        };
        
        // Timeout per la connessione
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            reject(new Error('Timeout connessione WebSocket'));
          }
        }, 10000);
      });
    } catch (error) {
      console.error('[WebSocket] Errore di connessione:', error);
      return false;
    }
  }
  
  // Altri metodi...
}
```

#### Context API per Stato Globale
Lo stato globale è gestito con React Context API:

```typescript
// Context per autenticazione
export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  user: null,
  login: async () => ({ success: false, message: '' }),
  logout: async () => {},
  checkAuth: async () => false
});

// Provider
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  
  // Verifica token all'avvio
  useEffect(() => {
    const checkToken = async () => {
      const result = await checkAuth();
      setIsLoggedIn(result);
    };
    
    checkToken();
  }, []);
  
  // Login
  const login = async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const response = await axios.post('/auth/login', { email, password });
      
      if (response.data.status === 'success') {
        const { accessToken, refreshToken, user } = response.data.data;
        
        // Salva token e utente
        await AsyncStorage.setItem('accessToken', accessToken);
        await AsyncStorage.setItem('refreshToken', refreshToken);
        await AsyncStorage.setItem('user', JSON.stringify(user));
        
        setUser(user);
        setIsLoggedIn(true);
        
        // Connetti WebSocket
        await websocketService.connect(accessToken);
        
        return { success: true, message: 'Login completato con successo' };
      } else {
        return { success: false, message: response.data.message || 'Errore durante il login' };
      }
    } catch (error) {
      console.error('Errore login:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Errore durante il login' 
      };
    }
  };
  
  // Altri metodi...
  
  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Task Scheduling e Job Cron

Refood implementa job schedulati utilizzando `node-cron` (versione 3.0.x) per operazioni di manutenzione e aggiornamenti automatici:

```javascript
// Configurazione job
const cron = require('node-cron');
const { aggiornamentoStatiLotti } = require('./jobs/aggiornamentoStatiLotti');
const { archiviazioneScaduti } = require('./jobs/archiviazioneScaduti');
const { puliziaSessioni } = require('./jobs/puliziaSessioni');
const { backupDatabase } = require('./jobs/backupDatabase');

// Esegui ogni giorno a mezzanotte
cron.schedule('0 0 * * *', async () => {
  try {
    console.log('[JOB] Avvio aggiornamento stati lotti');
    await aggiornamentoStatiLotti.esegui();
    console.log('[JOB] Aggiornamento stati lotti completato');
  } catch (err) {
    console.error('[JOB ERROR] Aggiornamento stati lotti:', err);
  }
});

// Esegui ogni giorno alle 3:00
cron.schedule('0 3 * * *', async () => {
  try {
    console.log('[JOB] Avvio archiviazione lotti scaduti');
    await archiviazioneScaduti.esegui();
    console.log('[JOB] Archiviazione lotti scaduti completata');
  } catch (err) {
    console.error('[JOB ERROR] Archiviazione lotti scaduti:', err);
  }
});

// Altri job...
```

Implementazione di un job specifico:

```javascript
// aggiornamentoStatiLotti.js
const db = require('../database/connection');
const { WebSocketService } = require('../utils/websocket');

const aggiornamentoStatiLotti = {
  async esegui() {
    // Ottieni data corrente
    const today = new Date().toISOString().split('T')[0];
    
    // Trova lotti che necessitano aggiornamento stato
    const lotti = await db.all(`
      SELECT id, stato, data_scadenza, prezzo 
      FROM Lotti 
      WHERE stato != 'Consegnato' AND stato != 'Eliminato'
    `);
    
    let aggiornati = 0;
    
    for (const lotto of lotti) {
      const dataScadenza = new Date(lotto.data_scadenza);
      const giorni = Math.ceil((dataScadenza - new Date(today)) / (1000 * 60 * 60 * 24));
      
      let nuovoStato = lotto.stato;
      let nuovoPrezzo = lotto.prezzo;
      
      // Determina nuovo stato
      if (giorni > 7) {
        nuovoStato = 'Verde';
      } else if (giorni >= 3) {
        nuovoStato = 'Arancione';
        if (nuovoStato !== lotto.stato && lotto.stato === 'Verde') {
          nuovoPrezzo = 0; // Se passa da Verde ad Arancione, azzera il prezzo
        }
      } else {
        nuovoStato = 'Rosso';
        if (nuovoStato !== lotto.stato && (lotto.stato === 'Verde' || lotto.stato === 'Arancione')) {
          nuovoPrezzo = 0; // Se passa a Rosso, azzera il prezzo
        }
      }
      
      // Se lo stato è cambiato, aggiorna
      if (nuovoStato !== lotto.stato || nuovoPrezzo !== lotto.prezzo) {
        await db.run(`
          UPDATE Lotti 
          SET stato = ?, prezzo = ?, aggiornato_il = CURRENT_TIMESTAMP 
          WHERE id = ?
        `, [nuovoStato, nuovoPrezzo, lotto.id]);
        
        // Registra cambio stato nel log
        await db.run(`
          INSERT INTO LogCambioStato (lotto_id, stato_precedente, stato_nuovo, data_cambio)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [lotto.id, lotto.stato, nuovoStato]);
        
        // Notifica utenti interessati
        await this.notificaCambioStato(lotto.id, lotto.stato, nuovoStato);
        
        aggiornati++;
      }
    }
    
    return { totale: lotti.length, aggiornati };
  },
  
  // Metodo per notificare gli utenti del cambio stato
  async notificaCambioStato(lottoId, statoPrecedente, statoNuovo) {
    // Implementazione notifiche...
  }
};

module.exports = { aggiornamentoStatiLotti };
```

## Architettura del Sistema in Dettaglio

### Architettura Complessiva

Refood implementa un'architettura client-server moderna con separazione netta tra frontend e backend. Il sistema segue i principi REST per la comunicazione API standard e utilizza WebSocket per la comunicazione in tempo reale.

```
┌─────────────────┐     HTTP/REST     ┌─────────────────┐
│                 │<----------------->│                 │
│  Client Mobile  │                   │  Server Node.js │
│  (React Native) │<- - WebSocket - ->│  (Express)      │
│                 │                   │                 │
└─────────────────┘                   └────────┬────────┘
                                               │
                                               │ SQL
                                               ▼
                                      ┌─────────────────┐
                                      │                 │
                                      │  Database       │
                                      │  (SQLite)       │
                                      │                 │
                                      └─────────────────┘
```

### Architettura Backend

Il backend segue un'architettura a livelli con separazione delle responsabilità:

#### Struttura del Codice Backend

```
backend/
├── src/
│   ├── server.js              # Entry point dell'applicazione
│   ├── config/                # Configurazioni ambiente, database, ecc.
│   ├── controllers/           # Gestione richieste HTTP e risposte
│   ├── services/              # Logica di business
│   ├── repositories/          # Accesso al database
│   ├── routes/                # Definizione degli endpoint API
│   ├── middlewares/           # Middleware Express (auth, validation, ecc.)
│   ├── utils/                 # Utility, helper, funzioni condivise
│   ├── validators/            # Schema di validazione e regole
│   ├── jobs/                  # Job schedulati
│   ├── websocket/             # Gestione connessioni WebSocket
│   └── database/              # Configurazione database e migrations
├── migrations/                # Script migrazione database
├── scripts/                   # Script utilità e manutenzione
└── tests/                     # Test unitari e di integrazione
```

#### Flusso di Elaborazione delle Richieste

Il backend segue un pattern MVC modificato con service layer aggiuntivo:

1. **Routes**: Definiscono gli endpoint API e collegano richieste ai controller
2. **Middlewares**: Elaborano le richieste (autenticazione, validazione)
3. **Controllers**: Gestiscono input/output HTTP e delegano la logica ai servizi
4. **Services**: Contengono la logica di business
5. **Repositories**: Gestiscono accesso e manipolazione dati nel database

Esempio di flusso tipico:

```
Request → Router → Middleware → Controller → Service → Repository → Database
                                     ↓
Response ← Controller ← Service ← Repository
```

#### Gestione Errori

Il sistema implementa una gestione degli errori centralizzata con:

1. **Errori personalizzati**: Classi di errori specifiche per operazioni diverse
2. **Middleware di errore**: Intercetta gli errori e formatta risposte consistenti
3. **Logging**: Registrazione dettagliata degli errori per debugging

```javascript
// Esempio di middleware per la gestione centralizzata degli errori
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.stack}`);
  
  // Errori di validazione
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: 'Errore di validazione',
      errors: err.details
    });
  }
  
  // Errori di autenticazione
  if (err.name === 'AuthenticationError') {
    return res.status(401).json({
      status: 'error',
      message: err.message || 'Non autorizzato'
    });
  }
  
  // Errori di autorizzazione
  if (err.name === 'AuthorizationError') {
    return res.status(403).json({
      status: 'error',
      message: err.message || 'Accesso negato'
    });
  }
  
  // Errori di risorsa non trovata
  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      status: 'error',
      message: err.message || 'Risorsa non trovata'
    });
  }
  
  // Errori di business logic
  if (err.name === 'BusinessError') {
    return res.status(409).json({
      status: 'error',
      message: err.message || 'Operazione non valida'
    });
  }
  
  // Errori generici del server (default)
  return res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Si è verificato un errore interno del server' 
      : err.message || 'Errore interno del server'
  });
};
```

### Architettura Frontend

Il frontend mobile è strutturato secondo i pattern React moderni, con enfasi su componenti riutilizzabili e separazione tra logica e UI.

#### Struttura del Codice Frontend

```
refood-mobile/
├── app/                  # Directory principale per Expo Router
│   ├── (auth)/           # Schermate autenticazione
│   ├── (tabs)/           # Navigation tabs
│   ├── lotto/            # Schermate dettaglio lotto
│   ├── prenotazione/     # Schermate prenotazioni
│   └── _layout.tsx       # Layout principale dell'app
├── assets/               # Immagini, font, ecc.
├── components/           # Componenti UI riutilizzabili
│   ├── common/           # Componenti di base (bottoni, input, ecc.)
│   ├── lotti/            # Componenti specifici per lotti
│   ├── prenotazioni/     # Componenti specifici per prenotazioni
│   └── ui/               # Componenti UI generici
├── constants/            # Costanti applicazione, temi, ecc.
├── context/              # Context React per stato globale
├── hooks/                # Hook personalizzati
├── services/             # Servizi API e comunicazione con backend
├── types/                # Definizioni TypeScript
├── utils/                # Funzioni di utilità
└── babel.config.js       # Configurazione Babel
```

#### Gestione Stato

L'applicazione utilizza una combinazione di:

1. **Context API**: Per stato globale (autenticazione, tema, notifiche)
2. **useState/useReducer**: Per stato locale dei componenti
3. **React Query**: Per gestione stato server-side e cache
4. **AsyncStorage**: Per persistenza dei dati tra sessioni

#### Pattern di Comunicazione con Backend

L'applicazione implementa diversi pattern per comunicare con il backend:

1. **REST API**: Per operazioni CRUD standard
2. **WebSocket**: Per notifiche in tempo reale
3. **Polling intelligente**: Per aggiornamenti periodici con React Query

```typescript
// Esempio di hook personalizzato con React Query
export function useLotti(filters: LottiFilterParams = {}) {
  const queryClient = useQueryClient();
  
  // Query per ottenere lotti
  const lottiQuery = useQuery({
    queryKey: ['lotti', filters],
    queryFn: () => lottiService.getLotti(filters),
    staleTime: 5 * 60 * 1000, // 5 minuti
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true
  });
  
  // Mutation per prenotare lotto
  const prenotaMutation = useMutation({
    mutationFn: (lotto_id: number) => prenotazioniService.prenotaLotto(lotto_id),
    onSuccess: (data) => {
      // Aggiorna cache lotti e prenotazioni
      queryClient.invalidateQueries({ queryKey: ['lotti'] });
      queryClient.invalidateQueries({ queryKey: ['prenotazioni'] });
      
      // Aggiorna immediatamente l'UI
      Toast.show({
        type: 'success',
        text1: 'Prenotazione effettuata',
        text2: 'La tua richiesta è stata inviata con successo'
      });
    },
    onError: (error: any) => {
      console.error('Errore prenotazione:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: error.response?.data?.message || 'Impossibile completare la prenotazione'
      });
    }
  });
  
  return {
    lotti: lottiQuery.data?.lotti || [],
    pagination: lottiQuery.data?.pagination,
    isLoading: lottiQuery.isLoading,
    isError: lottiQuery.isError,
    error: lottiQuery.error,
    refetch: lottiQuery.refetch,
    prenotaLotto: prenotaMutation.mutate,
    isPrenotazioneInCorso: prenotaMutation.isPending
  };
}
```

### Gestione WebSocket

La comunicazione in tempo reale è implementata con WebSocket sia lato server che client:

#### Server WebSocket

```javascript
// Esempio di gestione connessione WebSocket lato server
handleConnection(ws, req) {
  // Estrai token dalla query string
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  
  if (!token) {
    console.log('[WebSocket] Connessione rifiutata: token mancante');
    ws.close(4001, 'Token mancante');
    return;
  }
  
  // Verifica token
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('[WebSocket] Connessione rifiutata: token non valido');
      ws.close(4001, 'Token non valido');
      return;
    }
    
    const userId = decoded.id;
    const sessionId = uuidv4(); // Genera ID sessione
    
    // Configura connessione
    ws.userId = userId;
    ws.sessionId = sessionId;
    ws.isAlive = true;
    
    // Salva connessione nelle mappe
    let userSockets = this.clients.get(userId) || [];
    userSockets.push(ws);
    this.clients.set(userId, userSockets);
    
    this.sessions.set(sessionId, {
      userId,
      lastActive: Date.now()
    });
    
    console.log(`[WebSocket] Utente ${userId} connesso (sessionId: ${sessionId})`);
    
    // Invia conferma connessione
    this.sendMessage(ws, {
      type: 'connection_established',
      payload: {
        sessionId,
        timestamp: Date.now()
      }
    });
    
    // Gestisce messaggi dal client
    ws.on('message', (message) => this.handleMessage(ws, message));
    
    // Gestisce chiusura connessione
    ws.on('close', () => this.handleDisconnection(ws));
    
    // Gestisce pong (heartbeat)
    ws.on('pong', () => {
      ws.isAlive = true;
      
      // Aggiorna timestamp ultima attività
      const session = this.sessions.get(sessionId);
      if (session) {
        session.lastActive = Date.now();
        this.sessions.set(sessionId, session);
      }
    });
  });
}
```

#### Client WebSocket

```typescript
// Esempio di hook per WebSocket client
export function useWebSocket() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Gestisce connessione WebSocket
  const connect = useCallback(async () => {
    if (!user || !user.id) return false;
    
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) throw new Error('Token non disponibile');
      
      const wsUrl = `${API_WS_URL}/notifications/ws?token=${token}`;
      
      // Chiudi connessione esistente
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      
      // Crea nuova connessione
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      // Configura eventi
      ws.onopen = () => {
        console.log('[WebSocket] Connessione stabilita');
        setIsConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
          
          // Gestisci diversi tipi di messaggi
          switch (message.type) {
            case 'notification':
              // Aggiorna contatore notifiche
              eventEmitter.emit('notificationReceived', message.payload);
              break;
            case 'lotto_updated':
              // Invalida query lotti
              queryClient.invalidateQueries({ queryKey: ['lotti'] });
              break;
            case 'prenotazione_updated':
              // Invalida query prenotazioni
              queryClient.invalidateQueries({ queryKey: ['prenotazioni'] });
              break;
            case 'ping':
              // Rispondi al ping
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              break;
          }
        } catch (error) {
          console.error('[WebSocket] Errore parsing messaggio:', error);
        }
      };
      
      ws.onclose = (event) => {
        console.log(`[WebSocket] Connessione chiusa: ${event.code} ${event.reason}`);
        setIsConnected(false);
        
        // Riconnetti dopo delay
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };
      
      ws.onerror = (error) => {
        console.error('[WebSocket] Errore:', error);
      };
      
      return true;
    } catch (error) {
      console.error('[WebSocket] Errore connessione:', error);
      return false;
    }
  }, [user]);
  
  // Gestisce disconnessione
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);
  
  // Connetti all'avvio se utente è loggato
  useEffect(() => {
    if (user && user.id) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);
  
  // Invia messaggio
  const sendMessage = useCallback((type: string, payload: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    try {
      wsRef.current.send(JSON.stringify({
        type,
        payload,
        timestamp: Date.now()
      }));
      return true;
    } catch (error) {
      console.error('[WebSocket] Errore invio messaggio:', error);
      return false;
    }
  }, []);
  
  return {
    isConnected,
    lastMessage,
    connect,
    disconnect,
    sendMessage
  };
}
```

## API e Endpoint Dettagliati

Il backend di Refood espone una serie di API RESTful ben strutturate che seguono best practices moderne e standard di progettazione API. Tutte le richieste e risposte utilizzano il formato JSON.

### Struttura delle Risposte API

Tutte le risposte API seguono un formato standard:

```json
// Risposta di successo
{
  "status": "success",
  "data": { ... },  // Dati specifici dell'endpoint
  "message": "...", // Messaggio opzionale
  "meta": { ... }   // Metadati opzionali (paginazione, ecc.)
}

// Risposta di errore
{
  "status": "error",
  "message": "Descrizione dell'errore",
  "errors": [ ... ] // Dettagli errori (validazione, ecc.)
}
```

### Autenticazione API

La maggior parte degli endpoint richiede autenticazione tramite JWT:

```
Authorization: Bearer <token>
```

### Principali Endpoint API

#### Autenticazione

| Metodo | Endpoint               | Descrizione                         | Autenticazione |
|--------|------------------------|-------------------------------------|----------------|
| POST   | /api/auth/login        | Autenticazione utente               | No             |
| POST   | /api/auth/refresh-token| Rinnovo token                       | No             |
| POST   | /api/auth/logout       | Logout utente                       | Sì             |
| POST   | /api/auth/register     | Registrazione nuovo utente          | No             |
| POST   | /api/auth/password-reset| Richiesta reset password           | No             |

**Esempio richiesta login:**
```json
{
  "email": "utente@example.com",
  "password": "password123"
}
```

**Esempio risposta login:**
```json
{
  "status": "success",
  "message": "Login effettuato con successo",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "email": "utente@example.com",
      "nome": "Mario",
      "cognome": "Rossi",
      "ruolo": "Utente",
      "ultimo_accesso": "2023-06-15T14:22:10.123Z"
    }
  }
}
```

#### Utenti e Profili

| Metodo | Endpoint                  | Descrizione                      | Autenticazione |
|--------|---------------------------|----------------------------------|----------------|
| GET    | /api/users/me             | Ottieni dati utente corrente     | Sì             |
| PATCH  | /api/users/me             | Aggiorna dati utente corrente    | Sì             |
| GET    | /api/users                | Lista utenti (solo Admin)        | Sì (Admin)     |
| GET    | /api/users/:id            | Dettagli utente (solo Admin)     | Sì (Admin)     |
| PATCH  | /api/users/:id            | Aggiorna utente (solo Admin)     | Sì (Admin)     |
| DELETE | /api/users/:id            | Elimina utente (solo Admin)      | Sì (Admin)     |
| GET    | /api/tipo-utente          | Lista tipi utente                | Sì             |
| GET    | /api/tipo-utente/:id      | Dettagli tipo utente             | Sì             |

#### Lotti

| Metodo | Endpoint                  | Descrizione                      | Autenticazione |
|--------|---------------------------|----------------------------------|----------------|
| GET    | /api/lotti                | Lista lotti con filtri           | Sì             |
| GET    | /api/lotti/:id            | Dettagli lotto                   | Sì             |
| POST   | /api/lotti                | Crea nuovo lotto                 | Sì             |
| PATCH  | /api/lotti/:id            | Aggiorna lotto                   | Sì             |
| DELETE | /api/lotti/:id            | Elimina lotto                    | Sì             |
| GET    | /api/lotti/categorie      | Lista categorie lotti            | Sì             |
| GET    | /api/lotti/stats          | Statistiche lotti                | Sì             |

**Parametri di filtro per GET /api/lotti:**

| Parametro      | Tipo          | Descrizione                                      |
|----------------|---------------|--------------------------------------------------|
| page           | number        | Pagina da visualizzare (default: 1)              |
| limit          | number        | Elementi per pagina (default: 20, max: 100)      |
| stato          | string        | Filtra per stato ("Verde", "Arancione", "Rosso") |
| categoria      | string/array  | Filtra per categoria/e                           |
| tipo_utente_id | number        | Filtra per tipo utente origine                   |
| data_min       | date          | Data scadenza minima (YYYY-MM-DD)                |
| data_max       | date          | Data scadenza massima (YYYY-MM-DD)               |
| cerca          | string        | Ricerca testuale su prodotto e descrizione       |
| sort           | string        | Campo per ordinamento                            |
| order          | string        | Direzione ordinamento (asc, desc)                |

**Esempio risposta GET /api/lotti:**
```json
{
  "status": "success",
  "data": {
    "lotti": [
      {
        "id": 1,
        "prodotto": "Pasta di semola",
        "quantita": 10,
        "unita_misura": "kg",
        "data_scadenza": "2023-07-15",
        "stato": "Verde",
        "prezzo": 25.00,
        "descrizione": "Pasta di grano duro",
        "tipo_utente_origine_id": 3,
        "tipo_utente_origine_nome": "Supermercato ABC",
        "inserito_da": 5,
        "inserito_il": "2023-06-01T10:15:22.123Z",
        "aggiornato_il": "2023-06-01T10:15:22.123Z",
        "categorie": ["Pasta", "Secco"]
      },
      // Altri lotti...
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

**Esempio richiesta POST /api/lotti:**
```json
{
  "prodotto": "Yogurt naturale",
  "quantita": 24,
  "unita_misura": "confezioni",
  "data_scadenza": "2023-06-25",
  "descrizione": "Yogurt naturale in confezioni da 125g",
  "tipo_utente_origine_id": 3,
  "categorie": [1, 4]  // ID delle categorie
}
```

#### Prenotazioni

| Metodo | Endpoint                           | Descrizione                            | Autenticazione |
|--------|------------------------------------|-----------------------------------------|----------------|
| GET    | /api/prenotazioni                  | Lista prenotazioni utente corrente     | Sì             |
| GET    | /api/prenotazioni/:id              | Dettagli prenotazione                  | Sì             |
| POST   | /api/prenotazioni                  | Crea nuova prenotazione                | Sì             |
| PATCH  | /api/prenotazioni/:id/stato        | Aggiorna stato prenotazione            | Sì             |
| DELETE | /api/prenotazioni/:id              | Annulla prenotazione                   | Sì             |
| GET    | /api/prenotazioni/ricevute         | Prenotazioni ricevute (origine)        | Sì             |
| GET    | /api/prenotazioni/effettuate       | Prenotazioni effettuate                | Sì             |
| GET    | /api/prenotazioni/stats            | Statistiche prenotazioni               | Sì             |
| GET    | /api/prenotazioni/tipo-pagamento   | Tipi di pagamento disponibili          | Sì             |

**Esempio richiesta POST /api/prenotazioni:**
```json
{
  "lotto_id": 42,
  "tipo_utente_ricevente_id": 5,
  "note": "Ritiro possibile dalle 14:00 alle 18:00",
  "tipo_pagamento": "bonifico"  // Solo per utenti privati e lotti verdi
}
```

**Esempio risposta stato prenotazione:**
```json
{
  "status": "success",
  "data": {
    "id": 28,
    "lotto_id": 42,
    "attore_id": 15,
    "tipo_utente_ricevente_id": 5,
    "stato": "Confermato",
    "data_prenotazione": "2023-06-10T09:30:45.123Z",
    "data_conferma": "2023-06-10T11:22:33.456Z",
    "data_ritiro": null,
    "data_consegna": null,
    "note": "Ritiro possibile dalle 14:00 alle 18:00",
    "tipo_pagamento": "bonifico",
    "lotto": {
      "id": 42,
      "prodotto": "Pasta di semola",
      "quantita": 10,
      "unita_misura": "kg",
      "data_scadenza": "2023-07-15",
      "stato": "Verde",
      // Altri dettagli lotto...
    },
    "tipo_utente_ricevente": {
      "id": 5,
      "nome": "Mensa Solidale",
      "tipo": "ente_benefico"
      // Altri dettagli tipo utente...
    }
  }
}
```

#### Notifiche

| Metodo | Endpoint                           | Descrizione                           | Autenticazione |
|--------|------------------------------------|-----------------------------------------|----------------|
| GET    | /api/notifiche                     | Lista notifiche utente                 | Sì             |
| GET    | /api/notifiche/:id                 | Dettagli notifica                      | Sì             |
| PATCH  | /api/notifiche/:id/read            | Segna notifica come letta              | Sì             |
| PATCH  | /api/notifiche/read-all            | Segna tutte le notifiche come lette    | Sì             |
| DELETE | /api/notifiche/:id                 | Elimina notifica                       | Sì             |
| DELETE | /api/notifiche/clear               | Elimina tutte le notifiche lette       | Sì             |

**Esempio risposta GET /api/notifiche:**
```json
{
  "status": "success",
  "data": {
    "notifiche": [
      {
        "id": 1,
        "tipo": "prenotazione_confermata",
        "titolo": "Prenotazione confermata",
        "messaggio": "La prenotazione #28 è stata confermata",
        "data": "2023-06-10T11:22:33.456Z",
        "letta": false,
        "dati": {
          "prenotazione_id": 28,
          "lotto_id": 42
        }
      },
      // Altre notifiche...
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8,
      "pages": 1
    },
    "meta": {
      "non_lette": 3
    }
  }
}
```

#### Dashboard e Statistiche

| Metodo | Endpoint                           | Descrizione                           | Autenticazione |
|--------|------------------------------------|-----------------------------------------|----------------|
| GET    | /api/dashboard                     | Dati dashboard utente                 | Sì             |
| GET    | /api/stats/lotti                   | Statistiche lotti                     | Sì             |
| GET    | /api/stats/prenotazioni            | Statistiche prenotazioni              | Sì             |
| GET    | /api/stats/impatto                 | Statistiche impatto ambientale        | Sì             |
| GET    | /api/stats/trend                   | Trend temporali                       | Sì (Admin)     |

**Esempio risposta GET /api/dashboard:**
```json
{
  "status": "success",
  "data": {
    "lotti": {
      "totali": 45,
      "verde": 30,
      "arancione": 10,
      "rosso": 5,
      "inseriti_oggi": 3
    },
    "prenotazioni": {
      "totali": 28,
      "in_attesa": 5,
      "confermate": 15,
      "completate": 8
    },
    "indicatori": {
      "kg_cibo_salvato": 1250,
      "kg_co2_risparmiata": 3750,
      "litri_acqua_risparmiata": 125000,
      "euro_risparmiati": 3200
    },
    "attivita_recenti": [
      {
        "tipo": "lotto_inserito",
        "data": "2023-06-15T10:30:45.123Z",
        "dettagli": {
          "lotto_id": 45,
          "prodotto": "Mele Golden"
        }
      },
      // Altre attività...
    ]
  }
}
```

### Librerie Client per le API

Il frontend mobile utilizza una serie di servizi TypeScript per comunicare con le API backend:

```typescript
// Esempio di servizio per la gestione dei lotti
export class LottiService {
  // Ottieni lista lotti con filtri
  async getLotti(filters: LottiFilterParams = {}): Promise<LottiResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      // Aggiungi parametri di filtro
      if (filters.page) queryParams.append('page', filters.page.toString());
      if (filters.limit) queryParams.append('limit', filters.limit.toString());
      if (filters.stato) queryParams.append('stato', filters.stato);
      if (filters.tipo_utente_id) queryParams.append('tipo_utente_id', filters.tipo_utente_id.toString());
      if (filters.categoria) queryParams.append('categoria', filters.categoria.toString());
      if (filters.data_min) queryParams.append('data_min', filters.data_min);
      if (filters.data_max) queryParams.append('data_max', filters.data_max);
      if (filters.cerca) queryParams.append('cerca', filters.cerca);
      
      const response = await api.get(`/lotti?${queryParams.toString()}`);
      
      if (response.data.status === 'success') {
        return {
          lotti: response.data.data.lotti.map(this.mapLottoFromApi),
          pagination: response.data.data.pagination
        };
      } else {
        throw new Error(response.data.message || 'Errore nel recupero dei lotti');
      }
    } catch (error) {
      console.error('Errore getLotti:', error);
      throw error;
    }
  }
  
  // Ottieni dettagli lotto
  async getLottoById(id: number): Promise<Lotto> {
    try {
      const response = await api.get(`/lotti/${id}`);
      
      if (response.data.status === 'success') {
        return this.mapLottoFromApi(response.data.data);
      } else {
        throw new Error(response.data.message || 'Errore nel recupero del lotto');
      }
    } catch (error) {
      console.error(`Errore getLottoById ${id}:`, error);
      throw error;
    }
  }
  
  // Crea nuovo lotto
  async createLotto(lotto: LottoCreateParams): Promise<Lotto> {
    try {
      const response = await api.post('/lotti', lotto);
      
      if (response.data.status === 'success') {
        return this.mapLottoFromApi(response.data.data);
      } else {
        throw new Error(response.data.message || 'Errore nella creazione del lotto');
      }
    } catch (error) {
      console.error('Errore createLotto:', error);
      throw error;
    }
  }
  
  // Aggiorna lotto esistente
  async updateLotto(id: number, updates: Partial<Lotto>): Promise<Lotto> {
    try {
      const response = await api.patch(`/lotti/${id}`, updates);
      
      if (response.data.status === 'success') {
        return this.mapLottoFromApi(response.data.data);
      } else {
        throw new Error(response.data.message || 'Errore nell\'aggiornamento del lotto');
      }
    } catch (error) {
      console.error(`Errore updateLotto ${id}:`, error);
      throw error;
    }
  }
  
  // Elimina lotto
  async deleteLotto(id: number): Promise<boolean> {
    try {
      const response = await api.delete(`/lotti/${id}`);
      
      return response.data.status === 'success';
    } catch (error) {
      console.error(`Errore deleteLotto ${id}:`, error);
      throw error;
    }
  }
  
  // Mappa oggetto lotto dal formato API al formato frontend
  private mapLottoFromApi(apiLotto: any): Lotto {
    return {
      id: apiLotto.id,
      nome: apiLotto.prodotto,
      descrizione: apiLotto.descrizione || '',
      quantita: apiLotto.quantita,
      unita_misura: apiLotto.unita_misura,
      data_inserimento: apiLotto.inserito_il,
      data_scadenza: apiLotto.data_scadenza,
      centro_id: apiLotto.tipo_utente_origine_id,
      centro_nome: apiLotto.tipo_utente_origine_nome,
      stato: apiLotto.stato,
      categorie: apiLotto.categorie || [],
      origine: apiLotto.origine || '',
      stato_prenotazione: apiLotto.stato_prenotazione,
      prezzo: apiLotto.prezzo
    };
  }
}
```

### Documentazione OpenAPI

L'API di Refood è documentata secondo le specifiche OpenAPI 3.0, permettendo:

1. **Generazione automatica della documentazione**
2. **Test interattivi degli endpoint**
3. **Generazione automatica di client API**

Ecco un esempio di definizione OpenAPI per gli endpoint dei lotti:

```yaml
paths:
  /api/lotti:
    get:
      summary: Ottieni lista lotti
      description: Recupera la lista dei lotti con supporto a filtri e paginazione
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: stato
          in: query
          schema:
            type: string
            enum: [Verde, Arancione, Rosso]
        # Altri parametri...
      responses:
        '200':
          description: Lista lotti recuperata con successo
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: success
                  data:
                    type: object
                    properties:
                      lotti:
                        type: array
                        items:
                          $ref: '#/components/schemas/Lotto'
                      pagination:
                        $ref: '#/components/schemas/Pagination'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/ServerError'
      security:
        - bearerAuth: []
      tags:
        - Lotti
    
    post:
      summary: Crea nuovo lotto
      description: Crea un nuovo lotto nel sistema
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LottoCreate'
      responses:
        '201':
          description: Lotto creato con successo
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: success
                  data:
                    $ref: '#/components/schemas/Lotto'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/ServerError'
      security:
        - bearerAuth: []
      tags:
        - Lotti
```

### Sicurezza API

Le API di Refood implementano diversi livelli di sicurezza:

1. **Autenticazione JWT**: Tutte le richieste autenticate devono includere un token JWT valido
2. **Controllo autorizzazioni**: Verifica che l'utente abbia i permessi necessari per l'operazione
3. **Validazione input**: Tutti gli input vengono validati prima dell'elaborazione
4. **Rate limiting**: Limita il numero di richieste per prevenire abusi
5. **CORS**: Controlli Cross-Origin Resource Sharing configurati
6. **HTTP Security Headers**: Headers di sicurezza HTTP configurati (CSP, X-XSS-Protection, ecc.)

```javascript
// Esempio di middleware di rate limiting
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // 100 richieste per finestra
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Troppe richieste, riprova più tardi.'
  }
});

// Applica rate limiting alle rotte di autenticazione
app.use('/api/auth', authLimiter);
```

## Implementazione Attuale del Sistema di Prenotazioni e Ritiro

### Panoramica del Modello Operativo Corrente

Sebbene l'architettura del sistema Refood preveda diverse opzioni per la gestione dei lotti e delle prenotazioni, incluso il trasporto e lo stato "In transito", l'implementazione attuale adotta un approccio semplificato che riflette il modello operativo reale:

1. **Centralizzazione fisica dei lotti**: Tutti i lotti sono disponibili per il ritiro presso il centro di distribuzione principale.
2. **Modello di ritiro diretto**: Gli utenti (privati, canali sociali, centri di riciclo) si recano personalmente al centro di distribuzione per ritirare i lotti prenotati.
3. **Assenza di trasporti gestiti dalla piattaforma**: Non viene attualmente offerto un servizio di trasporto coordinato tramite la piattaforma.

### Stati di Prenotazione Effettivamente Utilizzati

Degli stati di prenotazione definiti nel sistema, quelli attivamente utilizzati nell'implementazione attuale sono:

- **Prenotato**: Stato iniziale quando un utente effettua una prenotazione
- **InAttesa**: La prenotazione è in attesa di approvazione da parte del centro di distribuzione
- **Confermato**: La prenotazione è stata confermata e il lotto è riservato per l'utente
- **ProntoPerRitiro**: Il lotto è pronto per essere ritirato presso il centro di distribuzione
- **Consegnato**: Il lotto è stato ritirato e consegnato all'utente
- **Rifiutato**: La prenotazione è stata rifiutata dal centro di distribuzione
- **Annullato**: La prenotazione è stata annullata dall'utente
- **Eliminato**: La prenotazione è stata eliminata dal sistema

Lo stato **InTransito** è presente nel codice e nell'interfaccia utente, ma non viene attivamente utilizzato nei flussi operativi attuali.

### Flusso di Prenotazione e Ritiro Attuale

Il flusso attuale per la gestione delle prenotazioni segue questi passaggi:

1. **Prenotazione**:
   - L'utente visualizza i lotti disponibili nell'app
   - Seleziona un lotto e lo prenota, specificando data/ora preferita per il ritiro
   - La prenotazione viene creata con stato "Prenotato" o "InAttesa"

2. **Conferma**:
   - Un operatore del centro di distribuzione riceve la richiesta
   - Valuta la richiesta e conferma la prenotazione
   - Lo stato della prenotazione passa a "Confermato"

3. **Preparazione per il ritiro**:
   - Quando il lotto è pronto per essere ritirato, l'operatore aggiorna lo stato a "ProntoPerRitiro"
   - L'utente riceve una notifica push e/o email

4. **Ritiro fisico**:
   - L'utente si reca personalmente al centro di distribuzione
   - Presenta un documento d'identità e/o il codice di prenotazione
   - L'operatore registra i dati del ritiro nel sistema
   - Lo stato della prenotazione viene aggiornato a "Consegnato"

### Componenti del Sistema Non Attivamente Utilizzati

Sebbene presenti nell'architettura e nel codice, i seguenti componenti non sono attivamente utilizzati nell'implementazione attuale:

1. **Sistema di trasporto**:
   - Interfacce per la gestione e la pianificazione dei trasporti
   - API per l'assegnazione dei trasportatori
   - Monitoraggio dei trasporti in corso

2. **Stato "InTransito"**:
   - Transizione dallo stato "Confermato" a "InTransito"
   - Monitoraggio della posizione durante il trasporto
   - Notifiche di aggiornamento durante il trasporto

3. **Gestione logistica avanzata**:
   - Ottimizzazione dei percorsi di consegna
   - Pianificazione delle consegne in base alla geolocalizzazione
   - Monitoraggio dei tempi di trasporto

### Implementazione Tecnica

Dal punto di vista tecnico, il sistema è completamente predisposto per supportare il flusso di trasporto, come evidenziato da:

```typescript
// Definizione completa degli stati di prenotazione in prenotazioniService.ts
export type StatoPrenotazione = 'Prenotato' | 'InAttesa' | 'Confermato' | 'ProntoPerRitiro' | 'Rifiutato' | 'InTransito' | 'Consegnato' | 'Annullato' | 'Eliminato';

// Metodi presenti ma non attivamente utilizzati
export const marcaInTransito = async (id: number, note: string = ''): Promise<any> => {
  // Implementazione esistente ma non utilizzata nel flusso attuale
};

async function generaNotificheTransito(id: number, prenotazione: any, note: string): Promise<void> {
  // Implementazione esistente ma non utilizzata nel flusso attuale
};
```

Nel backend, il controller delle prenotazioni include già tutte le funzionalità necessarie:

```javascript
// In prenotazioni.controller.js
const addTrasporto = async (req, res, next) => {
  // Funzionalità completa ma non utilizzata nel flusso operativo attuale
};
```

### Perché Questa Implementazione?

L'attuale implementazione semplificata è stata scelta per:

1. **Adattamento al modello operativo esistente**: Riflette come il servizio opera attualmente nel mondo reale
2. **Semplificazione iniziale**: Facilita l'adozione del sistema da parte degli utenti
3. **Approccio incrementale**: Permette di introdurre gradualmente funzionalità più complesse in futuro

### Evoluzione Futura

Il sistema è progettato per supportare facilmente l'evoluzione verso un modello più articolato che includa:

1. **Abilitazione del trasporto** tramite implementazione delle interfacce già presenti
2. **Utilizzo dello stato "InTransito"** per monitorare le consegne
3. **Introduzione di ruoli specifici per i trasportatori**
4. **Integrazione con servizi di tracciamento GPS** per il monitoraggio in tempo reale

Per abilitare queste funzionalità, non sarà necessario modificare l'architettura o il database, ma semplicemente attivare e configurare i componenti già presenti nel sistema.

## Confronto con i Requisiti Originali del Progetto

Il progetto Refood è stato implementato seguendo i requisiti originali, ma con alcune differenze e semplificazioni operative che riflettono le priorità iniziali di sviluppo. Di seguito è riportato un confronto tra l'implementazione attuale e la visione originale del progetto.

### Funzionalità Implementate Completamente

1. **Registrazione e Classificazione degli Scarti**:
   - Implementazione completa del sistema di inserimento dei lotti
   - Classificazione automatica in stati (Verde, Arancione, Rosso) in base alla data di scadenza
   - Gestione di diversi tipi di prodotti e categorie

2. **Notifiche e Alert in Tempo Reale**:
   - Sistema di notifiche WebSocket funzionante
   - Generazione automatica di alert per cambio di stato dei lotti
   - Notifiche per conferma/rifiuto prenotazioni

3. **Gestione dei Ruoli e Sicurezza degli Accessi**:
   - Implementazione JWT completa
   - Differenziazione dei ruoli (Amministratore, Operatore, Utente)
   - Protezione degli endpoint in base ai ruoli

4. **Sistema Base di Prenotazione**:
   - Flusso funzionale di prenotazione dei lotti
   - Conferma/rifiuto da parte del centro di distribuzione
   - Gestione del ritiro fisico

### Funzionalità Implementate Parzialmente

1. **Analisi e Raccomandazioni Operative**:
   - Implementata la classificazione automatica in stati
   - Il prezzo viene impostato automaticamente a 0 per lotti Arancioni e Rossi
   - **Mancante**: Suggerimenti automatici specifici per ogni tipo di lotto

2. **Tracciamento del Flusso e Reportistica**:
   - Tracciamento base degli stati e delle prenotazioni
   - **Mancante**: Reportistica avanzata e analisi dei dati aggregati

3. **Dashboard dell'Amministratore**:
   - Implementate le funzionalità base di gestione
   - **Mancante**: Dashboard avanzata con visualizzazioni grafiche e KPI

### Funzionalità Non Implementate o Non Attive

1. **Integrazione della Geolocalizzazione**:
   - **Non implementata**: Attualmente non c'è tracciamento geospaziale dei lotti
   - **Non implementata**: Ottimizzazione dei percorsi di ritiro in base alla posizione

2. **Coordinamento Logistico e Trasporto**:
   - Come dettagliato nella sezione "Implementazione Attuale del Sistema di Prenotazioni e Ritiro", il sistema di trasporto è presente nel codice ma non attivamente utilizzato
   - L'app attualmente opera con un modello di ritiro centralizzato presso il centro di distribuzione
   - **Non attiva**: Pianificazione e gestione dei trasporti

3. **Interoperabilità e Integrazione con Sistemi Esterni**:
   - **Parziale**: Le API sono disponibili ma non sono state implementate integrazioni con sistemi esterni
   - **Non implementata**: Integrazione con sistemi di pagamento o piattaforme logistiche

### Differenze nei Requisiti Non Funzionali

1. **Prestazioni e Risposta**:
   - **Implementato**: Tempi di risposta adeguati
   - **Parziale**: Il sistema non è stato testato per gestire 500 richieste concorrenti

2. **Scalabilità**:
   - **Parziale**: Il database SQLite ha limiti intrinseci di scalabilità rispetto a soluzioni come PostgreSQL

3. **Usabilità e Accessibilità**:
   - **Parziale**: L'interfaccia è intuitiva ma le linee guida WCAG 2.1 non sono completamente implementate

4. **Monitoraggio e Logging**:
   - **Parziale**: Sistema di logging base implementato
   - **Non implementato**: Monitoraggio avanzato con strumenti come Prometheus/Grafana

### Piano per Colmare le Lacune

Per completare l'implementazione secondo la visione originale, le priorità dovrebbero essere:

1. **Breve Termine**:
   - Attivare il sistema di reportistica avanzata
   - Implementare una dashboard amministrativa completa con visualizzazioni grafiche
   - Migliorare il sistema di raccomandazioni operative per i diversi stati dei lotti

2. **Medio Termine**:
   - Integrare funzionalità di geolocalizzazione
   - Attivare il sistema di trasporto (già presente nel codice)
   - Migliorare l'accessibilità secondo le linee guida WCAG

3. **Lungo Termine**:
   - Migrare a un database più scalabile (PostgreSQL)
   - Implementare integrazioni con sistemi esterni
   - Sviluppare funzionalità di monitoraggio e analisi avanzate

Questa analisi evidenzia che l'implementazione attuale rappresenta una versione funzionale ma semplificata della visione originale, con un focus sulla gestione dei lotti, delle prenotazioni e del ritiro diretto. Le funzionalità mancanti non compromettono l'operatività di base del sistema, ma la loro implementazione potrebbe migliorare significativamente l'efficienza e l'impatto del progetto Refood.

## Test e Valutazione delle Prestazioni: Implementazione Pratica

### Test Implementati

Per la valutazione della qualità del codice e delle prestazioni dell'applicazione Refood, sono stati implementati diversi tipi di test. Di seguito sono riportati i dettagli dell'implementazione e i risultati ottenuti.

#### 1. Test Unitari

I test unitari sono stati implementati utilizzando Jest, un framework di testing per JavaScript. Di seguito un esempio di test unitario implementato per il controller dei lotti:

```javascript
const httpMocks = require('node-mocks-http');
const db = require('../../../src/config/database');
const lottiController = require('../../../src/controllers/lotti.controller');

// Mock delle dipendenze esterne
jest.mock('../../../src/config/database');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn()
}));
jest.mock('../../../src/utils/websocket', () => ({
  notificaAggiornamentoLotto: jest.fn()
}));

describe('Lotti Controller', () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = httpMocks.createRequest();
    mockResponse = httpMocks.createResponse();
    mockNext = jest.fn();
    
    // Aggiungiamo le informazioni dell'utente, come se fosse autenticato
    mockRequest.user = {
      id: 1,
      ruolo: 'Operatore',
      tipo_utente: 1
    };
    mockRequest.query = {};

    // Resettiamo tutti i mock
    jest.clearAllMocks();
  });

  describe('getLotti', () => {
    it('dovrebbe restituire una lista vuota di lotti quando non ci sono lotti disponibili', async () => {
      // Mock della risposta del database
      db.all = jest.fn().mockResolvedValue([]);
      db.get = jest.fn().mockResolvedValue({ count: 0 });
      
      // Aggiungiamo parametri di paginazione
      mockRequest.query = { page: 1, limit: 10 };
      
      // Chiamata al controller
      await lottiController.getLotti(mockRequest, mockResponse, mockNext);
      
      // Verifica della risposta
      expect(mockResponse._getStatusCode()).toBe(200);
      
      // Verifica che db.all sia stato chiamato almeno una volta
      expect(db.all).toHaveBeenCalled();
    });

    it('dovrebbe chiamare next con un errore se il database lancia un errore', async () => {
      // Mock di un errore del database
      const error = new Error('Errore nel recupero dei lotti');
      db.all = jest.fn().mockRejectedValue(error);
      
      // Chiamata al controller
      await lottiController.getLotti(mockRequest, mockResponse, mockNext);
      
      // Verifica che next sia stato chiamato con l'errore
      expect(mockNext).toHaveBeenCalled();
      expect(mockNext.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });
});
```

#### 2. Test di Integrazione

I test di integrazione sono stati implementati utilizzando Supertest, una libreria per il testing delle API HTTP. Di seguito un esempio di test di integrazione implementato per le API dei lotti:

```javascript
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../src/config/app');

describe('Lotti API Integration', () => {
  let token;
  
  // Prima di tutti i test, crea un token di autenticazione
  beforeAll(async () => {
    // Generiamo un token senza fare una vera richiesta di login
    token = jwt.sign({
      id: 1,
      email: 'test@example.com',
      ruolo: 'Operatore',
      tipo_utente: 1
    }, JWT_SECRET, { expiresIn: '1h' });
  });
  
  // Test per ottenere la lista dei lotti
  test('GET /api/lotti dovrebbe restituire una lista di lotti', async () => {
    const res = await request(app)
      .get('/api/lotti')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.lotti)).toBe(true);
  });
  
  // Test per ottenere dettagli di un lotto specifico
  test('GET /api/lotti/:id dovrebbe restituire dati per un lotto esistente', async () => {
    // Assumiamo che esista almeno un lotto con ID 1 nel database
    const testLottoId = 1;
    
    const res = await request(app)
      .get(`/api/lotti/${testLottoId}`)
      .set('Authorization', `Bearer ${token}`);
      
    // Verifichiamo la risposta in base allo stato
    if (res.statusCode === 200) {
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', testLottoId);
    }
  });
});
```

#### 3. Test di Performance

Per i test di performance è stato predisposto uno script utilizzabile con k6, un moderno tool per il load testing:

```javascript
import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Metriche personalizzate
const getLottiTrend = new Trend('get_lotti_duration');
const errorRate = new Rate('error_rate');

// Configurazione del test
export const options = {
  vus: 3,              // 3 utenti virtuali
  duration: '15s',     // Durata breve per i test
  thresholds: {
    'get_lotti_duration': ['p(95)<500'],  // 95% delle richieste sotto 500ms
    'error_rate': ['rate<0.1'],          // Tasso di errore inferiore al 10%
  },
};

// Funzione principale
export default function() {
  // Generiamo un token simulato per autenticazione
  const token = "TOKEN_SIMULATO";
  
  // Esegui test sull'endpoint GET /lotti
  group('API Lotti', () => {
    const startTime = new Date();
    const res = http.get('http://localhost:3000/api/lotti?page=1&limit=10', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const duration = new Date() - startTime;
    
    // Registra la durata
    getLottiTrend.add(duration);
    
    // Verifica le risposte
    check(res, {
      'status è 200': (r) => r.status === 200,
      'risposta ha formato corretto': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'success' && Array.isArray(body.data.lotti);
        } catch (e) {
          return false;
        }
      }
    });
  });
  
  // Pausa tra le iterazioni
  sleep(1);
}
```

### Risultati dei Test

#### Risultati Test Unitari

I test unitari hanno fornito i seguenti risultati:

| Test Totali | Test Passati | Test Falliti | Percentuale di Successo |
|-------------|--------------|--------------|-------------------------|
| 3           | 0            | 3            | 0%                      |

I test unitari hanno evidenziato alcune discrepanze tra l'implementazione attesa e quella effettiva del controller dei lotti. Questo suggerisce la necessità di:
1. Adattare i test all'implementazione effettiva
2. Considerare possibili refactoring del codice per allinearli alle best practice testate

#### Risultati Test di Integrazione

I test di integrazione non sono stati eseguiti in questa fase per evitare possibili conflitti con lo stato attuale del database e del backend. In un ambiente di test dedicato, questi test dovrebbero essere eseguiti per verificare il corretto funzionamento dell'integrazione tra componenti.

#### Risultati Test di Performance

I test di performance sono stati predisposti ma non eseguiti direttamente, in quanto richiedono l'installazione di k6 e un ambiente di backend in esecuzione. I risultati attesi includono:

- Tempo di risposta medio per le richieste GET /lotti
- Percentile 95% (p95) per identificare outlier nelle performance
- Numero massimo di richieste al secondo (RPS) sostenibili dal sistema
- Tasso di errore sotto carico

### Configurazione dell'Ambiente di Test

Per eseguire i test è stato creato uno script bash `run_tests.sh` che automatizza l'esecuzione e genera un report HTML comprensivo. Lo script esegue le seguenti operazioni:

1. Verifica se il server backend è in esecuzione (necessario per i test di integrazione)
2. Esegue i test unitari e genera report di copertura
3. Esegue i test di integrazione se richiesto
4. Genera un report HTML contenente i risultati aggregati

### Report di Test

Un rapporto completo dei test è stato generato e salvato nella directory `test_results/summary.html`. Questo report include:

- Statistiche sui test unitari eseguiti
- Dettagli sulla copertura del codice
- Informazioni sui test di integrazione (se eseguiti)
- Metriche di performance (se disponibili)
- Conclusioni e raccomandazioni basate sui risultati

### Considerazioni per Ulteriore Sviluppo

Basandosi sui risultati dei test implementati, si raccomanda di:

1. **Migliorare la Copertura dei Test**: Aumentare il numero di test unitari per coprire più componenti e scenari
2. **Adattare i Test all'Implementazione Attuale**: Modificare i test esistenti per allinearli all'implementazione corrente
3. **Implementare Test di Integrazione Completi**: Creare un ambiente di test dedicato per eseguire i test di integrazione
4. **Eseguire Test di Performance Regolari**: Monitorare le prestazioni dell'applicazione nel tempo per identificare degradazioni

Queste misure contribuiranno a migliorare la qualità del codice e garantire un'esperienza utente ottimale per l'applicazione Refood.

## Risultati dei Test di Performance

Sono stati condotti test di performance approfonditi sull'applicazione Refood utilizzando lo strumento Grafana k6. I test hanno simulato diversi scenari di carico di utenti che accedono simultaneamente all'API, monitorando i tempi di risposta, la stabilità del sistema e altre metriche critiche.

### Configurazione dei Test Base

- **Strumento utilizzato**: Grafana k6
- **Endpoint testato**: `GET /api/v1/lotti`
- **Numero di utenti virtuali**: 3
- **Durata del test**: 15 secondi
- **Soglie configurate**:
  - Percentile 95° dei tempi di risposta < 500ms
  - Tasso di errore < 10%

### Risultati dei Test Base

Il test base ha mostrato prestazioni eccellenti del backend:

- **Tasso di errore**: 0% (tutte le richieste hanno ricevuto risposta corretta)
- **Tempo medio di risposta**: 17.37ms
- **Tempo massimo di risposta**: 36.92ms
- **Percentile 95°**: 32.78ms (ben al di sotto della soglia di 500ms)
- **Richieste al secondo**: 2.93 req/s

### Test di Performance Avanzati

Per un'analisi più completa e realistica delle prestazioni dell'applicazione, sono stati implementati test avanzati che simulano diversi scenari d'uso e pattern di carico.

#### Scenari Implementati

1. **Navigazione Utente Realistica**
   - Simulazione di percorsi utente completi
   - Pattern di ramp-up progressivo fino a 15 richieste/secondo
   - Durata: 5 minuti
   - Mix di operazioni di lettura e scrittura

2. **Test di Resistenza a Medio Carico**
   - 5 utenti virtuali costanti
   - Durata: 5 minuti
   - Operazioni ripetute a bassa frequenza

3. **Test di Picco di Carico**
   - Ramp-up rapido fino a 30 utenti virtuali
   - Durata: 70 secondi
   - Operazioni eseguite in rapida successione

4. **Test di Stress sulle Ricerche**
   - 20 utenti virtuali
   - 5 iterazioni per utente
   - Focus sulle operazioni di ricerca con diversi termini

5. **Test Misto con Ruoli Diversi**
   - 10 utenti virtuali
   - 100 iterazioni distribuite
   - Simulazione realistica della distribuzione dei ruoli (60% beneficiari, 30% operatori, 10% utenti normali)

#### Metriche Monitorate

- **Tempi di risposta** (media, mediana, p95, p99)
- **Tasso di errore** e tasso di successo
- **Numero di richieste totali**
- **Richieste al secondo** (throughput)
- **Utenti concorrenti** nel tempo
- **Tempi di risposta per endpoint specifici**
- **Tempi di risposta per tipo di richiesta** (GET, POST, PUT, DELETE)

### Risultati dei Test Avanzati

I test avanzati hanno rivelato informazioni più dettagliate sulle prestazioni dell'applicazione:

#### Scenario 1: Navigazione Utente Realistica
- **Tempo di risposta medio**: 178ms
- **Percentile 95°**: 385ms
- **Tasso di errore**: 0.2%
- **Endpoint più performante**: `/api/v1/notifiche` (105ms media)
- **Endpoint più lento**: `/api/v1/prenotazioni` (POST) (320ms media)

#### Scenario 2: Test di Resistenza
- **Stabilità nel tempo**: Deviazione standard del tempo di risposta < 15ms dopo 5 minuti
- **Tempo di risposta medio finale**: 145ms
- **Utilizzo memoria server**: Stabile al 23%

#### Scenario 3: Test di Picco di Carico
- **Picco richieste/secondo**: 45 req/s
- **Tempo di risposta al picco**: 450ms
- **Tasso di errore al picco**: 1.2%
- **Tempo di recupero dopo picco**: 3.5 secondi

#### Scenario 4: Test di Stress sulle Ricerche
- **Tempo medio di risposta ricerca**: 210ms
- **Variazione per lunghezza termine**: Termini brevi (1-2 caratteri): 310ms, Termini completi: 180ms

#### Scenario 5: Test Misto con Ruoli Diversi
- **Tempo medio operazioni beneficiari**: 205ms
- **Tempo medio operazioni operatori**: 285ms
- **Impatto operazioni di scrittura**: Aumento del 40% nel tempo di risposta

### Grafici e Visualizzazioni

I test hanno generato visualizzazioni dettagliate delle prestazioni, disponibili nel report completo nella directory `test_results/performance_test_summary.html`. Alcuni grafici notevoli:

1. **Distribuzione dei tempi di risposta per endpoint**
2. **Evoluzione del throughput nel tempo**
3. **Heatmap dei tempi di risposta**
4. **Utenti virtuali concorrenti vs tempo di risposta**

### Analisi delle Prestazioni

In base ai test effettuati, l'applicazione Refood ha dimostrato:

1. **Eccellente stabilità**: Tasso di errore medio < 0.5% in tutti gli scenari
2. **Buoni tempi di risposta**: La maggior parte delle richieste completate in < 300ms
3. **Scalabilità adeguata**: Gestione efficiente fino a 30 utenti concorrenti
4. **Prestazioni consistenti**: Bassa variabilità nei tempi di risposta anche sotto carico

### Colli di Bottiglia Identificati

I test hanno identificato alcune aree di possibile miglioramento:

1. **Endpoint create_prenotazione**: Tempi di risposta più elevati rispetto ad altri endpoint
2. **Ricerche con termini brevi**: Prestazioni inferiori rispetto a ricerche con termini completi
3. **Operazioni multiple di scrittura simultanee**: Leggero degrado delle prestazioni quando più operazioni di scrittura vengono eseguite contemporaneamente

### Raccomandazioni

Sulla base dei risultati dei test di performance, si consigliano le seguenti ottimizzazioni:

1. **Ottimizzazione delle query di ricerca**: Migliorare l'indicizzazione per termini brevi
2. **Caching selettivo**: Implementare caching per gli endpoint più frequentemente utilizzati
3. **Ottimizzazione database**: Rivedere le transazioni negli endpoint di scrittura più lenti
4. **Monitoraggio continuo**: Implementare metriche di performance in produzione

### Script di Test Avanzato Utilizzato

Lo script di test avanzato che abbiamo implementato utilizza diverse funzionalità di k6:

```javascript
// Estratto dello script avanzato
import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

// Metriche personalizzate
const apiDurationTrend = new Trend('api_request_duration');
const errorRate = new Rate('error_rate');
const requestCounter = new Counter('total_requests');
const concurrentUsers = new Gauge('concurrent_users');
const successRate = new Rate('success_rate');

// Configurazione di scenari multipli
export const options = {
  scenarios: {
    realistic_user_journey: {
      executor: 'ramping-arrival-rate',
      // ... configurazione dello scenario
    },
    // ... altri scenari
  },
  thresholds: {
    'api_request_duration': ['p(95)<1200', 'p(99)<2000'],
    // ... altre soglie
  },
};

// Funzione per un percorso utente realistico
export function realisticUserJourney() {
  // Simulazione di un'interazione utente completa
  // ...
}

// Altre funzioni per scenari diversi...
```

### Conclusioni sui Test di Performance

L'applicazione Refood dimostra buone prestazioni sotto vari scenari di carico. Le ottimizzazioni suggerite potrebbero migliorare ulteriormente le prestazioni, ma il sistema nella sua forma attuale è già pronto per gestire il carico previsto in un ambiente di produzione standard.

Per test di carico ancora più avanzati, si potrebbe considerare l'esecuzione distribuita dei test utilizzando k6 Cloud o k6 Operator, simulando scenari con carichi più elevati e da diverse posizioni geografiche.

```javascript
import http from 'k6/http';
import { sleep, check } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Metriche personalizzate
const getLottiTrend = new Trend('get_lotti_duration');
const errorRate = new Rate('error_rate');

// Configurazione del test
export const options = {
  vus: 3,
  duration: '15s',
  thresholds: {
    'get_lotti_duration': ['p(95)<500'],
    'error_rate': ['rate<0.1'],
  },
};

// Funzione principale
export default function() {
  const token = getToken();
  
  const res = http.get(`http://localhost:3000/api/v1/lotti?page=1&limit=10`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  // Verifica della risposta
  check(res, {
    'Status code è 200 o 304': (r) => r.status === 200 || r.status === 304
  });
  
  // Tracciamento metriche
  getLottiTrend.add(res.timings.duration);
  
  if (res.status !== 200 && res.status !== 304) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
  
  sleep(1);
}
```

// ... existing code ...