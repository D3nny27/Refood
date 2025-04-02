#!/bin/bash
# Script di installazione automatica per Linux/macOS

echo "==================================="
echo "Installazione automatica di Refood"
echo "==================================="
echo

# Colori per l'output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Funzione per stampare messaggi di errore
error() {
  echo -e "${RED}ERRORE: $1${NC}"
  exit 1
}

# Funzione per stampare messaggi di successo
success() {
  echo -e "${GREEN}$1${NC}"
}

# Funzione per stampare avvisi
warning() {
  echo -e "${YELLOW}AVVISO: $1${NC}"
}

# Verifica prerequisiti
echo "1. Verifica dei prerequisiti..."
if ! command -v node &> /dev/null; then
    error "Node.js non trovato. Per favore installalo prima di continuare."
fi

if ! command -v npm &> /dev/null; then
    error "npm non trovato. Per favore reinstalla Node.js con npm."
fi

echo "Node.js trovato: $(node -v)"
echo "npm trovato: $(npm -v)"
echo

# Installazione dipendenze globali
echo "2. Installazione delle dipendenze globali..."
npm install -g nodemon expo-cli || error "Impossibile installare le dipendenze globali"
success "Dipendenze globali installate correttamente."
echo

# Installazione dipendenze backend
echo "3. Installazione delle dipendenze del progetto backend..."
cd backend || error "Directory 'backend' non trovata"
npm install || error "Impossibile installare le dipendenze del backend"
success "Dipendenze del backend installate correttamente."
echo

# Configurazione database
echo "4. Configurazione automatica del database..."
cd ..
mkdir -p database
success "Directory database creata."
echo

# Controlla se SQLite è installato
if ! command -v sqlite3 &> /dev/null; then
    echo "SQLite non trovato. Installazione in corso..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install sqlite3 || error "Impossibile installare SQLite via Homebrew. Installalo manualmente da https://www.sqlite.org/download.html"
    else
        # Linux
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y sqlite3 || error "Impossibile installare SQLite. Installalo manualmente."
        elif command -v yum &> /dev/null; then
            sudo yum install -y sqlite || error "Impossibile installare SQLite. Installalo manualmente."
        elif command -v pacman &> /dev/null; then
            sudo pacman -S sqlite || error "Impossibile installare SQLite. Installalo manualmente."
        else
            error "Impossibile rilevare il gestore pacchetti. Installa SQLite manualmente."
        fi
    fi
    
    success "SQLite installato con successo."
else
    echo "SQLite già installato nel sistema."
fi

echo
echo "Inizializzazione del database..."
echo "Versione SQLite: $(sqlite3 --version)"

# Verifica che i file SQL esistano
cd backend || error "Directory 'backend' non trovata"
if [ ! -f "schema.sql" ]; then
    error "File schema.sql non trovato nella directory backend"
fi

if [ ! -f "custom_sqlite_functions.sql" ]; then
    error "File custom_sqlite_functions.sql non trovato nella directory backend"
fi

if [ ! -f "setup_database_views.sql" ]; then
    error "File setup_database_views.sql non trovato nella directory backend"
fi

echo "Creazione schema database..."
sqlite3 ../database/refood.db < schema.sql || error "Impossibile applicare lo schema al database"

echo "Configurazione funzioni personalizzate SQLite..."
sqlite3 ../database/refood.db < custom_sqlite_functions.sql || error "Impossibile applicare le funzioni personalizzate al database"

echo "Configurazione viste database..."
sqlite3 ../database/refood.db < setup_database_views.sql || error "Impossibile configurare le viste del database"

success "Database inizializzato con successo."
echo

# Configurazione ambiente backend
echo "5. Configurazione dell'ambiente backend..."
echo "Creazione del file .env per il backend..."
cat > .env << EOL
PORT=3000
JWT_SECRET=refood_secure_key_auto_generated
JWT_EXPIRATION=24h
DATABASE_PATH=../database/refood.db
NODE_ENV=development
API_PREFIX=/api/v1
LOG_LEVEL=info
EOL

success "File .env del backend creato con successo."
echo

# Installazione dipendenze frontend
echo "6. Installazione delle dipendenze del frontend mobile..."
cd ..
cd refood-mobile || error "Directory 'refood-mobile' non trovata"
npm install || error "Impossibile installare le dipendenze del frontend mobile"
success "Dipendenze del frontend mobile installate correttamente."
echo

# Configurazione ambiente frontend
echo "7. Configurazione dell'ambiente frontend..."
echo "Rilevamento indirizzo IP in corso..."

# Prendi l'IP della macchina
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    IP=$(ipconfig getifaddr en0)
    if [ -z "$IP" ]; then
        IP=$(ipconfig getifaddr en1)
    fi
else
    # Linux
    IP=$(hostname -I | awk '{print $1}')
fi

if [ -z "$IP" ]; then
    warning "Impossibile rilevare l'IP automaticamente. Utilizzo 127.0.0.1"
    IP="127.0.0.1"
fi

echo "Creazione del file .env per il frontend..."
cat > .env << EOL
# Configurazione API per il frontend mobile
# Modifica questo indirizzo se necessario per dispositivi fisici
API_URL=http://$IP:3000/api/v1
EOL

success "File .env del frontend creato con successo."
echo

# Creazione directory per script di manutenzione
echo "8. Creazione dei file per la manutenzione automatica..."
cd ..
mkdir -p maintenance_scripts
success "Directory maintenance_scripts creata."
echo

# Rendi gli script bash eseguibili
echo "9. Configurazione permessi degli script..."
chmod +x setup_unix.sh
if [ -f "install_maintenance_cron.sh" ]; then
    chmod +x install_maintenance_cron.sh
fi
if [ -f "install_schema_monitoring.sh" ]; then
    chmod +x install_schema_monitoring.sh
fi
if [ -f "safe_schema_exec.sh" ]; then
    chmod +x safe_schema_exec.sh
fi
success "Permessi degli script configurati correttamente."
echo

echo "==================================="
echo "Installazione completata con successo!"
echo
echo "Per avviare il backend:"
echo "  cd backend"
echo "  npm run dev"
echo
echo "Per avviare il frontend:"
echo "  cd refood-mobile"
echo "  npx expo start"
echo
echo "Nota: Se stai usando un dispositivo fisico per testare,"
echo "modifica il file refood-mobile/.env per usare il tuo indirizzo IP reale"
echo "se quello rilevato automaticamente ($IP) non funziona."
echo "===================================" 