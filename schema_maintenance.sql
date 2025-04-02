-- ***********************************************************************
-- PROCEDURE DI MANUTENZIONE AUTOMATICA
-- ***********************************************************************

-- Questa sezione contiene procedure SQL da eseguire periodicamente tramite job schedulati
-- Queste procedure non fanno parte dello schema del database ma sono incluse qui come riferimento
-- e documentazione per lo sviluppo del sistema di manutenzione automatica

-- Procedura per aggiornare lo stato dei lotti in base alla data di scadenza
-- Da eseguire tramite job periodico (es. ogni giorno alle 00:00)
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

COMMIT;

-- Procedura per pulizia dei token scaduti
-- Da eseguire tramite job periodico (es. ogni giorno alle 02:00)
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

COMMIT;

-- Procedura per calcolare statistiche settimanali
-- Da eseguire tramite job periodico (es. ogni lunedì alle 01:00)
BEGIN TRANSACTION;

-- Calcola la settimana e l'anno per le statistiche
-- Utilizza la settimana ISO (1-53)
WITH current_week AS (
    SELECT 
        strftime('%W', 'now') AS week_num,
        strftime('%Y', 'now') AS year
)

-- Inserisci o aggiorna le statistiche per ogni tipo di utente
INSERT INTO StatisticheSettimanali (
    tipo_utente_id, settimana, anno, quantita_salvata, 
    peso_totale_kg, co2_risparmiata_kg, valore_economico, numero_lotti
)
SELECT 
    tu.id AS tipo_utente_id,
    (SELECT week_num FROM current_week) AS settimana,
    (SELECT year FROM current_week) AS anno,
    COALESCE(SUM(l.quantita), 0) AS quantita_salvata,
    COALESCE(SUM(CASE WHEN l.unita_misura = 'kg' THEN l.quantita ELSE l.quantita * 0.5 END), 0) AS peso_totale_kg,
    COALESCE(SUM(ic.co2_risparmiata_kg), 0) AS co2_risparmiata_kg,
    COALESCE(SUM(ic.valore_economico), 0) AS valore_economico,
    COUNT(l.id) AS numero_lotti
FROM Tipo_Utente tu
LEFT JOIN Lotti l ON l.tipo_utente_origine_id = tu.id
LEFT JOIN ImpattoCO2 ic ON ic.lotto_id = l.id
WHERE (l.id IS NULL OR (l.creato_il >= date('now', 'weekday 0', '-7 days')
AND l.creato_il < date('now', 'weekday 0')))
GROUP BY tu.id
ON CONFLICT(tipo_utente_id, settimana, anno) DO UPDATE SET
    quantita_salvata = excluded.quantita_salvata,
    peso_totale_kg = excluded.peso_totale_kg,
    co2_risparmiata_kg = excluded.co2_risparmiata_kg,
    valore_economico = excluded.valore_economico,
    numero_lotti = excluded.numero_lotti;

COMMIT;

-- Procedura per aggiornare automaticamente lo stato delle prenotazioni
-- Da eseguire tramite job periodico (es. ogni ora)
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

COMMIT;

-- Procedura per verificare e correggere l'integrità referenziale del database
-- Da eseguire periodicamente (es. settimanalmente) o dopo aggiornamenti importanti
-- Corregge i problemi di vincoli di chiave esterna nelle tabelle principali
BEGIN TRANSACTION;

-- Variabile di log per tracciare le modifiche (opzionale)
CREATE TEMPORARY TABLE IF NOT EXISTS LogManutenzione (
    tabella TEXT,
    campo TEXT,
    righe_corrette INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Determina un ID amministratore valido per le correzioni
-- Strategia a cascata:
-- 1. Cerca un amministratore attivo (con accesso recente)
-- 2. Se non disponibile, prende qualsiasi amministratore
-- 3. Se non ci sono amministratori, prende un operatore
-- 4. Come ultima risorsa, usa l'ID minimo o 1
WITH admin_id AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC LIMIT 1) 
                THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC LIMIT 1)
            WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore') 
                THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1)
            WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Operatore') 
                THEN (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1)
            ELSE (SELECT COALESCE((SELECT MIN(id) FROM Attori), 1))
        END AS admin_id
)

-- 1. Correggi riferimenti non validi nella tabella LogCambioStato
UPDATE LogCambioStato 
SET cambiato_da = (SELECT admin_id FROM admin_id)
WHERE cambiato_da NOT IN (SELECT id FROM Attori);

-- 2. Correggi riferimenti non validi nella tabella Prenotazioni
UPDATE Prenotazioni
SET attore_id = (SELECT admin_id FROM admin_id)
WHERE attore_id IS NOT NULL 
AND attore_id NOT IN (SELECT id FROM Attori);

-- 3. Correggi riferimenti non validi nella tabella Lotti
UPDATE Lotti
SET inserito_da = (SELECT admin_id FROM admin_id)
WHERE inserito_da NOT IN (SELECT id FROM Attori);

-- 4. Correggi riferimenti non validi nella tabella Notifiche (destinatario)
UPDATE Notifiche
SET destinatario_id = (SELECT admin_id FROM admin_id)
WHERE destinatario_id NOT IN (SELECT id FROM Attori);

-- 5. Correggi riferimenti non validi nella tabella Notifiche (origine)
UPDATE Notifiche
SET origine_id = (SELECT admin_id FROM admin_id)
WHERE origine_id IS NOT NULL
AND origine_id NOT IN (SELECT id FROM Attori);

-- 6. Verifica e correggi i record in TokenRevocati
UPDATE TokenRevocati
SET revocato_da = (SELECT admin_id FROM admin_id)
WHERE revocato_da IS NOT NULL
AND revocato_da NOT IN (SELECT id FROM Attori);

-- 7. Verifica e correggi i record in ParametriSistema
UPDATE ParametriSistema
SET modificato_da = (SELECT admin_id FROM admin_id)
WHERE modificato_da IS NOT NULL 
AND modificato_da NOT IN (SELECT id FROM Attori);

-- 8. Verifica stato dei lotti in base alla data di scadenza (solo se necessario)
UPDATE Lotti
SET stato = CASE
    WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') THEN 'Rosso'
    WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') THEN 'Arancione'
    ELSE 'Verde'
END
WHERE stato != CASE
    WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') THEN 'Rosso'
    WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') THEN 'Arancione'
    ELSE 'Verde'
END;

-- Alla fine, elimina eventuali tabelle temporanee
DROP TABLE IF EXISTS LogManutenzione;

COMMIT;

-- Procedura per verificare e correggere l'integrità del database
-- Da eseguire periodicamente (es. settimanalmente) o dopo aggiornamenti importanti
BEGIN TRANSACTION;

-- Determina un ID amministratore valido per le correzioni
WITH admin_id AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM Attori WHERE ruolo = 'Amministratore') 
                THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1)
            ELSE (SELECT COALESCE((SELECT MIN(id) FROM Attori), 1))
        END AS admin_id
)

-- 1. Correggi riferimenti non validi nella tabella LogCambioStato
UPDATE LogCambioStato 
SET cambiato_da = (SELECT admin_id FROM admin_id)
WHERE cambiato_da NOT IN (SELECT id FROM Attori);

-- 2. Correggi riferimenti non validi nella tabella Prenotazioni
UPDATE Prenotazioni
SET attore_id = (SELECT admin_id FROM admin_id)
WHERE attore_id IS NOT NULL 
AND attore_id NOT IN (SELECT id FROM Attori);

-- 3. Correggi riferimenti non validi nella tabella Lotti
UPDATE Lotti
SET inserito_da = (SELECT admin_id FROM admin_id)
WHERE inserito_da NOT IN (SELECT id FROM Attori);

-- 4. Correggi riferimenti non validi nella tabella Notifiche
UPDATE Notifiche
SET destinatario_id = (SELECT admin_id FROM admin_id)
WHERE destinatario_id NOT IN (SELECT id FROM Attori);

UPDATE Notifiche
SET origine_id = (SELECT admin_id FROM admin_id)
WHERE origine_id IS NOT NULL
AND origine_id NOT IN (SELECT id FROM Attori);

-- 5. Verifica lo stato dei lotti in base alla data di scadenza ed eventuali correzioni
UPDATE Lotti
SET stato = CASE
    WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') THEN 'Rosso'
    WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') THEN 'Arancione'
    ELSE 'Verde'
END
WHERE stato != CASE
    WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') THEN 'Rosso'
    WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') THEN 'Arancione'
    ELSE 'Verde'
END;

COMMIT; 