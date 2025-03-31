#!/bin/bash
# ******************************************************************
# SCRIPT DI INSTALLAZIONE DEL SISTEMA DI MONITORAGGIO DELLO SCHEMA
# ******************************************************************
# Questo script installa e configura il sistema di monitoraggio dello schema,
# integrandolo con il sistema di manutenzione automatica esistente.

# Configurazione
DB_PATH="/home/denny/Documenti/Tesi/database/refood.db"
MAINTENANCE_DIR="/home/denny/Documenti/Tesi/maintenance_scripts"
LOGS_DIR="/home/denny/Documenti/Tesi/logs"
BACKUP_DIR="/home/denny/Documenti/Tesi/backup"
CURRENT_DIR=$(dirname "$(readlink -f "$0")")
SCHEMA_MONITOR="$CURRENT_DIR/schema_monitor.sql"
SCHEMA_FIX="$CURRENT_DIR/schema_fix.sql"
SAFE_EXEC="$CURRENT_DIR/safe_schema_exec.sh"

# Stampa intestazione
echo "====================================================="
echo "  INSTALLAZIONE SISTEMA MONITORAGGIO SCHEMA REFOOD"
echo "====================================================="
echo ""

# Crea directory se non esistono
echo "Creazione directory necessarie..."
mkdir -p "$MAINTENANCE_DIR"
mkdir -p "$LOGS_DIR"
mkdir -p "$BACKUP_DIR"
echo "✓ Directory create"
echo ""

# Verifica se i file di monitoraggio schema esistono
if [ ! -f "$SCHEMA_MONITOR" ] || [ ! -f "$SCHEMA_FIX" ] || [ ! -f "$SAFE_EXEC" ]; then
    echo "✗ Errore: Uno o più script necessari non sono presenti:"
    [ ! -f "$SCHEMA_MONITOR" ] && echo "- $SCHEMA_MONITOR non trovato"
    [ ! -f "$SCHEMA_FIX" ] && echo "- $SCHEMA_FIX non trovato"
    [ ! -f "$SAFE_EXEC" ] && echo "- $SAFE_EXEC non trovato"
    exit 1
fi

# Rendi eseguibili gli script
echo "Impostazione permessi di esecuzione..."
chmod +x "$SAFE_EXEC"
echo "✓ Permessi impostati"
echo ""

# Verifica se il database esiste
if [ ! -f "$DB_PATH" ]; then
    echo "✗ Errore: Database non trovato in $DB_PATH"
    echo "Assicurati che il database esista prima di installare il sistema di monitoraggio."
    exit 1
fi

# Verifica esistenza tabella SchemaModifiche nel database
echo "Verifica stato attuale database..."
SCHEMA_TABELLE=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('SchemaRiferimento', 'SchemaDiscrepanze', 'SchemaModifiche');")

if [[ $SCHEMA_TABELLE == *"SchemaRiferimento"* && $SCHEMA_TABELLE == *"SchemaDiscrepanze"* && $SCHEMA_TABELLE == *"SchemaModifiche"* ]]; then
    echo "Le tabelle di monitoraggio schema già esistono nel database."
    read -p "Vuoi reinizializzarle? (s/n, default: n): " REINIT
    if [[ $REINIT == "s" || $REINIT == "S" ]]; then
        echo "Eliminazione tabelle esistenti..."
        sqlite3 "$DB_PATH" "DROP TABLE IF EXISTS SchemaDiscrepanze; DROP TABLE IF EXISTS SchemaModifiche; DROP TABLE IF EXISTS SchemaRiferimento;"
        echo "✓ Tabelle eliminate"
    else
        echo "Mantengo le tabelle esistenti."
    fi
else
    echo "Tabelle di monitoraggio schema non presenti nel database."
fi

# Inizializzazione sistema di monitoraggio
echo ""
echo "Inizializzazione sistema di monitoraggio schema..."
if sqlite3 "$DB_PATH" < "$SCHEMA_MONITOR" > "$LOGS_DIR/schema_init.log" 2>&1; then
    echo "✓ Sistema di monitoraggio schema inizializzato"
    echo "  Log: $LOGS_DIR/schema_init.log"
else
    echo "✗ Errore nell'inizializzazione del sistema di monitoraggio"
    echo "  Consulta il log: $LOGS_DIR/schema_init.log"
    exit 1
fi

# Creazione script di verifica schema periodica
echo ""
echo "Creazione script di verifica schema periodica..."
VERIFY_SCRIPT="$MAINTENANCE_DIR/verify_schema.sh"

cat > "$VERIFY_SCRIPT" << 'EOL'
#!/bin/bash
# Script di verifica periodica dello schema
DB_PATH="$1"
SCHEMA_MONITOR="$2"
SCHEMA_FIX="$3"
LOGS_DIR="$4"
CURRENT_DATE=$(date +"%Y%m%d")

# Verifica parametri
if [ -z "$DB_PATH" ] || [ -z "$SCHEMA_MONITOR" ] || [ -z "$SCHEMA_FIX" ] || [ -z "$LOGS_DIR" ]; then
    echo "Errore: parametri mancanti."
    echo "Uso: $0 <db_path> <schema_monitor_sql> <schema_fix_sql> <logs_dir>"
    exit 1
fi

# Crea directory log se non esiste
mkdir -p "$LOGS_DIR"

# File di log
LOG_FILE="$LOGS_DIR/schema_verify_${CURRENT_DATE}.log"

echo "===== VERIFICA PERIODICA SCHEMA DATABASE =====" > "$LOG_FILE"
echo "Data: $(date)" >> "$LOG_FILE"
echo "Database: $DB_PATH" >> "$LOG_FILE"
echo "==========================================" >> "$LOG_FILE"

# Esegui verifica schema
if sqlite3 "$DB_PATH" < "$SCHEMA_MONITOR" > "$LOGS_DIR/schema_result_${CURRENT_DATE}.txt" 2>&1; then
    echo "Verifica schema completata con successo" >> "$LOG_FILE"
    
    # Controlla se ci sono discrepanze
    if grep -q "Trovate discrepanze" "$LOGS_DIR/schema_result_${CURRENT_DATE}.txt"; then
        echo "ATTENZIONE: Rilevate discrepanze nello schema!" >> "$LOG_FILE"
        grep -A20 "Trovate discrepanze" "$LOGS_DIR/schema_result_${CURRENT_DATE}.txt" >> "$LOG_FILE"
        
        # Esegui correzione automatica
        echo "Esecuzione correzione automatica..." >> "$LOG_FILE"
        if sqlite3 "$DB_PATH" < "$SCHEMA_FIX" > "$LOGS_DIR/schema_fix_${CURRENT_DATE}.txt" 2>&1; then
            echo "Correzione automatica completata con successo" >> "$LOG_FILE"
            
            # Notifica all'amministratore
            echo "ATTENZIONE: Discrepanze nello schema sono state rilevate e corrette automaticamente." > "/tmp/schema_alert_${CURRENT_DATE}.txt"
            echo "Consultare i log in $LOGS_DIR per dettagli." >> "/tmp/schema_alert_${CURRENT_DATE}.txt"
            
            # Qui potresti aggiungere codice per inviare una email o altra notifica
        else
            echo "ERRORE nella correzione automatica!" >> "$LOG_FILE"
        fi
    else
        echo "Nessuna discrepanza rilevata. Schema valido." >> "$LOG_FILE"
    fi
else
    echo "ERRORE nella verifica dello schema!" >> "$LOG_FILE"
fi

echo "==========================================" >> "$LOG_FILE"
EOL

# Sostituisci i valori segnaposto con i percorsi effettivi
sed -i "s|\$1|$DB_PATH|g" "$VERIFY_SCRIPT"
sed -i "s|\$2|$SCHEMA_MONITOR|g" "$VERIFY_SCRIPT"
sed -i "s|\$3|$SCHEMA_FIX|g" "$VERIFY_SCRIPT"
sed -i "s|\$4|$LOGS_DIR|g" "$VERIFY_SCRIPT"

# Rendi eseguibile lo script di verifica
chmod +x "$VERIFY_SCRIPT"
echo "✓ Script di verifica creato: $VERIFY_SCRIPT"

# Aggiunta alla crontab se richiesto
echo ""
read -p "Vuoi aggiungere la verifica periodica dello schema al crontab? (s/n, default: s): " ADD_CRON
if [[ "$ADD_CRON" != "n" && "$ADD_CRON" != "N" ]]; then
    # Verifica se il cron job esiste già
    CRON_CHECK=$(crontab -l 2>/dev/null | grep -c "verify_schema.sh")
    
    if [ "$CRON_CHECK" -gt 0 ]; then
        echo "Il cron job per la verifica dello schema è già presente."
    else
        # Aggiungi al crontab - ogni domenica alle 2:30
        (crontab -l 2>/dev/null; echo "30 2 * * 0 $VERIFY_SCRIPT > /dev/null 2>&1") | crontab -
        echo "✓ Verifica schema aggiunta al crontab (esecuzione ogni domenica alle 2:30)"
    fi
else
    echo "Verifica schema non aggiunta al crontab."
fi

# Integrazione con sistema di manutenzione esistente
echo ""
echo "Integrazione con il sistema di manutenzione esistente..."

# Verifica se lo script di integrità db esiste
DB_INTEGRITY_SCRIPT="$MAINTENANCE_DIR/db_integrity.sql"
if [ -f "$DB_INTEGRITY_SCRIPT" ]; then
    echo "Modifico lo script db_integrity.sql per includere la verifica dello schema..."
    
    # Crea un backup dello script originale
    cp "$DB_INTEGRITY_SCRIPT" "${DB_INTEGRITY_SCRIPT}.bak"
    
    # Aggiungi la verifica dello schema allo script di integrità
    cat >> "$DB_INTEGRITY_SCRIPT" << EOL

-- ******************************************************************
-- VERIFICA SCHEMA DATABASE
-- ******************************************************************
-- Questa sezione è stata aggiunta automaticamente per integrare
-- la verifica dello schema con il controllo di integrità

-- Esegui verifica dello schema
ATTACH DATABASE '${DB_PATH}' AS schema_check;

-- Riporta eventuali discrepanze rilevate
SELECT '-- VERIFICA SCHEMA DATABASE --' AS message;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM schema_check.SchemaDiscrepanze WHERE corretta = 0) 
        THEN 'ATTENZIONE: Sono state rilevate discrepanze nello schema del database!'
        ELSE 'Schema database valido. Nessuna discrepanza rilevata.'
    END AS result;

-- Mostra le discrepanze non corrette
SELECT 'Elenco discrepanze:' AS message WHERE EXISTS (SELECT 1 FROM schema_check.SchemaDiscrepanze WHERE corretta = 0);
SELECT 
    'Tabella: ' || tabella || ', Colonna: ' || colonna || ', Tipo: ' || tipo_discrepanza
FROM 
    schema_check.SchemaDiscrepanze
WHERE 
    corretta = 0
ORDER BY
    data_rilevamento DESC;

DETACH DATABASE schema_check;
EOL
    
    echo "✓ Script db_integrity.sql aggiornato"
else
    echo "Script db_integrity.sql non trovato in $MAINTENANCE_DIR"
    echo "Verifica dello schema non integrata con la verifica di integrità."
fi

# Creazione di uno script wrapper per la modifica sicura degli schemi
echo ""
echo "Creazione di un alias per l'esecuzione sicura di script SQL..."

# Aggiungi alias al bashrc dell'utente
ALIAS_CHECK=$(grep -c "safe_sql_exec" ~/.bashrc)
if [ "$ALIAS_CHECK" -eq 0 ]; then
    echo "# Alias per eseguire script SQL in modo sicuro" >> ~/.bashrc
    echo "alias safe_sql_exec='$SAFE_EXEC'" >> ~/.bashrc
    echo "✓ Alias 'safe_sql_exec' aggiunto al file ~/.bashrc"
    echo "  Riavvia la shell o esegui 'source ~/.bashrc' per utilizzarlo"
else
    echo "L'alias 'safe_sql_exec' è già presente nel file ~/.bashrc"
fi

# Verifica e ripara lo schema corrente se necessario
echo ""
echo "Verifico lo schema attuale del database..."
if sqlite3 "$DB_PATH" < "$SCHEMA_MONITOR" > "$LOGS_DIR/schema_initial_check.log" 2>&1; then
    if grep -q "Trovate discrepanze" "$LOGS_DIR/schema_initial_check.log"; then
        echo "⚠️ ATTENZIONE: Rilevate discrepanze nello schema attuale!"
        grep -A10 "Trovate discrepanze" "$LOGS_DIR/schema_initial_check.log" | head -n5
        
        read -p "Vuoi correggere ora le discrepanze? (s/n, default: s): " FIX_NOW
        if [[ "$FIX_NOW" != "n" && "$FIX_NOW" != "N" ]]; then
            echo "Correzione delle discrepanze in corso..."
            if sqlite3 "$DB_PATH" < "$SCHEMA_FIX" > "$LOGS_DIR/schema_initial_fix.log" 2>&1; then
                echo "✓ Discrepanze corrette con successo"
                echo "  Log: $LOGS_DIR/schema_initial_fix.log"
            else
                echo "✗ Errore nella correzione delle discrepanze"
                echo "  Consulta il log: $LOGS_DIR/schema_initial_fix.log"
            fi
        else
            echo "Discrepanze non corrette. Puoi farlo in seguito con:"
            echo "  $SAFE_EXEC $SCHEMA_FIX correggi_schema"
        fi
    else
        echo "✓ Schema attuale valido. Nessuna discrepanza rilevata."
    fi
else
    echo "✗ Errore nella verifica dello schema attuale"
    echo "  Consulta il log: $LOGS_DIR/schema_initial_check.log"
fi

# Riepilogo finale
echo ""
echo "====================================================="
echo "  INSTALLAZIONE COMPLETATA"
echo "====================================================="
echo ""
echo "Il sistema di monitoraggio dello schema è stato installato e configurato:"
echo "  - Tabelle di monitoraggio schema inizializzate"
echo "  - Script di verifica periodica: $VERIFY_SCRIPT"
echo "  - Script per esecuzione sicura: $SAFE_EXEC"
echo ""
echo "Per eseguire script SQL in modo sicuro, usa:"
echo "  $SAFE_EXEC <script_sql> [nome_operazione]"
echo ""
echo "Per verificare manualmente lo schema:"
echo "  sqlite3 $DB_PATH < $SCHEMA_MONITOR"
echo ""
echo "Per correggere manualmente le discrepanze:"
echo "  sqlite3 $DB_PATH < $SCHEMA_FIX"
echo ""
echo "Log e rapporti sono salvati in: $LOGS_DIR"
echo "=====================================================" 