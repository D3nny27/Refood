-- Migrazione per aggiungere il campo prezzo alla tabella Lotti

-- Verifica se la tabella Lotti esiste
SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='Lotti') 
    THEN 'La tabella Lotti esiste, procedo con la migrazione.' 
    ELSE 'La tabella Lotti non esiste! Migrazione annullata.' 
END AS message;

-- Aggiungi il campo prezzo alla tabella Lotti se non esiste già
ALTER TABLE Lotti ADD COLUMN prezzo REAL DEFAULT NULL;

-- Log della migrazione completata
PRAGMA user_version = (SELECT user_version FROM pragma_user_version) + 1;

-- Messaggio di completamento
SELECT 'Migrazione completata: campo prezzo aggiunto alla tabella Lotti' AS message; 