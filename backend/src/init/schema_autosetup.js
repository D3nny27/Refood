/**
 * Configurazione Automatica del Sistema di Monitoraggio Schema ReFood
 * -------------------------------------------------------------
 * Questo modulo si occupa di installare e configurare automaticamente 
 * il sistema di monitoraggio dello schema database alla prima esecuzione
 * dell'applicazione.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const db = require('../config/database');
const config = require('../config/config');
const logger = require('../utils/logger');
const os = require('os'); // Aggiungo il modulo os per verificare il sistema operativo

const execPromise = promisify(exec);

// Determina il sistema operativo
const isWindows = os.platform() === 'win32';

// Percorsi dei file di configurazione
const ROOT_DIR = path.resolve(__dirname, '../../../');
const SCHEMA_MONITOR_SQL = path.join(ROOT_DIR, 'schema_monitor.sql');
const SCHEMA_FIX_SQL = path.join(ROOT_DIR, 'schema_fix.sql');
const SAFE_SCHEMA_EXEC = path.join(ROOT_DIR, 'safe_schema_exec.sh');
const MAINTENANCE_DIR = path.join(ROOT_DIR, 'maintenance_scripts');
const LOGS_DIR = path.join(MAINTENANCE_DIR, 'logs');
const BACKUP_DIR = path.join(ROOT_DIR, 'backup');

// Percorso script di verifica (specifico per piattaforma)
const VERIFY_SCRIPT_PATH = isWindows 
  ? path.join(MAINTENANCE_DIR, 'verify_schema.bat')
  : path.join(MAINTENANCE_DIR, 'verify_schema.sh');

/**
 * Verifica se il sistema di monitoraggio è già configurato
 * @returns {Promise<boolean>} true se è già configurato, false altrimenti
 */
async function isMonitoringSystemConfigured() {
  try {
    // Controlla se le tabelle di monitoraggio schema esistono
    const schemaRiferimentoExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='SchemaRiferimento'"
    );
    
    return !!schemaRiferimentoExists;
  } catch (error) {
    logger.error(`Errore nella verifica del sistema di monitoraggio: ${error.message}`);
    return false;
  }
}

/**
 * Crea le directory necessarie se non esistono
 */
async function createDirectories() {
  try {
    const directories = [MAINTENANCE_DIR, LOGS_DIR, BACKUP_DIR];
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Directory creata: ${dir}`);
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Errore nella creazione delle directory: ${error.message}`);
    return false;
  }
}

/**
 * Imposta i file di monitoraggio schema
 */
async function setupMonitoringFiles() {
  try {
    // Controlla se i file di monitoraggio esistono già
    if (!fs.existsSync(SCHEMA_MONITOR_SQL) || !fs.existsSync(SCHEMA_FIX_SQL)) {
      logger.info('Creazione dei file di monitoraggio schema...');
      
      // Crea lo script schema_monitor.sql se non esiste
      if (!fs.existsSync(SCHEMA_MONITOR_SQL)) {
        // Contenuto base del file schema_monitor.sql (versione semplificata)
        const schemaMonitorContent = `-- ******************************************************************
-- SISTEMA DI MONITORAGGIO DELLO SCHEMA DATABASE REFOOD
-- ******************************************************************
-- Generato automaticamente alla prima esecuzione dell'applicazione

-- Creazione tabella per la memorizzazione dello schema di riferimento
CREATE TABLE IF NOT EXISTS SchemaRiferimento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tabella TEXT NOT NULL,
    colonna TEXT NOT NULL,
    tipo TEXT NOT NULL,
    not_null INTEGER NOT NULL DEFAULT 0,
    valore_default TEXT,
    primary_key INTEGER NOT NULL DEFAULT 0,
    versione INTEGER NOT NULL,
    ultimo_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tabella, colonna, versione)
);

-- Creazione tabella per registrare le discrepanze rilevate
CREATE TABLE IF NOT EXISTS SchemaDiscrepanze (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_rilevamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tabella TEXT NOT NULL,
    colonna TEXT,
    tipo_discrepanza TEXT NOT NULL, -- 'MANCANTE', 'TIPO_ERRATO', 'NULL_DIVERSO', ecc.
    valore_atteso TEXT,
    valore_rilevato TEXT,
    corretta INTEGER NOT NULL DEFAULT 0,
    data_correzione TIMESTAMP
);

-- Creazione tabella per registrare le modifiche allo schema
CREATE TABLE IF NOT EXISTS SchemaModifiche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_modifica TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tabella TEXT NOT NULL,
    tipo_operazione TEXT NOT NULL, -- 'CREATE', 'ALTER', 'DROP', ecc.
    descrizione TEXT NOT NULL,
    dettagli TEXT,
    script_origine TEXT, -- Se la modifica proviene da uno script, nome dello script
    utente TEXT -- Se disponibile, utente che ha avviato lo script di modifica
);

-- Verifica delle discrepanze (inserire lo schema atteso delle tabelle principali)
WITH current_schema AS (
    -- Estrai lo schema attuale del database
    SELECT 
        m.tbl_name AS tabella,
        p.name AS colonna,
        p.type AS tipo,
        p."notnull" AS not_null,
        p.dflt_value AS valore_default,
        p.pk AS primary_key
    FROM 
        sqlite_master m
    JOIN 
        pragma_table_info(m.tbl_name) p
    WHERE 
        m.type = 'table'
        AND m.tbl_name NOT LIKE 'sqlite_%'
        AND m.tbl_name NOT IN ('SchemaRiferimento', 'SchemaDiscrepanze', 'SchemaModifiche')
)
SELECT 'Schema monitorato automaticamente' AS info;
`;
        fs.writeFileSync(SCHEMA_MONITOR_SQL, schemaMonitorContent);
        logger.info(`File creato: ${SCHEMA_MONITOR_SQL}`);
      }
      
      // Crea lo script schema_fix.sql se non esiste
      if (!fs.existsSync(SCHEMA_FIX_SQL)) {
        // Contenuto base del file schema_fix.sql (versione semplificata)
        const schemaFixContent = `-- ******************************************************************
-- SCRIPT DI CORREZIONE AUTOMATICA DELLO SCHEMA DATABASE REFOOD
-- ******************************************************************
-- Generato automaticamente alla prima esecuzione dell'applicazione

BEGIN TRANSACTION;

-- Log delle correzioni
CREATE TEMP TABLE IF NOT EXISTS FixLog (
    evento TEXT,
    dettagli TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO FixLog (evento, dettagli) VALUES ('INIZIO', 'Avvio script di correzione automatica dello schema');

-- Ottiene l'elenco delle discrepanze da correggere
CREATE TEMP TABLE IF NOT EXISTS DiscrepanzeDaCorreggere AS
SELECT id, tabella, colonna, tipo_discrepanza, valore_atteso, valore_rilevato
FROM SchemaDiscrepanze
WHERE corretta = 0
ORDER BY tabella, colonna;

-- Correzioni specifiche per tabelle note
-- Aggiunta campo prezzo se mancante
SELECT CASE 
    WHEN EXISTS (
        SELECT 1 FROM DiscrepanzeDaCorreggere 
        WHERE tabella = 'Lotti' AND colonna = 'prezzo' AND tipo_discrepanza = 'COLONNA_MANCANTE'
    ) THEN (
        ALTER TABLE Lotti ADD COLUMN prezzo REAL DEFAULT NULL;
        UPDATE SchemaDiscrepanze SET corretta = 1, data_correzione = datetime('now')
        WHERE tabella = 'Lotti' AND colonna = 'prezzo' AND tipo_discrepanza = 'COLONNA_MANCANTE';
        INSERT INTO SchemaModifiche (tabella, tipo_operazione, descrizione, dettagli, script_origine)
        VALUES ('Lotti', 'ALTER', 'Aggiunta colonna mancante', 'Colonna: prezzo, Tipo: REAL', 'schema_fix.sql');
        SELECT 'Colonna prezzo aggiunta alla tabella Lotti'
    )
    ELSE 'Colonna prezzo già presente o non necessaria'
END;

-- Stampa report finale
SELECT 'REPORT DI CORREZIONE DELLO SCHEMA' AS Titolo;
SELECT 'Timestamp esecuzione: ' || datetime('now') AS Timestamp;
SELECT * FROM FixLog ORDER BY timestamp;

-- Pulizia tabelle temporanee
DROP TABLE IF EXISTS FixLog;
DROP TABLE IF EXISTS DiscrepanzeDaCorreggere;

COMMIT;
`;
        fs.writeFileSync(SCHEMA_FIX_SQL, schemaFixContent);
        logger.info(`File creato: ${SCHEMA_FIX_SQL}`);
      }
      
      // Crea lo script safe_schema_exec.sh se non esiste
      if (!fs.existsSync(SAFE_SCHEMA_EXEC)) {
        const dbPath = path.join(ROOT_DIR, 'database/refood.db');
        
        // Contenuto del file safe_schema_exec.sh con stringhe JavaScript
        const safeSchemaExecContent = `#!/bin/bash
# Script per l'esecuzione sicura di modifiche allo schema del database
# Generato automaticamente alla prima esecuzione dell'applicazione

# Configurazione
DB_PATH="${dbPath}"
BACKUP_DIR="${BACKUP_DIR}"
SCHEMA_MONITOR="${SCHEMA_MONITOR_SQL}"
SCHEMA_FIX="${SCHEMA_FIX_SQL}"
LOG_DIR="${LOGS_DIR}"

# Controllo parametri
if [ "$#" -lt 1 ]; then
    echo "Uso: $0 script.sql [descrizione]"
    exit 1
fi

SCRIPT_FILE="$1"
DESCRIPTION="\${2:-Modifica schema}"
TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/refood_pre_schema_mod_\$TIMESTAMP.db"
LOG_FILE="$LOG_DIR/schema_mod_\$TIMESTAMP.log"

# Creazione directory se non esistono
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"

# Backup del database
echo "Creazione backup in \$BACKUP_FILE" | tee -a "\$LOG_FILE"
cp "$DB_PATH" "\$BACKUP_FILE"

# Verifica dello schema prima dell'esecuzione
echo "Verifica schema pre-esecuzione" | tee -a "\$LOG_FILE"
sqlite3 "$DB_PATH" < "$SCHEMA_MONITOR" | tee -a "\$LOG_FILE"

# Esecuzione dello script di modifica
echo "Esecuzione script \$SCRIPT_FILE" | tee -a "\$LOG_FILE"
sqlite3 "$DB_PATH" < "\$SCRIPT_FILE" 2>&1 | tee -a "\$LOG_FILE"

# Verifica dello schema dopo l'esecuzione
echo "Verifica schema post-esecuzione" | tee -a "\$LOG_FILE"
sqlite3 "$DB_PATH" < "$SCHEMA_MONITOR" | tee -a "\$LOG_FILE"

# Registra la modifica
echo "Registrazione modifica nel registro" | tee -a "\$LOG_FILE"
sqlite3 "$DB_PATH" "INSERT INTO SchemaModifiche (tabella, tipo_operazione, descrizione, dettagli, script_origine) VALUES ('MULTIPLA', 'SCRIPT', '\$DESCRIPTION', 'Esecuzione script \$SCRIPT_FILE', '\$(basename "\$SCRIPT_FILE")')"

echo "Modifica completata con successo, log disponibile in \$LOG_FILE"
`;
        fs.writeFileSync(SAFE_SCHEMA_EXEC, safeSchemaExecContent);
        fs.chmodSync(SAFE_SCHEMA_EXEC, '755'); // Rendi eseguibile lo script
        logger.info(`File creato: ${SAFE_SCHEMA_EXEC}`);
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Errore nella configurazione dei file di monitoraggio: ${error.message}`);
    return false;
  }
}

/**
 * Inizializza il sistema di monitoraggio schema
 */
async function initializeMonitoringSystem() {
  try {
    // Esegui lo script di monitoraggio schema
    logger.info('Inizializzazione del sistema di monitoraggio schema...');
    
    // Esegui lo script schema_monitor.sql
    await db.exec(fs.readFileSync(SCHEMA_MONITOR_SQL, 'utf8'));
    logger.info('Sistema di monitoraggio schema inizializzato con successo');
    
    // Popolamento dei dati di riferimento per le tabelle principali
    await populateReferenceSchema();
    
    return true;
  } catch (error) {
    logger.error(`Errore nell'inizializzazione del sistema di monitoraggio: ${error.message}`);
    return false;
  }
}

/**
 * Popola lo schema di riferimento con lo schema attuale delle tabelle
 */
async function populateReferenceSchema() {
  try {
    // Ottieni l'elenco delle tabelle
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('SchemaRiferimento', 'SchemaDiscrepanze', 'SchemaModifiche')");
    
    // Per ogni tabella, estrai lo schema e inseriscilo nella tabella SchemaRiferimento
    for (const table of tables) {
      const columns = await db.all(`PRAGMA table_info(${table.name})`);
      
      for (const column of columns) {
        // Inserisci i dati dello schema nella tabella SchemaRiferimento
        await db.run(
          'INSERT OR IGNORE INTO SchemaRiferimento (tabella, colonna, tipo, not_null, valore_default, primary_key, versione) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [table.name, column.name, column.type, column.notnull, column.dflt_value, column.pk, 1]
        );
      }
      
      logger.info(`Schema della tabella ${table.name} memorizzato`);
    }
    
    return true;
  } catch (error) {
    logger.error(`Errore nel popolamento dello schema di riferimento: ${error.message}`);
    return false;
  }
}

/**
 * Configura il job cron per la verifica periodica dello schema
 */
async function setupCronJob() {
  try {
    // Crea il file di verifica schema
    const dbPath = path.join(ROOT_DIR, 'database/refood.db');
    
    if (isWindows) {
      // Configurazione Task Scheduler per Windows
      if (!fs.existsSync(VERIFY_SCRIPT_PATH)) {
        // Crea lo script batch di verifica
        const verifyScriptContent = `@echo off
setlocal
set DB_PATH=${dbPath.replace(/\\/g, '\\\\')}
set LOG_DIR=${LOGS_DIR.replace(/\\/g, '\\\\')}
set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set LOG_FILE=%LOG_DIR%\\schema_verify_%TIMESTAMP%.log

echo Avvio verifica schema database [%date% %time%] > %LOG_FILE%
sqlite3 %DB_PATH% ".schema" >> %LOG_FILE% 2>&1

REM Verifica se ci sono discrepanze (implementabile con query specifiche)
echo Verifica schema completata [%date% %time%] >> %LOG_FILE%
endlocal`;

        fs.writeFileSync(VERIFY_SCRIPT_PATH, verifyScriptContent);
        logger.info(`File creato: ${VERIFY_SCRIPT_PATH}`);
      }

      // Tentativo di configurare Task Scheduler
      try {
        // Genera un file XML temporaneo per la definizione dell'attività
        const taskName = 'Refood_Schema_Monitor';
        const taskXmlPath = path.join(ROOT_DIR, 'task_config.xml');
        const taskXmlContent = `<?xml version="1.0"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Monitora lo schema del database Refood</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2022-01-01T02:30:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByWeek>
        <WeeksInterval>1</WeeksInterval>
        <DaysOfWeek>
          <Sunday />
        </DaysOfWeek>
      </ScheduleByWeek>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${VERIFY_SCRIPT_PATH.replace(/\\/g, '\\\\')}</Command>
      <WorkingDirectory>${MAINTENANCE_DIR.replace(/\\/g, '\\\\')}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`;

        fs.writeFileSync(taskXmlPath, taskXmlContent);
        
        // Prova a creare l'attività pianificata
        await execPromise(`schtasks /create /tn "${taskName}" /xml "${taskXmlPath}" /f`);
        
        // Rimuovi il file XML temporaneo
        if (fs.existsSync(taskXmlPath)) {
          fs.unlinkSync(taskXmlPath);
        }
        
        logger.info('Task Scheduler configurato con successo per il monitoraggio dello schema');
      } catch (error) {
        logger.error(`Impossibile configurare Task Scheduler: ${error.message}`);
        logger.info('Puoi configurare manualmente Task Scheduler per eseguire il file: ' + VERIFY_SCRIPT_PATH);
      }
    } else {
      // Configurazione cron per Linux/macOS
      if (!fs.existsSync(VERIFY_SCRIPT_PATH)) {
        const verifyScriptContent = `#!/bin/bash
# Script di verifica periodica dello schema database
# Generato automaticamente alla prima esecuzione dell'applicazione

# Configurazione
DB_PATH="${dbPath}"
SCHEMA_MONITOR="${SCHEMA_MONITOR_SQL}"
SCHEMA_FIX="${SCHEMA_FIX_SQL}"
LOG_DIR="${LOGS_DIR}"

# Timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/schema_verify_$TIMESTAMP.log"

# Creazione directory log
mkdir -p "$LOG_DIR"

echo "$(date): Avvio verifica schema database" | tee -a "$LOG_FILE"

# Verifica dello schema
RISULTATO=$(sqlite3 "$DB_PATH" < "$SCHEMA_MONITOR" 2>&1)
echo "$RISULTATO" | tee -a "$LOG_FILE"

# Controlla se ci sono discrepanze
if echo "$RISULTATO" | grep -q "Trovate discrepanze"; then
  echo "$(date): Rilevate discrepanze nello schema. Avvio correzione automatica." | tee -a "$LOG_FILE"
  
  # Esegui lo script di correzione
  sqlite3 "$DB_PATH" < "$SCHEMA_FIX" 2>&1 | tee -a "$LOG_FILE"
  
  # Notifica amministratore
  echo "$(date): Notifica correzione schema inviata all'amministratore" | tee -a "$LOG_FILE"
  
  # Qui potrebbe essere implementata una notifica via email o altro sistema
else
  echo "$(date): Nessuna discrepanza rilevata nello schema" | tee -a "$LOG_FILE"
fi

echo "$(date): Verifica schema completata" | tee -a "$LOG_FILE"`;

        fs.writeFileSync(VERIFY_SCRIPT_PATH, verifyScriptContent);
        fs.chmodSync(VERIFY_SCRIPT_PATH, '755'); // Rendi eseguibile lo script
        logger.info(`File creato: ${VERIFY_SCRIPT_PATH}`);
      }
    
      // Configurazione crontab (solo per Linux/macOS)
      try {
        // Controlla se il cron job esiste già (tenta di non duplicare i job)
        const cronExists = await execPromise('crontab -l | grep verify_schema.sh || echo "no cron"')
          .then(({ stdout }) => !stdout.includes('no cron'))
          .catch(() => false);
      
        if (!cronExists) {
          // Aggiungi il job cron per l'esecuzione settimanale
          const tmpCronFile = path.join(ROOT_DIR, 'tmp_cron');
          await execPromise('crontab -l > ' + tmpCronFile + ' 2>/dev/null || echo "" > ' + tmpCronFile);
          
          // Aggiungi il job cron: ogni domenica alle 2:30 AM
          fs.appendFileSync(tmpCronFile, `30 2 * * 0 ${VERIFY_SCRIPT_PATH} >> ${LOGS_DIR}/cron_verify_schema.log 2>&1\n`);
          
          await execPromise('crontab ' + tmpCronFile);
          fs.unlinkSync(tmpCronFile);
          
          logger.info('Job cron per la verifica dello schema configurato con successo');
        } else {
          logger.info('Job cron per la verifica dello schema già configurato');
        }
      } catch (error) {
        logger.error(`Errore nella configurazione del job cron: ${error.message}`);
        logger.info('Puoi configurare manualmente il cron job con: crontab -e');
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Errore nella configurazione del job di monitoraggio: ${error.message}`);
    return false;
  }
}

/**
 * Funzione principale per la configurazione automatica del sistema di monitoraggio
 */
async function configureMonitoringSystem() {
  try {
    // Verifica se il sistema è già configurato
    const isConfigured = await isMonitoringSystemConfigured();
    
    if (isConfigured) {
      logger.info('Il sistema di monitoraggio schema è già configurato');
      return true;
    }
    
    logger.info('Avvio configurazione automatica del sistema di monitoraggio schema...');
    
    // Crea le directory necessarie
    await createDirectories();
    
    // Configura i file di monitoraggio
    await setupMonitoringFiles();
    
    // Inizializza il sistema di monitoraggio
    await initializeMonitoringSystem();
    
    // Configura il job cron per la verifica periodica
    if (process.env.NODE_ENV !== 'development') {
      // In ambiente di produzione configura il cron job
      await setupCronJob();
    } else {
      logger.info('Configurazione cron job saltata in ambiente di sviluppo');
    }
    
    logger.info('Configurazione automatica del sistema di monitoraggio schema completata con successo');
    return true;
  } catch (error) {
    logger.error(`Errore nella configurazione del sistema di monitoraggio: ${error.message}`);
    return false;
  }
}

// Esporta la funzione principale
module.exports = {
  configureMonitoringSystem
}; 