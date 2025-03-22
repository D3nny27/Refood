-- Aggiorna gli utenti esistenti impostando admin@refood.org come creatore di tutti gli utenti
UPDATE Utenti SET creato_da = (
  SELECT id FROM Utenti WHERE email = 'admin@refood.org' LIMIT 1
) WHERE 1=1;

-- Nel caso in cui admin@refood.org non esista, usiamo il primo amministratore come fallback per gli utenti senza creatore
UPDATE Utenti SET creato_da = (
  SELECT id FROM Utenti WHERE ruolo = 'Amministratore' ORDER BY id LIMIT 1
) WHERE creato_da IS NULL; 