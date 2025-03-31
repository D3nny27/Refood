-- Procedura per aggiornare automaticamente lo stato delle prenotazioni
BEGIN TRANSACTION;

-- Determina un ID amministratore valido per le operazioni
WITH admin_id AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore') 
                THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1)
            ELSE (SELECT COALESCE((SELECT MIN(id) FROM Attori), 1))
        END AS admin_id
)

-- Marca come "Rifiutato" le prenotazioni in attesa da più di 48 ore
UPDATE Prenotazioni
SET stato = 'Rifiutato',
    note = COALESCE(note, '') || ' - Rifiutato automaticamente per timeout di attesa.',
    updated_at = datetime('now'),
    attore_id = (SELECT admin_id FROM admin_id) -- Imposta l'amministratore come autore della modifica
WHERE stato = 'InAttesa'
AND datetime(data_prenotazione, '+48 hours') <= datetime('now');

-- Aggiorna le transizioni di stato per le prenotazioni appena rifiutate
UPDATE Prenotazioni
SET transizioni_stato = CASE
    WHEN transizioni_stato IS NULL THEN json('{"transizioni": [{"da": "InAttesa", "a": "Rifiutato", "timestamp": "' || datetime('now') || '", "motivo": "Timeout automatico", "attore_id": ' || (SELECT admin_id FROM admin_id) || '}]}')
    ELSE json_insert(transizioni_stato, '$.transizioni[#]', json('{"da": "InAttesa", "a": "Rifiutato", "timestamp": "' || datetime('now') || '", "motivo": "Timeout automatico", "attore_id": ' || (SELECT admin_id FROM admin_id) || '}'))
END
WHERE stato = 'Rifiutato'
AND updated_at >= datetime('now', '-30 seconds');

-- Seleziona il numero di prenotazioni aggiornate per il log
SELECT 'Prenotazioni rifiutate automaticamente: ' || changes() AS prenotazioni_info;

COMMIT;

-- Log esecuzione
SELECT 'Aggiornamento stato prenotazioni completato il ' || datetime('now') AS execution_log;
