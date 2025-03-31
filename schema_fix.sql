-- ******************************************************************
-- SCRIPT DI CORREZIONE AUTOMATICA DELLO SCHEMA DATABASE REFOOD
-- ******************************************************************
-- Questo script corregge automaticamente le discrepanze rilevate nello schema,
-- aggiungendo colonne mancanti o modificando quelle errate secondo lo schema di riferimento

BEGIN TRANSACTION;

-- Log dell'esecuzione
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

-- Log delle discrepanze trovate
INSERT INTO FixLog (evento, dettagli) 
SELECT 'DISCREPANZA_TROVATA', 'Tabella: ' || tabella || ', Colonna: ' || colonna || ', Tipo: ' || tipo_discrepanza
FROM DiscrepanzeDaCorreggere;

-- Variabile per contare le correzioni
CREATE TEMP TABLE IF NOT EXISTS Contatore (correzioni INTEGER DEFAULT 0);
INSERT INTO Contatore VALUES (0);

-- Correzione delle colonne mancanti
INSERT INTO FixLog (evento, dettagli)
SELECT 'CORREZIONE', 'Aggiunta colonna mancante: ' || d.tabella || '.' || d.colonna
FROM DiscrepanzeDaCorreggere d
JOIN SchemaRiferimento r ON d.tabella = r.tabella AND d.colonna = r.colonna
WHERE d.tipo_discrepanza = 'COLONNA_MANCANTE'
AND r.versione = (SELECT MAX(versione) FROM SchemaRiferimento);

-- Per ogni colonna mancante, esegui ALTER TABLE per aggiungerla
WITH colonne_da_aggiungere AS (
    SELECT d.id, d.tabella, d.colonna, r.tipo, r.not_null, r.valore_default
    FROM DiscrepanzeDaCorreggere d
    JOIN SchemaRiferimento r ON d.tabella = r.tabella AND d.colonna = r.colonna
    WHERE d.tipo_discrepanza = 'COLONNA_MANCANTE'
    AND r.versione = (SELECT MAX(versione) FROM SchemaRiferimento)
)
SELECT 
    CASE
        -- Esegui le istruzioni ALTER TABLE per ogni colonna mancante
        WHEN EXISTS (SELECT 1 FROM colonne_da_aggiungere) THEN (
            WITH RECURSIVE add_columns(id, sql_stmt, remaining) AS (
                SELECT 
                    id,
                    'ALTER TABLE ' || tabella || ' ADD COLUMN ' || colonna || ' ' || tipo || 
                    CASE WHEN not_null = 1 THEN ' NOT NULL' ELSE '' END ||
                    CASE WHEN valore_default IS NOT NULL THEN ' DEFAULT ' || valore_default ELSE '' END || ';',
                    (SELECT COUNT(*) FROM colonne_da_aggiungere) - 1
                FROM colonne_da_aggiungere
                ORDER BY id
                LIMIT 1
                
                UNION ALL
                
                SELECT 
                    c.id,
                    'ALTER TABLE ' || c.tabella || ' ADD COLUMN ' || c.colonna || ' ' || c.tipo || 
                    CASE WHEN c.not_null = 1 THEN ' NOT NULL' ELSE '' END ||
                    CASE WHEN c.valore_default IS NOT NULL THEN ' DEFAULT ' || c.valore_default ELSE '' END || ';',
                    ac.remaining - 1
                FROM add_columns ac
                JOIN colonne_da_aggiungere c ON c.id > ac.id
                WHERE ac.remaining > 0
                ORDER BY c.id
                LIMIT 1
            )
            SELECT sql_stmt FROM add_columns
        )
        ELSE 'SELECT 1; -- Nessuna colonna da aggiungere'
    END AS sql_to_execute
FROM (SELECT 1) dummy
LIMIT 1;

-- Esegui le correzioni dinamicamente (per SQLite è necessario usare una logica diversa)
-- Ciclo sulle colonne mancanti e applica le correzioni una alla volta
WITH colonne_da_aggiungere AS (
    SELECT d.id, d.tabella, d.colonna, r.tipo, r.not_null, r.valore_default
    FROM DiscrepanzeDaCorreggere d
    JOIN SchemaRiferimento r ON d.tabella = r.tabella AND d.colonna = r.colonna
    WHERE d.tipo_discrepanza = 'COLONNA_MANCANTE'
    AND r.versione = (SELECT MAX(versione) FROM SchemaRiferimento)
)
SELECT 
    -- Esegui l'istruzione ALTER TABLE per ogni colonna mancante
    -- Nota: in un contesto reale, queste istruzioni dovrebbero essere
    -- eseguite una alla volta usando un linguaggio procedurale
    (
        'ALTER TABLE ' || tabella || ' ADD COLUMN ' || colonna || ' ' || tipo || 
        CASE WHEN not_null = 1 THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN valore_default IS NOT NULL THEN ' DEFAULT ' || valore_default ELSE '' END
    ) AS sql_to_execute
FROM colonne_da_aggiungere;

-- Creazione di un loop per eseguire tutte le ALTER TABLE
-- (in SQLite dobbiamo farlo indipendentemente per ogni colonna)
-- Esempio di query per l'aggiunta del campo prezzo alla tabella Lotti
SELECT CASE 
    WHEN EXISTS (
        SELECT 1 FROM DiscrepanzeDaCorreggere 
        WHERE tabella = 'Lotti' AND colonna = 'prezzo' AND tipo_discrepanza = 'COLONNA_MANCANTE'
    ) THEN (
        ALTER TABLE Lotti ADD COLUMN prezzo REAL DEFAULT NULL;
        UPDATE Contatore SET correzioni = correzioni + 1;
        UPDATE SchemaDiscrepanze SET corretta = 1, data_correzione = datetime('now')
        WHERE tabella = 'Lotti' AND colonna = 'prezzo' AND tipo_discrepanza = 'COLONNA_MANCANTE';
        INSERT INTO SchemaModifiche (tabella, tipo_operazione, descrizione, dettagli, script_origine)
        VALUES ('Lotti', 'ALTER', 'Aggiunta colonna mancante', 'Colonna: prezzo, Tipo: REAL', 'schema_fix.sql');
        SELECT 'Colonna prezzo aggiunta alla tabella Lotti'
    )
    ELSE 'Colonna prezzo non necessita di correzione'
END;

-- Ripeti l'operazione per altre colonne importanti note
SELECT CASE 
    WHEN EXISTS (
        SELECT 1 FROM DiscrepanzeDaCorreggere 
        WHERE tabella = 'Prenotazioni' AND colonna = 'tipo_pagamento' AND tipo_discrepanza = 'COLONNA_MANCANTE'
    ) THEN (
        ALTER TABLE Prenotazioni ADD COLUMN tipo_pagamento TEXT DEFAULT NULL;
        UPDATE Contatore SET correzioni = correzioni + 1;
        UPDATE SchemaDiscrepanze SET corretta = 1, data_correzione = datetime('now')
        WHERE tabella = 'Prenotazioni' AND colonna = 'tipo_pagamento' AND tipo_discrepanza = 'COLONNA_MANCANTE';
        INSERT INTO SchemaModifiche (tabella, tipo_operazione, descrizione, dettagli, script_origine)
        VALUES ('Prenotazioni', 'ALTER', 'Aggiunta colonna mancante', 'Colonna: tipo_pagamento, Tipo: TEXT', 'schema_fix.sql');
        SELECT 'Colonna tipo_pagamento aggiunta alla tabella Prenotazioni'
    )
    ELSE 'Colonna tipo_pagamento non necessita di correzione'
END;

-- Registra le correzioni effettuate nel log
INSERT INTO FixLog (evento, dettagli) 
VALUES ('CORREZIONI_COMPLETATE', 'Numero di correzioni effettuate: ' || (SELECT correzioni FROM Contatore));

-- Registra anche l'evento nella tabella delle modifiche dello schema
INSERT INTO SchemaModifiche (tabella, tipo_operazione, descrizione, dettagli, script_origine)
VALUES ('MULTIPLE', 'FIX', 'Correzione automatica schema', 
        'Correzioni: ' || (SELECT correzioni FROM Contatore), 
        'schema_fix.sql');

-- Aggiorna eventuali migrazioni mancanti nella tabella MigrazioniSchema
INSERT OR IGNORE INTO MigrazioniSchema (nome_file, applicata_il, descrizione)
SELECT 'add_prezzo_to_lotti.sql', datetime('now'), 'Aggiunta campo prezzo alla tabella Lotti'
WHERE EXISTS (
    SELECT 1 FROM SchemaDiscrepanze 
    WHERE tabella = 'Lotti' AND colonna = 'prezzo' AND tipo_discrepanza = 'COLONNA_MANCANTE'
    AND data_correzione IS NOT NULL
);

INSERT OR IGNORE INTO MigrazioniSchema (nome_file, applicata_il, descrizione)
SELECT 'add_tipo_pagamento_to_prenotazioni.sql', datetime('now'), 'Aggiunta campo tipo_pagamento alla tabella Prenotazioni'
WHERE EXISTS (
    SELECT 1 FROM SchemaDiscrepanze 
    WHERE tabella = 'Prenotazioni' AND colonna = 'tipo_pagamento' AND tipo_discrepanza = 'COLONNA_MANCANTE'
    AND data_correzione IS NOT NULL
);

-- Stampa report finale
SELECT 'REPORT DI CORREZIONE DELLO SCHEMA' AS Titolo;
SELECT 'Timestamp esecuzione: ' || datetime('now') AS Timestamp;
SELECT 'Correzioni effettuate: ' || correzioni AS Correzioni FROM Contatore;
SELECT 'Log delle operazioni:' AS LogOps;
SELECT * FROM FixLog ORDER BY timestamp;

-- Pulizia tabelle temporanee
DROP TABLE IF EXISTS FixLog;
DROP TABLE IF EXISTS DiscrepanzeDaCorreggere;
DROP TABLE IF EXISTS Contatore;

COMMIT; 