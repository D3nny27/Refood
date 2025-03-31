#!/bin/bash
# Script per l'esecuzione delle procedure di manutenzione

# Impostazione variabili
DB_PATH="/home/denny/Documenti/Tesi/database/refood.db"
SCRIPTS_DIR="/home/denny/Documenti/Tesi/maintenance_scripts"
LOG_DIR="/home/denny/Documenti/Tesi/maintenance_scripts/logs"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M:%S)
SCRIPT_NAME=$1
LOG_FILE="$LOG_DIR/${SCRIPT_NAME%.*}_$DATE.log"

# Verifica se la directory di log esiste, altrimenti la crea
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
fi

# Verifica che il database esista
if [ ! -f "$DB_PATH" ]; then
    echo "[$DATE $TIME] ERRORE: Database non trovato in $DB_PATH" >> "$LOG_FILE"
    exit 1
fi

# Verifica che lo script SQL esista
if [ ! -f "$SCRIPTS_DIR/$SCRIPT_NAME" ]; then
    echo "[$DATE $TIME] ERRORE: Script SQL $SCRIPT_NAME non trovato in $SCRIPTS_DIR" >> "$LOG_FILE"
    exit 1
fi

# Esegue lo script SQL e registra l'output nel file di log
echo "[$DATE $TIME] INIZIO: Esecuzione $SCRIPT_NAME" >> "$LOG_FILE"
sqlite3 "$DB_PATH" < "$SCRIPTS_DIR/$SCRIPT_NAME" 2>> "$LOG_FILE"

# Verifica lo stato di uscita di sqlite3
if [ $? -eq 0 ]; then
    echo "[$DATE $TIME] SUCCESSO: $SCRIPT_NAME eseguito correttamente" >> "$LOG_FILE"
else
    echo "[$DATE $TIME] ERRORE: Problemi nell'esecuzione di $SCRIPT_NAME" >> "$LOG_FILE"
fi

echo "[$DATE $TIME] FINE: Esecuzione $SCRIPT_NAME" >> "$LOG_FILE"
echo "-----------------------------------------------------" >> "$LOG_FILE"
