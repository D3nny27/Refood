-- Migrazione per aggiungere il campo tipo_pagamento alla tabella Prenotazioni

-- Verifica se la tabella Prenotazioni esiste
SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='Prenotazioni') 
    THEN 'La tabella Prenotazioni esiste, procedo con la migrazione.' 
    ELSE 'La tabella Prenotazioni non esiste! Migrazione annullata.' 
END AS message;

-- Aggiungi il campo tipo_pagamento alla tabella Prenotazioni se non esiste già
ALTER TABLE Prenotazioni ADD COLUMN tipo_pagamento TEXT DEFAULT NULL;

-- Log della migrazione completata
PRAGMA user_version = (SELECT user_version FROM pragma_user_version) + 1;

-- Messaggio di completamento
SELECT 'Migrazione completata: campo tipo_pagamento aggiunto alla tabella Prenotazioni' AS message; 