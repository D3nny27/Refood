#!/bin/bash

# Colori per l'output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Funzione per stampare messaggi con timestamp
log() {
  echo -e "${2}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Funzione per verificare se un comando è andato a buon fine
check_status() {
  if [ $? -eq 0 ]; then
    log "✅ $1" "${GREEN}"
  else
    log "❌ $1 FALLITO!" "${RED}"
    exit 1
  fi
}

# Funzione per chiedere conferma
confirm() {
  read -p "$1 [s/N] " response
  case "$response" in
    [sS][iI]|[sS]) 
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Directory principale
BASE_DIR="$(pwd)"
BACKEND_DIR="$BASE_DIR/backend"
FRONTEND_DIR="$BASE_DIR/refood-mobile"
MIGRATIONS_DIR="$BASE_DIR/migrations"
DB_PATH=$(grep -o 'DB_PATH=.*' "$BACKEND_DIR/.env" | cut -d= -f2)
BACKUP_DIR="$BASE_DIR/backups/$(date +'%Y%m%d_%H%M%S')"

# Banner iniziale
echo -e "${YELLOW}"
echo "=========================================================="
echo "  SCRIPT DI MIGRAZIONE REFOOD - CENTRI A TIPI UTENTE"
echo "=========================================================="
echo -e "${NC}"

# Verifica che siamo nella directory giusta
if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
  log "Directory del progetto non trovate. Assicurati di eseguire lo script dalla root del progetto." "${RED}"
  exit 1
fi

# Step 1: Backup del database
mkdir -p "$BACKUP_DIR"
log "Backup del database in corso..." "${YELLOW}"
if [ -f "$DB_PATH" ]; then
  cp "$DB_PATH" "$BACKUP_DIR/refood_db_backup.db"
  check_status "Backup del database"
else
  log "Database non trovato in $DB_PATH!" "${RED}"
  exit 1
fi

# Step 2: Verifica delle installazioni
log "Verifica delle dipendenze del backend..." "${YELLOW}"
cd "$BACKEND_DIR" && npm install
check_status "Installazione dipendenze backend"

log "Verifica delle dipendenze del frontend..." "${YELLOW}"
cd "$FRONTEND_DIR" && npm install
check_status "Installazione dipendenze frontend"

# Step 3: Esecuzione della migrazione del database
log "Esecuzione della migrazione del database..." "${YELLOW}"
cd "$BACKEND_DIR" && npm run migrate:utenti-to-attori
check_status "Migrazione del database"

# Step 4: Esecuzione dei test automatici
if confirm "Vuoi eseguire i test automatici?"; then
  log "Esecuzione dei test backend..." "${YELLOW}"
  cd "$BACKEND_DIR" && npm test
  check_status "Test backend"
fi

# Step 5: Completamento e istruzioni
log "Migrazione completata con successo!" "${GREEN}"
echo ""
log "Passaggi successivi:" "${YELLOW}"
echo "1. Verificare la migrazione utilizzando la checklist: $MIGRATIONS_DIR/test_checklist_migrazione.md"
echo "2. Consultare la documentazione sul nuovo flusso: $MIGRATIONS_DIR/nuovo_flusso_registrazione.md"
echo "3. Eseguire i test manuali dell'applicazione"
echo ""
log "Il backup del database si trova in: $BACKUP_DIR/refood_db_backup.db" "${GREEN}"

# Fine
echo -e "${YELLOW}"
echo "=========================================================="
echo "  MIGRAZIONE COMPLETATA"
echo "=========================================================="
echo -e "${NC}" 