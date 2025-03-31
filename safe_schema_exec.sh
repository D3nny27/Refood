#!/bin/bash
# ******************************************************************
# SCRIPT PER L'ESECUZIONE SICURA DI MODIFICHE ALLO SCHEMA DATABASE
# ******************************************************************
# Questo script esegue operazioni di modifica dello schema in modo sicuro:
# 1. Crea un backup del database prima delle modifiche
# 2. Verifica lo schema prima dell'esecuzione
# 3. Esegue lo script di modifica dello schema
# 4. Verifica lo schema dopo l'esecuzione
# 5. Traccia tutte le modifiche

# Configurazione
DB_PATH="/home/denny/Documenti/Tesi/database/refood.db"
BACKUP_DIR="/home/denny/Documenti/Tesi/backup"
SCHEMA_MONITOR="/home/denny/Documenti/Tesi/schema_monitor.sql"
SCHEMA_FIX="/home/denny/Documenti/Tesi/schema_fix.sql"
LOG_DIR="/home/denny/Documenti/Tesi/logs"
CURRENT_DATETIME=$(date +"%Y%m%d_%H%M%S")

# Crea directory se non esistono
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"

# Funzione per eseguire comandi SQL con gestione errori
execute_sql() {
    local sql_file="$1"
    local output_file="$2"
    
    echo "Esecuzione di $sql_file..."
    if sqlite3 "$DB_PATH" < "$sql_file" > "$output_file" 2>&1; then
        echo "✓ Esecuzione completata con successo"
        return 0
    else
        echo "✗ Errore nell'esecuzione di $sql_file. Vedi $output_file per dettagli."
        return 1
    fi
}

# Funzione per creare un backup del database
create_backup() {
    local backup_file="$BACKUP_DIR/refood_backup_$CURRENT_DATETIME.sql"
    echo "Creazione backup del database in $backup_file..."
    
    if sqlite3 "$DB_PATH" ".dump" > "$backup_file"; then
        echo "✓ Backup creato con successo"
        echo "Backup path: $backup_file"
        return 0
    else
        echo "✗ Errore nella creazione del backup"
        return 1
    fi
}

# Controllo parametri
if [ $# -lt 1 ]; then
    echo "Uso: $0 <script_sql_da_eseguire> [nome_operazione]"
    echo "     Lo script eseguirà in modo sicuro il file SQL specificato,"
    echo "     verificando lo schema prima e dopo e creando un backup."
    exit 1
fi

# Parametri
SQL_SCRIPT="$1"
OP_NAME="${2:-schema_modification}"

if [ ! -f "$SQL_SCRIPT" ]; then
    echo "✗ Errore: Il file $SQL_SCRIPT non esiste"
    exit 1
fi

# Log e output file
LOG_FILE="$LOG_DIR/${OP_NAME}_${CURRENT_DATETIME}.log"
SCHEMA_BEFORE="$LOG_DIR/schema_before_${OP_NAME}_${CURRENT_DATETIME}.txt"
SCHEMA_AFTER="$LOG_DIR/schema_after_${OP_NAME}_${CURRENT_DATETIME}.txt"
EXEC_OUTPUT="$LOG_DIR/exec_${OP_NAME}_${CURRENT_DATETIME}.txt"

# Inizia log
echo "===== ESECUZIONE SICURA DI SCRIPT SQL =====" > "$LOG_FILE"
echo "Data e ora: $(date)" >> "$LOG_FILE"
echo "Script: $SQL_SCRIPT" >> "$LOG_FILE"
echo "Database: $DB_PATH" >> "$LOG_FILE"
echo "Operazione: $OP_NAME" >> "$LOG_FILE"
echo "==========================================" >> "$LOG_FILE"

# Verifica esistenza schema_monitor.sql
if [ ! -f "$SCHEMA_MONITOR" ]; then
    echo "✗ Errore: Il file di monitoraggio schema $SCHEMA_MONITOR non esiste"
    echo "Crealo prima di usare questo script!"
    exit 1
fi

# Step 1: Backup del database
echo "Step 1: Creazione backup del database" | tee -a "$LOG_FILE"
if ! create_backup; then
    echo "✗ Impossibile procedere senza un backup" | tee -a "$LOG_FILE"
    exit 1
fi
echo "" >> "$LOG_FILE"

# Step 2: Verifica schema prima dell'esecuzione
echo "Step 2: Verifica schema prima dell'esecuzione" | tee -a "$LOG_FILE"
if ! execute_sql "$SCHEMA_MONITOR" "$SCHEMA_BEFORE"; then
    echo "✗ Errore nella verifica dello schema iniziale" | tee -a "$LOG_FILE"
    echo "Proseguo comunque, ma con attenzione..."
fi

# Verifica se ci sono già discrepanze
DISCREPANZE_INIZIALI=$(grep "Trovate discrepanze" "$SCHEMA_BEFORE" || echo "")
if [ -n "$DISCREPANZE_INIZIALI" ]; then
    echo "⚠️ Attenzione: Ci sono discrepanze nello schema prima dell'esecuzione" | tee -a "$LOG_FILE"
    echo "Estratto da $SCHEMA_BEFORE:" | tee -a "$LOG_FILE"
    grep -A20 "Trovate discrepanze" "$SCHEMA_BEFORE" | head -n10 | tee -a "$LOG_FILE"
    
    # Chiedi conferma all'utente
    read -p "Vuoi correggere le discrepanze prima di continuare? (s/n): " CORREGGERE
    if [[ $CORREGGERE == "s" || $CORREGGERE == "S" ]]; then
        echo "Correzione delle discrepanze..." | tee -a "$LOG_FILE"
        if ! execute_sql "$SCHEMA_FIX" "$LOG_DIR/fix_before_${CURRENT_DATETIME}.txt"; then
            echo "✗ Errore nella correzione delle discrepanze" | tee -a "$LOG_FILE"
            echo "Continuo comunque, ma con molta attenzione..."
        else
            echo "✓ Discrepanze corrette con successo" | tee -a "$LOG_FILE"
        fi
    else
        echo "Continuazione senza correggere le discrepanze iniziali" | tee -a "$LOG_FILE"
    fi
fi
echo "" >> "$LOG_FILE"

# Step 3: Esecuzione dello script
echo "Step 3: Esecuzione dello script $SQL_SCRIPT" | tee -a "$LOG_FILE"
if ! execute_sql "$SQL_SCRIPT" "$EXEC_OUTPUT"; then
    echo "✗ Errore nell'esecuzione dello script" | tee -a "$LOG_FILE"
    echo "Output:" | tee -a "$LOG_FILE"
    cat "$EXEC_OUTPUT" | tee -a "$LOG_FILE"
    
    # Chiedi se ripristinare dal backup
    read -p "Vuoi ripristinare il database dal backup? (s/n): " RIPRISTINARE
    if [[ $RIPRISTINARE == "s" || $RIPRISTINARE == "S" ]]; then
        BACKUP_FILE="$BACKUP_DIR/refood_backup_$CURRENT_DATETIME.sql"
        echo "Ripristino dal backup $BACKUP_FILE..." | tee -a "$LOG_FILE"
        if sqlite3 "$DB_PATH" < "$BACKUP_FILE"; then
            echo "✓ Database ripristinato con successo" | tee -a "$LOG_FILE"
        else
            echo "✗ Errore nel ripristino del database" | tee -a "$LOG_FILE"
            echo "ATTENZIONE: Il database potrebbe essere in uno stato inconsistente!" | tee -a "$LOG_FILE"
        fi
        exit 1
    else
        echo "Proseguo senza ripristinare il backup" | tee -a "$LOG_FILE"
    fi
else
    echo "Output dell'esecuzione:" | tee -a "$LOG_FILE"
    cat "$EXEC_OUTPUT" | tee -a "$LOG_FILE"
fi
echo "" >> "$LOG_FILE"

# Step 4: Verifica schema dopo l'esecuzione
echo "Step 4: Verifica schema dopo l'esecuzione" | tee -a "$LOG_FILE"
if ! execute_sql "$SCHEMA_MONITOR" "$SCHEMA_AFTER"; then
    echo "✗ Errore nella verifica dello schema finale" | tee -a "$LOG_FILE"
else
    # Verifica se ci sono discrepanze dopo l'esecuzione
    DISCREPANZE_FINALI=$(grep "Trovate discrepanze" "$SCHEMA_AFTER" || echo "")
    if [ -n "$DISCREPANZE_FINALI" ]; then
        echo "⚠️ Attenzione: Ci sono discrepanze nello schema dopo l'esecuzione" | tee -a "$LOG_FILE"
        echo "Estratto da $SCHEMA_AFTER:" | tee -a "$LOG_FILE"
        grep -A20 "Trovate discrepanze" "$SCHEMA_AFTER" | head -n10 | tee -a "$LOG_FILE"
        
        # Chiedi se correggere le discrepanze
        read -p "Vuoi correggere le discrepanze? (s/n): " CORREGGERE
        if [[ $CORREGGERE == "s" || $CORREGGERE == "S" ]]; then
            echo "Correzione delle discrepanze..." | tee -a "$LOG_FILE"
            if ! execute_sql "$SCHEMA_FIX" "$LOG_DIR/fix_after_${CURRENT_DATETIME}.txt"; then
                echo "✗ Errore nella correzione delle discrepanze" | tee -a "$LOG_FILE"
            else
                echo "✓ Discrepanze corrette con successo" | tee -a "$LOG_FILE"
            fi
        fi
    else
        echo "✓ Nessuna discrepanza nello schema dopo l'esecuzione" | tee -a "$LOG_FILE"
    fi
fi

# Traccia la modifica dello schema nel database
echo "Step 5: Tracciamento della modifica nello schema" | tee -a "$LOG_FILE"
SQL_TRACK="
INSERT INTO SchemaModifiche (tabella, tipo_operazione, descrizione, dettagli, script_origine, utente)
VALUES ('MULTIPLE', 'SCRIPT', '$OP_NAME', 'Script SQL: $SQL_SCRIPT', '$(basename "$SQL_SCRIPT")', '$(whoami)');
"
if echo "$SQL_TRACK" | sqlite3 "$DB_PATH"; then
    echo "✓ Modifica tracciata con successo nel database" | tee -a "$LOG_FILE"
else
    echo "✗ Errore nel tracciamento della modifica" | tee -a "$LOG_FILE"
fi

echo "" >> "$LOG_FILE"
echo "==============================================" >> "$LOG_FILE"
echo "Operazione completata." | tee -a "$LOG_FILE"
echo "Log salvato in: $LOG_FILE"
echo "Schema prima: $SCHEMA_BEFORE"
echo "Schema dopo: $SCHEMA_AFTER"
echo "Output esecuzione: $EXEC_OUTPUT" 