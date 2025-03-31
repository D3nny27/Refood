-- ******************************************************************
-- AGGIUNTA CAMPO PREZZO ALLA TABELLA LOTTI
-- ******************************************************************
-- Data: 31 marzo 2025
-- Autore: Sistema di manutenzione
-- Descrizione: Questo script aggiunge il campo prezzo alla tabella Lotti
--              per permettere il tracciamento del valore economico dei lotti alimentari.

-- Aggiunta della colonna prezzo
ALTER TABLE Lotti ADD COLUMN prezzo REAL DEFAULT NULL;

-- Registrazione della modifica
INSERT INTO SchemaModifiche (tabella, tipo_operazione, descrizione, dettagli, script_origine, utente) 
VALUES ('Lotti', 'ALTER', 'Aggiunta colonna prezzo', 'Colonna: prezzo, Tipo: REAL, NULL consentito', 'add_prezzo_to_lotti.sql', 'admin');

-- Aggiornamento del sistema di monitoraggio schema
INSERT OR IGNORE INTO SchemaRiferimento (tabella, colonna, tipo, not_null, valore_default, primary_key, versione)
VALUES ('Lotti', 'prezzo', 'REAL', 0, NULL, 0, 1);

-- Aggiornamento dello stato delle discrepanze
UPDATE SchemaDiscrepanze 
SET corretta = 1, data_correzione = datetime('now')
WHERE tabella = 'Lotti' AND colonna = 'prezzo' AND tipo_discrepanza = 'COLONNA_MANCANTE';

-- Creazione di un indice per migliorare le query che filtrano per prezzo
CREATE INDEX IF NOT EXISTS idx_lotti_prezzo ON Lotti(prezzo);

-- Informazioni sullo script
SELECT 'Migrazione add_prezzo_to_lotti.sql eseguita con successo' AS result;
SELECT datetime('now') AS timestamp_esecuzione; 