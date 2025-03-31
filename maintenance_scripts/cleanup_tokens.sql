-- Procedura per pulizia dei token scaduti
BEGIN TRANSACTION;

-- Determina un ID amministratore valido per la revoca
WITH admin_id AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore') 
                THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1)
            ELSE (SELECT COALESCE((SELECT MIN(id) FROM Attori), 1))
        END AS admin_id
)

-- Sposta i token scaduti nella tabella TokenRevocati
INSERT INTO TokenRevocati (token_hash, scadenza_originale, motivo, revocato_da)
SELECT 
    substr(access_token, 1, 100), -- Prende solo una parte del token per creare l'hash
    access_token_scadenza,
    'Scaduto automaticamente',
    (SELECT admin_id FROM admin_id)
FROM TokenAutenticazione
WHERE access_token_scadenza < datetime('now')
AND revocato = 0;

-- Marca i token come revocati nella tabella TokenAutenticazione
UPDATE TokenAutenticazione
SET revocato = 1, revocato_il = datetime('now')
WHERE access_token_scadenza < datetime('now')
AND revocato = 0;

-- Seleziona il numero di token spostati per il log
SELECT 'Token revocati: ' || changes() AS cleanup_info;

COMMIT;

-- Log esecuzione
SELECT 'Pulizia token scaduti completata il ' || datetime('now') AS execution_log;
