-- Migrazione per aggiungere campi di tracciamento ritiro alla tabella Prenotazioni

-- Verifica se la tabella Prenotazioni esiste
SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='Prenotazioni') 
    THEN 'La tabella Prenotazioni esiste, procedo con la migrazione.' 
    ELSE 'La tabella Prenotazioni non esiste! Migrazione annullata.' 
END AS message;

-- Aggiunta campi relativi al ritiro
ALTER TABLE Prenotazioni ADD COLUMN ritirato_da TEXT DEFAULT NULL;
ALTER TABLE Prenotazioni ADD COLUMN documento_ritiro TEXT DEFAULT NULL;
ALTER TABLE Prenotazioni ADD COLUMN data_ritiro_effettivo DATETIME DEFAULT NULL;
ALTER TABLE Prenotazioni ADD COLUMN note_ritiro TEXT DEFAULT NULL;
ALTER TABLE Prenotazioni ADD COLUMN operatore_ritiro INTEGER DEFAULT NULL;

-- Aggiunta campo per il tracciamento delle transizioni di stato
ALTER TABLE Prenotazioni ADD COLUMN transizioni_stato TEXT DEFAULT NULL;

-- Log della migrazione completata
PRAGMA user_version = (SELECT user_version FROM pragma_user_version) + 1;

-- Messaggio di completamento
SELECT 'Migrazione completata: campi di tracciamento ritiro aggiunti alla tabella Prenotazioni' AS message; 