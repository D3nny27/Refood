-- Script di test per l'aggiornamento automatico dello stato dei lotti
-- Questo script simula la procedura che in precedenza causava l'errore di vincolo di chiave esterna

BEGIN TRANSACTION;

-- Visualizza lo stato attuale dei lotti prima dell'aggiornamento
SELECT 'STATO ATTUALE DEI LOTTI:' AS info;
SELECT id, prodotto, stato, data_scadenza FROM Lotti LIMIT 10;

-- Aggiorna lotti da Verde a Arancione
UPDATE Lotti
SET stato = 'Arancione', aggiornato_il = datetime('now')
WHERE stato = 'Verde'
AND date(data_scadenza, '-' || (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') || ' days') <= date('now')
AND date(data_scadenza, '-' || (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') || ' days') > date('now');

-- Inserisci log per i cambi di stato (Verde -> Arancione)
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

-- Inserisci log per i cambi di stato (Arancione -> Rosso)
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

-- Visualizza il nuovo stato dei lotti dopo l'aggiornamento
SELECT 'STATO DEI LOTTI DOPO L''AGGIORNAMENTO:' AS info;
SELECT id, prodotto, stato, data_scadenza FROM Lotti LIMIT 10;

-- Verifica se ci sono stati inserimenti nella tabella LogCambioStato
SELECT 'LOG DEI CAMBI DI STATO:' AS info;
SELECT * FROM LogCambioStato ORDER BY cambiato_il DESC LIMIT 5;

COMMIT; 