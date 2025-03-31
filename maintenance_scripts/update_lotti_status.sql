-- Procedura per aggiornare lo stato dei lotti in base alla data di scadenza
BEGIN TRANSACTION;

-- Aggiorna lotti da Verde a Arancione
UPDATE Lotti
SET stato = 'Arancione', aggiornato_il = datetime('now')
WHERE stato = 'Verde'
AND date(data_scadenza, '-' || (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') || ' days') <= date('now')
AND date(data_scadenza, '-' || (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') || ' days') > date('now');

-- Inserisci log per i cambi di stato (Verde -> Arancione) con meccanismo di fallback robusto
INSERT INTO LogCambioStato (lotto_id, stato_precedente, stato_nuovo, cambiato_da)
SELECT 
    id, 
    'Verde', 
    'Arancione', 
    CASE 
        WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore') 
            THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC NULLS LAST LIMIT 1)
        WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Operatore') 
            THEN (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1)
        ELSE (SELECT COALESCE((SELECT MIN(id) FROM Attori), 1)) -- Fallback sicuro
    END
FROM Lotti 
WHERE stato = 'Arancione' 
AND aggiornato_il >= datetime('now', '-30 seconds');

-- Aggiorna lotti da Arancione a Rosso
UPDATE Lotti
SET stato = 'Rosso', aggiornato_il = datetime('now')
WHERE stato = 'Arancione'
AND date(data_scadenza, '-' || (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') || ' days') <= date('now');

-- Inserisci log per i cambi di stato (Arancione -> Rosso) con meccanismo di fallback robusto
INSERT INTO LogCambioStato (lotto_id, stato_precedente, stato_nuovo, cambiato_da)
SELECT 
    id, 
    'Arancione', 
    'Rosso', 
    CASE 
        WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore') 
            THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC NULLS LAST LIMIT 1)
        WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Operatore') 
            THEN (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1)
        ELSE (SELECT COALESCE((SELECT MIN(id) FROM Attori), 1)) -- Fallback sicuro
    END
FROM Lotti 
WHERE stato = 'Rosso' 
AND aggiornato_il >= datetime('now', '-30 seconds');

-- Seleziona il numero di lotti aggiornati per il log
SELECT 'Lotti aggiornati a Arancione: ' || changes() AS update_info;

COMMIT;

-- Log esecuzione
SELECT 'Aggiornamento stato lotti completato il ' || datetime('now') AS execution_log;
