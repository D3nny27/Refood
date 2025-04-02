#!/bin/bash
# Script per inizializzare il database Refood
# Utilizza i file schema divisi per creare il database

set -e  # Interrompe lo script se un comando fallisce

# Colori per l'output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}Inizializzazione Database Refood${NC}"
echo -e "${GREEN}==================================${NC}"
echo

# Crea la directory database se non esiste
if [ ! -d "database" ]; then
    echo -e "${YELLOW}Creazione directory database...${NC}"
    mkdir -p database
    echo -e "${GREEN}Directory database creata.${NC}"
else
    echo -e "${YELLOW}Directory database già esistente.${NC}"
fi

# Verifica se SQLite è installato
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${RED}ERRORE: SQLite3 non trovato. Installalo prima di continuare.${NC}"
    exit 1
else
    echo -e "${GREEN}SQLite3 trovato: $(sqlite3 --version)${NC}"
fi

# Verifica se i file schema esistono
for file in schema_tables.sql schema_indexes.sql schema_triggers.sql; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}ERRORE: File $file non trovato.${NC}"
        exit 1
    fi
done

# Backup del database esistente se presente
if [ -f "database/refood.db" ]; then
    echo -e "${YELLOW}Backup del database esistente...${NC}"
    backup_name="database/refood_backup_$(date +%Y%m%d_%H%M%S).db"
    cp database/refood.db "$backup_name"
    echo -e "${GREEN}Backup creato: $backup_name${NC}"
fi

echo
echo -e "${YELLOW}Inizializzazione del database...${NC}"

# 1. Crea le tabelle
echo -e "${YELLOW}Passo 1: Creazione tabelle...${NC}"
sqlite3 database/refood.db < schema_tables.sql
echo -e "${GREEN}Tabelle create con successo.${NC}"

# 2. Crea gli indici
echo -e "${YELLOW}Passo 2: Creazione indici...${NC}"
sqlite3 database/refood.db < schema_indexes.sql
echo -e "${GREEN}Indici creati con successo.${NC}"

# 3. Crea i trigger
echo -e "${YELLOW}Passo 3: Creazione trigger...${NC}"
sqlite3 database/refood.db < schema_triggers.sql
echo -e "${GREEN}Trigger creati con successo.${NC}"

# Verifica la creazione del database
echo
echo -e "${YELLOW}Verifica della struttura del database...${NC}"
num_tables=$(sqlite3 database/refood.db "SELECT count(*) FROM sqlite_master WHERE type='table'")
echo -e "${GREEN}Database creato con $num_tables tabelle.${NC}"

echo
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}Database inizializzato con successo!${NC}"
echo -e "${GREEN}==================================${NC}"
echo
echo "Nota: Il file schema_maintenance.sql contiene procedure di manutenzione"
echo "da eseguire periodicamente attraverso job schedulati."
echo

# Opzionale: mostra informazioni sul database
echo -e "${YELLOW}Vuoi vedere la lista delle tabelle? (s/n)${NC}"
read -r risposta
if [[ "$risposta" == "s" || "$risposta" == "S" ]]; then
    echo
    sqlite3 database/refood.db ".tables"
fi

exit 0 