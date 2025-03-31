#!/bin/bash
# Script per l'installazione delle procedure di manutenzione automatica del database ReFood
# Questo script configura cron per eseguire periodicamente le procedure di manutenzione del database

# Directory di lavoro (modificare se necessario)
WORK_DIR="/home/denny/Documenti/Tesi"
DB_PATH="$WORK_DIR/database/refood.db"
SCRIPTS_DIR="$WORK_DIR/maintenance_scripts"

# Colori per output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Verifico se la directory di script esiste, altrimenti la creo
if [ ! -d "$SCRIPTS_DIR" ]; then
    echo -e "${YELLOW}Creazione directory per gli script di manutenzione...${NC}"
    mkdir -p "$SCRIPTS_DIR"
fi

# Verifico se il database esiste
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}Errore: Database non trovato in $DB_PATH${NC}"
    echo "Verificare il percorso del database e riprovare."
    exit 1
fi

# Creo gli script di manutenzione individuali

# 1. Script per aggiornamento stato lotti (giornaliero)
cat > "$SCRIPTS_DIR/update_lotti_status.sql" << 'EOF'
-- Procedura per aggiornare lo stato dei lotti in base alla data di scadenza
BEGIN TRANSACTION;

-- Aggiorna lotti da Verde a Arancione
UPDATE Lotti
SET stato = 'Arancione', aggiornato_il = datetime('now')
WHERE stato = 'Verde'
AND date(data_scadenza, '-' || (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') || ' days') <= date('now')
AND date(data_scadenza, '-' || (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') || ' days') > date('now');

-- Inserisci log per i cambi di stato (Verde -> Arancione) con meccanismo di fallback robusto
INSERT INTO LogCambioStato (lotto_id, stato_precedente, stato_nuovo, cambiato_da)
SELECT 
    id, 
    'Verde', 
    'Arancione', 
    CASE 
        WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore') 
            THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC NULLS LAST LIMIT 1)
        WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Operatore') 
            THEN (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1)
        ELSE (SELECT COALESCE((SELECT MIN(id) FROM Attori), 1)) -- Fallback sicuro
    END
FROM Lotti 
WHERE stato = 'Arancione' 
AND aggiornato_il >= datetime('now', '-30 seconds');

-- Aggiorna lotti da Arancione a Rosso
UPDATE Lotti
SET stato = 'Rosso', aggiornato_il = datetime('now')
WHERE stato = 'Arancione'
AND date(data_scadenza, '-' || (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') || ' days') <= date('now');

-- Inserisci log per i cambi di stato (Arancione -> Rosso) con meccanismo di fallback robusto
INSERT INTO LogCambioStato (lotto_id, stato_precedente, stato_nuovo, cambiato_da)
SELECT 
    id, 
    'Arancione', 
    'Rosso', 
    CASE 
        WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore') 
            THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC NULLS LAST LIMIT 1)
        WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Operatore') 
            THEN (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1)
        ELSE (SELECT COALESCE((SELECT MIN(id) FROM Attori), 1)) -- Fallback sicuro
    END
FROM Lotti 
WHERE stato = 'Rosso' 
AND aggiornato_il >= datetime('now', '-30 seconds');

-- Seleziona il numero di lotti aggiornati per il log
SELECT 'Lotti aggiornati a Arancione: ' || changes() AS update_info;

COMMIT;

-- Log esecuzione
SELECT 'Aggiornamento stato lotti completato il ' || datetime('now') AS execution_log;
EOF

# 2. Script per pulizia token scaduti (giornaliero)
cat > "$SCRIPTS_DIR/cleanup_tokens.sql" << 'EOF'
-- Procedura per pulizia dei token scaduti
BEGIN TRANSACTION;

-- Determina un ID amministratore valido per la revoca
WITH admin_id AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore') 
                THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1)
            ELSE (SELECT COALESCE((SELECT MIN(id) FROM Attori), 1))
        END AS admin_id
)

-- Sposta i token scaduti nella tabella TokenRevocati
INSERT INTO TokenRevocati (token_hash, scadenza_originale, motivo, revocato_da)
SELECT 
    substr(access_token, 1, 100), -- Prende solo una parte del token per creare l'hash
    access_token_scadenza,
    'Scaduto automaticamente',
    (SELECT admin_id FROM admin_id)
FROM TokenAutenticazione
WHERE access_token_scadenza < datetime('now')
AND revocato = 0;

-- Marca i token come revocati nella tabella TokenAutenticazione
UPDATE TokenAutenticazione
SET revocato = 1, revocato_il = datetime('now')
WHERE access_token_scadenza < datetime('now')
AND revocato = 0;

-- Seleziona il numero di token spostati per il log
SELECT 'Token revocati: ' || changes() AS cleanup_info;

COMMIT;

-- Log esecuzione
SELECT 'Pulizia token scaduti completata il ' || datetime('now') AS execution_log;
EOF

# 3. Script per statistiche settimanali (settimanale)
cat > "$SCRIPTS_DIR/weekly_statistics.sql" << 'EOF'
-- Procedura per calcolare statistiche settimanali
BEGIN TRANSACTION;

-- Calcola la settimana e l'anno per le statistiche
-- Utilizza la settimana ISO (1-53)
WITH current_week AS (
    SELECT 
        strftime('%W', 'now') AS week_num,
        strftime('%Y', 'now') AS year
)

-- Inserisci o aggiorna le statistiche per ogni tipo di utente
INSERT INTO StatisticheSettimanali (
    tipo_utente_id, settimana, anno, quantita_salvata, 
    peso_totale_kg, co2_risparmiata_kg, valore_economico, numero_lotti
)
SELECT 
    tu.id AS tipo_utente_id,
    (SELECT week_num FROM current_week) AS settimana,
    (SELECT year FROM current_week) AS anno,
    COALESCE(SUM(l.quantita), 0) AS quantita_salvata,
    COALESCE(SUM(CASE WHEN l.unita_misura = 'kg' THEN l.quantita ELSE l.quantita * 0.5 END), 0) AS peso_totale_kg,
    COALESCE(SUM(ic.co2_risparmiata_kg), 0) AS co2_risparmiata_kg,
    COALESCE(SUM(ic.valore_economico), 0) AS valore_economico,
    COUNT(l.id) AS numero_lotti
FROM Tipo_Utente tu
LEFT JOIN Lotti l ON l.tipo_utente_origine_id = tu.id
LEFT JOIN ImpattoCO2 ic ON ic.lotto_id = l.id
WHERE (l.id IS NULL OR (l.creato_il >= date('now', 'weekday 0', '-7 days')
AND l.creato_il < date('now', 'weekday 0')))
GROUP BY tu.id
ON CONFLICT(tipo_utente_id, settimana, anno) DO UPDATE SET
    quantita_salvata = excluded.quantita_salvata,
    peso_totale_kg = excluded.peso_totale_kg,
    co2_risparmiata_kg = excluded.co2_risparmiata_kg,
    valore_economico = excluded.valore_economico,
    numero_lotti = excluded.numero_lotti;

-- Seleziona il numero di statistiche aggiornate per il log
SELECT 'Statistiche aggiornate: ' || changes() AS stats_info;

COMMIT;

-- Log esecuzione
SELECT 'Calcolo statistiche settimanali completato il ' || datetime('now') AS execution_log;
EOF

# 4. Script per aggiornamento stato prenotazioni (ogni ora)
cat > "$SCRIPTS_DIR/update_prenotazioni_status.sql" << 'EOF'
-- Procedura per aggiornare automaticamente lo stato delle prenotazioni
BEGIN TRANSACTION;

-- Determina un ID amministratore valido per le operazioni
WITH admin_id AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore') 
                THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1)
            ELSE (SELECT COALESCE((SELECT MIN(id) FROM Attori), 1))
        END AS admin_id
)

-- Marca come "Rifiutato" le prenotazioni in attesa da più di 48 ore
UPDATE Prenotazioni
SET stato = 'Rifiutato',
    note = COALESCE(note, '') || ' - Rifiutato automaticamente per timeout di attesa.',
    updated_at = datetime('now'),
    attore_id = (SELECT admin_id FROM admin_id) -- Imposta l'amministratore come autore della modifica
WHERE stato = 'InAttesa'
AND datetime(data_prenotazione, '+48 hours') <= datetime('now');

-- Aggiorna le transizioni di stato per le prenotazioni appena rifiutate
UPDATE Prenotazioni
SET transizioni_stato = CASE
    WHEN transizioni_stato IS NULL THEN json('{"transizioni": [{"da": "InAttesa", "a": "Rifiutato", "timestamp": "' || datetime('now') || '", "motivo": "Timeout automatico", "attore_id": ' || (SELECT admin_id FROM admin_id) || '}]}')
    ELSE json_insert(transizioni_stato, '$.transizioni[#]', json('{"da": "InAttesa", "a": "Rifiutato", "timestamp": "' || datetime('now') || '", "motivo": "Timeout automatico", "attore_id": ' || (SELECT admin_id FROM admin_id) || '}'))
END
WHERE stato = 'Rifiutato'
AND updated_at >= datetime('now', '-30 seconds');

-- Seleziona il numero di prenotazioni aggiornate per il log
SELECT 'Prenotazioni rifiutate automaticamente: ' || changes() AS prenotazioni_info;

COMMIT;

-- Log esecuzione
SELECT 'Aggiornamento stato prenotazioni completato il ' || datetime('now') AS execution_log;
EOF

# 5. Script per verifica integrità database (settimanale)
cat > "$SCRIPTS_DIR/db_integrity.sql" << 'EOF'
-- Procedura per verificare e correggere l'integrità referenziale del database
BEGIN TRANSACTION;

-- Variabile di log per tracciare le modifiche
CREATE TEMPORARY TABLE IF NOT EXISTS LogManutenzione (
    tabella TEXT,
    campo TEXT,
    righe_corrette INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Determina un ID amministratore valido per le correzioni
-- Strategia a cascata:
-- 1. Cerca un amministratore attivo (con accesso recente)
-- 2. Se non disponibile, prende qualsiasi amministratore
-- 3. Se non ci sono amministratori, prende un operatore
-- 4. Come ultima risorsa, usa l'ID minimo o 1
WITH admin_id AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC LIMIT 1) 
                THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC LIMIT 1)
            WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore') 
                THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1)
            WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Operatore') 
                THEN (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1)
            ELSE (SELECT COALESCE((SELECT MIN(id) FROM Attori), 1))
        END AS admin_id
)

-- 1. Correggi riferimenti non validi nella tabella LogCambioStato
UPDATE LogCambioStato 
SET cambiato_da = (SELECT admin_id FROM admin_id)
WHERE cambiato_da NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella LogCambioStato
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'LogCambioStato', 'cambiato_da', changes();

-- 2. Correggi riferimenti non validi nella tabella Prenotazioni
UPDATE Prenotazioni
SET attore_id = (SELECT admin_id FROM admin_id)
WHERE attore_id IS NOT NULL 
AND attore_id NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella Prenotazioni
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'Prenotazioni', 'attore_id', changes();

-- 3. Correggi riferimenti non validi nella tabella Lotti
UPDATE Lotti
SET inserito_da = (SELECT admin_id FROM admin_id)
WHERE inserito_da NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella Lotti
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'Lotti', 'inserito_da', changes();

-- 4. Correggi riferimenti non validi nella tabella Notifiche (destinatario)
UPDATE Notifiche
SET destinatario_id = (SELECT admin_id FROM admin_id)
WHERE destinatario_id NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella Notifiche (destinatario)
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'Notifiche', 'destinatario_id', changes();

-- 5. Correggi riferimenti non validi nella tabella Notifiche (origine)
UPDATE Notifiche
SET origine_id = (SELECT admin_id FROM admin_id)
WHERE origine_id IS NOT NULL
AND origine_id NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella Notifiche (origine)
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'Notifiche', 'origine_id', changes();

-- 6. Verifica e correggi i record in TokenRevocati
UPDATE TokenRevocati
SET revocato_da = (SELECT admin_id FROM admin_id)
WHERE revocato_da IS NOT NULL
AND revocato_da NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella TokenRevocati
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'TokenRevocati', 'revocato_da', changes();

-- 7. Verifica e correggi i record in ParametriSistema
UPDATE ParametriSistema
SET modificato_da = (SELECT admin_id FROM admin_id)
WHERE modificato_da IS NOT NULL 
AND modificato_da NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella ParametriSistema
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'ParametriSistema', 'modificato_da', changes();

-- 8. Verifica stato dei lotti in base alla data di scadenza (solo se necessario)
UPDATE Lotti
SET stato = CASE
    WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') THEN 'Rosso'
    WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') THEN 'Arancione'
    ELSE 'Verde'
END
WHERE stato != CASE
    WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') THEN 'Rosso'
    WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') THEN 'Arancione'
    ELSE 'Verde'
END;

-- Registra il numero di righe modificate nella tabella Lotti (stato)
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'Lotti', 'stato', changes();

-- Visualizza un rapporto delle correzioni effettuate
SELECT 'RAPPORTO DI MANUTENZIONE' AS Rapporto;
SELECT 'Eseguito il: ' || datetime('now') AS Esecuzione;
SELECT 'ID amministratore utilizzato: ' || (SELECT admin_id FROM admin_id) AS Amministratore;
SELECT tabella AS Tabella, campo AS Campo, righe_corrette AS 'Righe corrette' FROM LogManutenzione;
SELECT 'Totale modifiche effettuate: ' || (SELECT SUM(righe_corrette) FROM LogManutenzione) AS 'Totale correzioni';

-- Controllo finale: verifica se ci sono ancora riferimenti non validi
SELECT 'Verifica finale: riferimenti non validi rimanenti' AS Verifica;

SELECT 'LogCambioStato.cambiato_da', COUNT(*) FROM LogCambioStato WHERE cambiato_da NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Prenotazioni.attore_id', COUNT(*) FROM Prenotazioni WHERE attore_id IS NOT NULL AND attore_id NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Lotti.inserito_da', COUNT(*) FROM Lotti WHERE inserito_da NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Notifiche.destinatario_id', COUNT(*) FROM Notifiche WHERE destinatario_id NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Notifiche.origine_id', COUNT(*) FROM Notifiche WHERE origine_id IS NOT NULL AND origine_id NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'TokenRevocati.revocato_da', COUNT(*) FROM TokenRevocati WHERE revocato_da IS NOT NULL AND revocato_da NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'ParametriSistema.modificato_da', COUNT(*) FROM ParametriSistema WHERE modificato_da IS NOT NULL AND modificato_da NOT IN (SELECT id FROM Attori);

-- Alla fine, elimina la tabella temporanea di log
DROP TABLE IF EXISTS LogManutenzione;

COMMIT;

-- Log esecuzione
SELECT 'Verifica integrità database completata il ' || datetime('now') AS execution_log;
EOF

# 6. Script di shell per l'esecuzione delle procedure di manutenzione
cat > "$SCRIPTS_DIR/run_maintenance.sh" << EOF
#!/bin/bash
# Script per l'esecuzione delle procedure di manutenzione

# Impostazione variabili
DB_PATH="$DB_PATH"
SCRIPTS_DIR="$SCRIPTS_DIR"
LOG_DIR="$SCRIPTS_DIR/logs"
DATE=\$(date +%Y-%m-%d)
TIME=\$(date +%H:%M:%S)
SCRIPT_NAME=\$1
LOG_FILE="\$LOG_DIR/\${SCRIPT_NAME%.*}_\$DATE.log"

# Verifica se la directory di log esiste, altrimenti la crea
if [ ! -d "\$LOG_DIR" ]; then
    mkdir -p "\$LOG_DIR"
fi

# Verifica che il database esista
if [ ! -f "\$DB_PATH" ]; then
    echo "[\$DATE \$TIME] ERRORE: Database non trovato in \$DB_PATH" >> "\$LOG_FILE"
    exit 1
fi

# Verifica che lo script SQL esista
if [ ! -f "\$SCRIPTS_DIR/\$SCRIPT_NAME" ]; then
    echo "[\$DATE \$TIME] ERRORE: Script SQL \$SCRIPT_NAME non trovato in \$SCRIPTS_DIR" >> "\$LOG_FILE"
    exit 1
fi

# Esegue lo script SQL e registra l'output nel file di log
echo "[\$DATE \$TIME] INIZIO: Esecuzione \$SCRIPT_NAME" >> "\$LOG_FILE"
sqlite3 "\$DB_PATH" < "\$SCRIPTS_DIR/\$SCRIPT_NAME" 2>> "\$LOG_FILE"

# Verifica lo stato di uscita di sqlite3
if [ \$? -eq 0 ]; then
    echo "[\$DATE \$TIME] SUCCESSO: \$SCRIPT_NAME eseguito correttamente" >> "\$LOG_FILE"
else
    echo "[\$DATE \$TIME] ERRORE: Problemi nell'esecuzione di \$SCRIPT_NAME" >> "\$LOG_FILE"
fi

echo "[\$DATE \$TIME] FINE: Esecuzione \$SCRIPT_NAME" >> "\$LOG_FILE"
echo "-----------------------------------------------------" >> "\$LOG_FILE"
EOF

# Rendo eseguibile lo script di manutenzione
chmod +x "$SCRIPTS_DIR/run_maintenance.sh"

# Creo il file crontab temporaneo
TEMP_CRONTAB=$(mktemp)

# Esporto le variabili di cron con l'editor predefinito
echo "# Crontab per le procedure di manutenzione ReFood" > "$TEMP_CRONTAB"
echo "SHELL=/bin/bash" >> "$TEMP_CRONTAB"
echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" >> "$TEMP_CRONTAB"
echo "MAILTO=\"\"" >> "$TEMP_CRONTAB"
echo "" >> "$TEMP_CRONTAB"

# Aggiungo i job cron
echo "# Aggiornamento stato lotti (ogni giorno alle 00:10)" >> "$TEMP_CRONTAB"
echo "10 0 * * * $SCRIPTS_DIR/run_maintenance.sh update_lotti_status.sql" >> "$TEMP_CRONTAB"
echo "" >> "$TEMP_CRONTAB"

echo "# Pulizia token scaduti (ogni giorno alle 02:00)" >> "$TEMP_CRONTAB"
echo "0 2 * * * $SCRIPTS_DIR/run_maintenance.sh cleanup_tokens.sql" >> "$TEMP_CRONTAB"
echo "" >> "$TEMP_CRONTAB"

echo "# Statistiche settimanali (ogni lunedì alle 01:00)" >> "$TEMP_CRONTAB"
echo "0 1 * * 1 $SCRIPTS_DIR/run_maintenance.sh weekly_statistics.sql" >> "$TEMP_CRONTAB"
echo "" >> "$TEMP_CRONTAB"

echo "# Aggiornamento stato prenotazioni (ogni ora)" >> "$TEMP_CRONTAB"
echo "0 * * * * $SCRIPTS_DIR/run_maintenance.sh update_prenotazioni_status.sql" >> "$TEMP_CRONTAB"
echo "" >> "$TEMP_CRONTAB"

echo "# Verifica integrità database (ogni domenica alle 03:00)" >> "$TEMP_CRONTAB"
echo "0 3 * * 0 $SCRIPTS_DIR/run_maintenance.sh db_integrity.sql" >> "$TEMP_CRONTAB"

# Mostra all'utente il file crontab creato
echo -e "${GREEN}I seguenti job cron sono stati preparati:${NC}"
cat "$TEMP_CRONTAB"
echo ""

# Verifica se l'utente vuole installare i job cron
echo -e "${YELLOW}Vuoi installare questi job cron nel tuo crontab? (S/n)${NC}"
read -r response

if [[ "$response" =~ ^([sS]|[sS][iI]|[yY]|[yY][eE][sS]|"")$ ]]; then
    # Installa il crontab
    crontab "$TEMP_CRONTAB"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Job cron installati con successo!${NC}"
        echo -e "I log di esecuzione saranno salvati in: ${YELLOW}$SCRIPTS_DIR/logs/${NC}"
    else
        echo -e "${RED}Errore durante l'installazione dei job cron.${NC}"
        echo "Puoi installare manualmente il file crontab con il comando:"
        echo "crontab $TEMP_CRONTAB"
    fi
else
    echo -e "${YELLOW}Installazione cron annullata.${NC}"
    echo "Puoi installare manualmente il file crontab con il comando:"
    echo "crontab $TEMP_CRONTAB"
fi

# Esegui una verifica iniziale dell'integrità del database
echo -e "${YELLOW}Vuoi eseguire subito una verifica dell'integrità del database? (S/n)${NC}"
read -r response

if [[ "$response" =~ ^([sS]|[sS][iI]|[yY]|[yY][eE][sS]|"")$ ]]; then
    echo -e "${GREEN}Esecuzione verifica integrità database...${NC}"
    mkdir -p "$SCRIPTS_DIR/logs"
    "$SCRIPTS_DIR/run_maintenance.sh" db_integrity.sql
    echo -e "${GREEN}Verifica completata. Controlla il log in: $SCRIPTS_DIR/logs/db_integrity_$(date +%Y-%m-%d).log${NC}"
fi

# Rimuovi il file temporaneo
rm "$TEMP_CRONTAB"

echo -e "${GREEN}Configurazione completata.${NC}"
echo -e "Gli script di manutenzione sono stati creati in: ${YELLOW}$SCRIPTS_DIR/${NC}"
echo "Per modificare la schedulazione, esegui 'crontab -e'"
echo ""
echo -e "${YELLOW}Riepilogo delle procedure configurate:${NC}"
echo "1. Aggiornamento stato lotti: ogni giorno alle 00:10"
echo "2. Pulizia token scaduti: ogni giorno alle 02:00"
echo "3. Statistiche settimanali: ogni lunedì alle 01:00"
echo "4. Aggiornamento stato prenotazioni: ogni ora"
echo "5. Verifica integrità database: ogni domenica alle 03:00"
echo ""
echo -e "${GREEN}Fatto!${NC}" 