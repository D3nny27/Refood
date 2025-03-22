-- Migrazione per aggiungere la colonna creato_da alla tabella Utenti
ALTER TABLE Utenti ADD COLUMN creato_da INTEGER REFERENCES Utenti(id);

-- Aggiorna gli utenti esistenti impostando admin@refood.org come creatore di tutti gli utenti
UPDATE Utenti SET creato_da = (
  SELECT id FROM Utenti WHERE email = 'admin@refood.org' LIMIT 1
) WHERE creato_da IS NULL;

-- Nel caso in cui admin@refood.org non esista, usiamo il primo amministratore come fallback
UPDATE Utenti SET creato_da = (
  SELECT id FROM Utenti WHERE ruolo = 'Amministratore' ORDER BY id LIMIT 1
) WHERE creato_da IS NULL; 