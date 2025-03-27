-- Script di migrazione per aggiungere la tabella CentriTipi
-- Creato per Refood App - Version 1.0
-- IMPORTANTE: Eseguire un backup del database prima di applicare questa migrazione

-- Abilita la modalità transazione per garantire l'integrità dei dati
BEGIN TRANSACTION;

-- Abilita la modalità di supporto per operazioni di modifica schema
PRAGMA foreign_keys = OFF;

-- Step 1: Crea la tabella CentriTipi
CREATE TABLE CentriTipi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descrizione TEXT NOT NULL,
    codice TEXT NOT NULL UNIQUE,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Popola la tabella CentriTipi con i valori esistenti in Centri.tipo
INSERT INTO CentriTipi (descrizione, codice) VALUES 
('Distribuzione', 'DISTRIB'),
('Sociale', 'SOCIAL'),
('Riciclaggio', 'RECYCLE');

-- Step 3: Aggiungi una colonna tipo_id alla tabella Centri
ALTER TABLE Centri ADD COLUMN tipo_id INTEGER;

-- Step 4: Aggiorna la colonna tipo_id in base ai valori esistenti della colonna tipo
UPDATE Centri SET tipo_id = (SELECT id FROM CentriTipi WHERE descrizione = Centri.tipo) WHERE tipo IS NOT NULL;

-- Step 5: Crea un indice per la nuova colonna tipo_id
CREATE INDEX idx_centri_tipo_id ON Centri(tipo_id);

-- Step 6: Aggiungi il vincolo di chiave esterna
-- Nota: in SQLite non è possibile aggiungere vincoli di chiave esterna con ALTER TABLE
-- Se fosse necessario, si dovrebbe ricreare la tabella. Per ora lasciamo senza vincolo.

-- Step 7: Riattiva i controlli di foreign key
PRAGMA foreign_keys = ON;

-- Se tutto è andato bene, conferma la transazione
COMMIT;

-- Se ci sono errori, la transazione verrà annullata automaticamente
-- e sarà eseguito un rollback, preservando i dati originali 