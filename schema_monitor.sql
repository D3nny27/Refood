-- ******************************************************************
-- SISTEMA DI MONITORAGGIO DELLO SCHEMA DATABASE REFOOD
-- ******************************************************************
-- Questo script verifica che lo schema del database corrisponda a quello atteso
-- e identifica eventuali discrepanze (colonne mancanti, tabelle alterate, ecc.)

-- Creazione tabella per la memorizzazione dello schema di riferimento
CREATE TABLE IF NOT EXISTS SchemaRiferimento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tabella TEXT NOT NULL,
    colonna TEXT NOT NULL,
    tipo TEXT NOT NULL,
    not_null INTEGER NOT NULL DEFAULT 0,
    valore_default TEXT,
    primary_key INTEGER NOT NULL DEFAULT 0,
    versione INTEGER NOT NULL,  -- Versione dello schema
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

-- Popolazione della tabella SchemaRiferimento con lo schema atteso
-- Solo se non esiste già una versione dello schema di riferimento
INSERT OR IGNORE INTO SchemaRiferimento (tabella, colonna, tipo, not_null, valore_default, primary_key, versione)
SELECT 'Versione', 'versione', 'INTEGER', 1, NULL, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM SchemaRiferimento WHERE versione = 1);

-- Definizione schema tabella Lotti (Versione 1)
INSERT OR IGNORE INTO SchemaRiferimento (tabella, colonna, tipo, not_null, valore_default, primary_key, versione)
VALUES
    ('Lotti', 'id', 'INTEGER', 1, NULL, 1, 1),
    ('Lotti', 'prodotto', 'TEXT', 1, NULL, 0, 1),
    ('Lotti', 'quantita', 'REAL', 1, NULL, 0, 1),
    ('Lotti', 'unita_misura', 'TEXT', 1, NULL, 0, 1),
    ('Lotti', 'data_scadenza', 'DATE', 1, NULL, 0, 1),
    ('Lotti', 'giorni_permanenza', 'INTEGER', 1, NULL, 0, 1),
    ('Lotti', 'stato', 'TEXT', 1, NULL, 0, 1),
    ('Lotti', 'tipo_utente_origine_id', 'INTEGER', 0, NULL, 0, 1),
    ('Lotti', 'inserito_da', 'INTEGER', 1, NULL, 0, 1),
    ('Lotti', 'creato_il', 'TIMESTAMP', 0, 'CURRENT_TIMESTAMP', 0, 1),
    ('Lotti', 'aggiornato_il', 'TIMESTAMP', 0, NULL, 0, 1),
    ('Lotti', 'prezzo', 'REAL', 0, NULL, 0, 1);

-- Definizione schema tabella Prenotazioni (Versione 1)
INSERT OR IGNORE INTO SchemaRiferimento (tabella, colonna, tipo, not_null, valore_default, primary_key, versione)
VALUES
    ('Prenotazioni', 'id', 'INTEGER', 1, NULL, 1, 1),
    ('Prenotazioni', 'lotto_id', 'INTEGER', 1, NULL, 0, 1),
    ('Prenotazioni', 'tipo_utente_ricevente_id', 'INTEGER', 1, NULL, 0, 1),
    ('Prenotazioni', 'attore_id', 'INTEGER', 0, NULL, 0, 1),
    ('Prenotazioni', 'data_prenotazione', 'TIMESTAMP', 1, 'CURRENT_TIMESTAMP', 0, 1),
    ('Prenotazioni', 'data_ritiro_prevista', 'TIMESTAMP', 0, NULL, 0, 1),
    ('Prenotazioni', 'data_ritiro_effettivo', 'DATETIME', 0, NULL, 0, 1),
    ('Prenotazioni', 'data_consegna', 'TIMESTAMP', 0, NULL, 0, 1),
    ('Prenotazioni', 'stato', 'TEXT', 1, NULL, 0, 1),
    ('Prenotazioni', 'note', 'TEXT', 0, NULL, 0, 1),
    ('Prenotazioni', 'created_at', 'TIMESTAMP', 0, 'CURRENT_TIMESTAMP', 0, 1),
    ('Prenotazioni', 'updated_at', 'TIMESTAMP', 0, NULL, 0, 1),
    ('Prenotazioni', 'ritirato_da', 'TEXT', 0, NULL, 0, 1),
    ('Prenotazioni', 'documento_ritiro', 'TEXT', 0, NULL, 0, 1),
    ('Prenotazioni', 'note_ritiro', 'TEXT', 0, NULL, 0, 1),
    ('Prenotazioni', 'operatore_ritiro', 'INTEGER', 0, NULL, 0, 1),
    ('Prenotazioni', 'transizioni_stato', 'TEXT', 0, NULL, 0, 1),
    ('Prenotazioni', 'tipo_pagamento', 'TEXT', 0, NULL, 0, 1);

-- Funzione per verificare lo schema e identificare discrepanze
-- Questa funzione esegue la verifica e registra eventuali discrepanze
CREATE TEMP VIEW IF NOT EXISTS VerificaSchema AS
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
-- Confronta lo schema attuale con lo schema di riferimento
SELECT
    'COLONNA_MANCANTE' AS tipo_discrepanza,
    r.tabella,
    r.colonna,
    r.tipo AS valore_atteso,
    NULL AS valore_rilevato
FROM 
    SchemaRiferimento r
WHERE 
    NOT EXISTS (
        SELECT 1 FROM current_schema c 
        WHERE c.tabella = r.tabella AND c.colonna = r.colonna
    )
    AND r.versione = (SELECT MAX(versione) FROM SchemaRiferimento)
UNION ALL
SELECT
    'TIPO_ERRATO' AS tipo_discrepanza,
    r.tabella,
    r.colonna,
    r.tipo AS valore_atteso,
    c.tipo AS valore_rilevato
FROM 
    SchemaRiferimento r
JOIN 
    current_schema c ON r.tabella = c.tabella AND r.colonna = c.colonna
WHERE 
    r.tipo != c.tipo
    AND r.versione = (SELECT MAX(versione) FROM SchemaRiferimento)
UNION ALL
SELECT
    'NULL_DIVERSO' AS tipo_discrepanza,
    r.tabella,
    r.colonna,
    CAST(r.not_null AS TEXT) AS valore_atteso,
    CAST(c.not_null AS TEXT) AS valore_rilevato
FROM 
    SchemaRiferimento r
JOIN 
    current_schema c ON r.tabella = c.tabella AND r.colonna = c.colonna
WHERE 
    r.not_null != c.not_null
    AND r.versione = (SELECT MAX(versione) FROM SchemaRiferimento);

-- Procedura di verifica dello schema
-- Questa procedura inserisce le discrepanze rilevate nella tabella SchemaDiscrepanze
INSERT INTO SchemaDiscrepanze (tabella, colonna, tipo_discrepanza, valore_atteso, valore_rilevato)
SELECT tabella, colonna, tipo_discrepanza, valore_atteso, valore_rilevato
FROM VerificaSchema;

-- Restituisci il risultato della verifica
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM SchemaDiscrepanze WHERE data_rilevamento >= datetime('now', '-1 minute')) > 0 
        THEN 'Trovate discrepanze nello schema!'
        ELSE 'Schema valido, nessuna discrepanza rilevata.'
    END AS risultato_verifica;

-- Mostra le discrepanze recenti (ultime 24 ore)
SELECT * FROM SchemaDiscrepanze 
WHERE data_rilevamento >= datetime('now', '-24 hours')
ORDER BY data_rilevamento DESC; 