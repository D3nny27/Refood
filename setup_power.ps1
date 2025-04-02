# Script di installazione PowerShell per Refood

# Funzioni di utility
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Step($step, $total, $message) {
    Write-ColorOutput Green "[$step/$total] $message"
}

function Write-Error($message) {
    Write-ColorOutput Red "ERRORE: $message"
}

function Write-Success($message) {
    Write-ColorOutput Green $message
}

# Controllo se PowerShell è eseguito come amministratore
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Questo script deve essere eseguito come amministratore!"
    Write-Output "Premere un tasto per uscire..."
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit
}

# Visualizza informazioni di avvio
Write-Output "==================================="
Write-Output "Installazione automatica di Refood"
Write-Output "==================================="
Write-Output ""

# Step 1: Verifica prerequisiti
Write-Step 1 8 "Verifica Node.js e npm..."
try {
    $nodeVersion = node -v
    Write-Output "Node.js trovato: $nodeVersion"
    
    $npmVersion = npm -v
    Write-Output "npm trovato: $npmVersion"
} catch {
    Write-Error "Node.js o npm non trovato. Installalo da https://nodejs.org/"
    Write-Output "Premere un tasto per uscire..."
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit
}

# Step 2: Creazione cartelle e .env backend
Write-Step 2 8 "Backend: creazione cartelle e .env"
if (-not (Test-Path "backend")) {
    Write-Error "La directory 'backend' non esiste!"
    Write-Output "Premere un tasto per uscire..."
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit
}

Set-Location backend
$envContent = @"
PORT=3000
JWT_SECRET=refood_secure_key_auto_generated
JWT_EXPIRATION=24h
DATABASE_PATH=../database/refood.db
NODE_ENV=development
API_PREFIX=/api/v1
LOG_LEVEL=info
"@
$envContent | Out-File -FilePath ".env" -Encoding utf8
Write-Output "File .env del backend creato."
Set-Location ..

# Step 3: Frontend .env
Write-Step 3 8 "Frontend: creazione file .env"
if (-not (Test-Path "refood-mobile")) {
    Write-Error "La directory 'refood-mobile' non esiste!"
    Write-Output "Premere un tasto per uscire..."
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit
}

Set-Location refood-mobile
$envContent = @"
# Configurazione API per il frontend mobile
# Modifica questo indirizzo se necessario per dispositivi fisici
API_URL=http://127.0.0.1:3000/api/v1
"@
$envContent | Out-File -FilePath ".env" -Encoding utf8
Write-Output "File .env del frontend creato."
Set-Location ..

# Step 4: Creazione directory per database e scripts
Write-Step 4 8 "Creazione directory per database e script manutenzione"
if (-not (Test-Path "database")) {
    New-Item -ItemType Directory -Path "database"
}
if (-not (Test-Path "maintenance_scripts")) {
    New-Item -ItemType Directory -Path "maintenance_scripts"
}

# Step 5: SQLite
Write-Step 5 8 "Verifica SQLite e installazione se necessario"
try {
    sqlite3 --version | Out-Null
    Write-Output "SQLite già installato nel sistema."
} catch {
    Write-Output "SQLite non trovato. Scaricamento in corso..."
    
    if (-not (Test-Path "temp")) {
        New-Item -ItemType Directory -Path "temp"
    }
    Set-Location temp
    
    Write-Output "Scaricamento SQLite..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://www.sqlite.org/2023/sqlite-tools-win32-x86-3400100.zip" -OutFile "sqlite.zip"
    
    Write-Output "Estrazione SQLite..."
    Expand-Archive -Path "sqlite.zip" -DestinationPath "." -Force
    
    Write-Output "Installazione SQLite..."
    Move-Item -Path "sqlite-tools-win32-x86-3400100\*.*" -Destination "..\database\"
    
    Set-Location ..
    Remove-Item -Path "temp" -Recurse -Force
    
    Write-Output "SQLite installato localmente. Aggiungendo al PATH temporaneo..."
    $env:Path += ";$((Get-Location).Path)\database"
}

# Step 6: Install backend dependencies
Write-Step 6 8 "Installazione dipendenze backend"
Set-Location backend
Write-Output "Installazione npm del backend..."
npm install
Set-Location ..

# Step 7: Install frontend dependencies
Write-Step 7 8 "Installazione dipendenze frontend"
Set-Location refood-mobile
Write-Output "Installazione npm del frontend..."
npm install
Set-Location ..

# Step 8: Install global packages
Write-Step 8 8 "Installazione pacchetti globali"
Write-Output "Installazione nodemon..."
npm install -g nodemon
Write-Output "Installazione expo-cli..."
npm install -g expo-cli

# Success message
Write-Output ""
Write-Success "=========================================="
Write-Success "   Installazione completata con successo!  "
Write-Success "=========================================="
Write-Output ""
Write-Output "Puoi avviare il backend con:"
Write-Output "  cd backend"
Write-Output "  npm run dev"
Write-Output ""
Write-Output "Puoi avviare il frontend con:"
Write-Output "  cd refood-mobile"
Write-Output "  npx expo start"
Write-Output ""

# Pause before exit
Write-Output "Premere un tasto per uscire..."
$null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 