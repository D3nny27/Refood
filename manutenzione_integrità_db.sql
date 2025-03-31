-- ***********************************************************************
-- SCRIPT DI MANUTENZIONE E CORREZIONE INTEGRITÀ DATABASE
-- ***********************************************************************
-- Versione: 1.0
-- Data: 2023
--
-- DESCRIZIONE: Questo script corregge problemi di integrità referenziale
-- nel database ReFood, in particolare i riferimenti non validi a ID di attori
-- che potrebbero causare errori di vincolo di chiave esterna come quello
-- riscontrato durante l'aggiornamento automatico dello stato dei lotti.
--
-- ISTRUZIONI: Eseguire questo script direttamente sul database per
-- verificare e correggere eventuali problemi di integrità dei dati.
-- Il processo è racchiuso in una transazione, quindi è possibile annullare 
-- le modifiche in caso di problemi.
-- ***********************************************************************

BEGIN TRANSACTION;

-- Variabile di log per tracciare le modifiche
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

-- Registra il numero di righe modificate nella tabella LogCambioStato
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'LogCambioStato', 'cambiato_da', changes();

-- 2. Correggi riferimenti non validi nella tabella Prenotazioni
UPDATE Prenotazioni
SET attore_id = (SELECT admin_id FROM admin_id)
WHERE attore_id IS NOT NULL 
AND attore_id NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella Prenotazioni
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'Prenotazioni', 'attore_id', changes();

-- 3. Correggi riferimenti non validi nella tabella Lotti
UPDATE Lotti
SET inserito_da = (SELECT admin_id FROM admin_id)
WHERE inserito_da NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella Lotti
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'Lotti', 'inserito_da', changes();

-- 4. Correggi riferimenti non validi nella tabella Notifiche (destinatario)
UPDATE Notifiche
SET destinatario_id = (SELECT admin_id FROM admin_id)
WHERE destinatario_id NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella Notifiche (destinatario)
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'Notifiche', 'destinatario_id', changes();

-- 5. Correggi riferimenti non validi nella tabella Notifiche (origine)
UPDATE Notifiche
SET origine_id = (SELECT admin_id FROM admin_id)
WHERE origine_id IS NOT NULL
AND origine_id NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella Notifiche (origine)
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'Notifiche', 'origine_id', changes();

-- 6. Verifica stato dei lotti in base alla data di scadenza (solo se necessario)
-- Questa correzione si assicura che i lotti abbiano lo stato corretto in base alla data di scadenza
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

-- Registra il numero di righe modificate nella tabella Lotti (stato)
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'Lotti', 'stato', changes();

-- 7. Verifica e correggi i record in TokenRevocati
UPDATE TokenRevocati
SET revocato_da = (SELECT admin_id FROM admin_id)
WHERE revocato_da IS NOT NULL
AND revocato_da NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella TokenRevocati
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'TokenRevocati', 'revocato_da', changes();

-- 8. Verifica e correggi i record in ParametriSistema
UPDATE ParametriSistema
SET modificato_da = (SELECT admin_id FROM admin_id)
WHERE modificato_da IS NOT NULL 
AND modificato_da NOT IN (SELECT id FROM Attori);

-- Registra il numero di righe modificate nella tabella ParametriSistema
INSERT INTO LogManutenzione (tabella, campo, righe_corrette)
SELECT 'ParametriSistema', 'modificato_da', changes();

-- Visualizza un rapporto delle correzioni effettuate
SELECT 'RAPPORTO DI MANUTENZIONE' AS Rapporto;
SELECT 'Eseguito il: ' || datetime('now') AS Esecuzione;
SELECT 'ID amministratore utilizzato: ' || (SELECT admin_id FROM admin_id) AS Amministratore;
SELECT tabella AS Tabella, campo AS Campo, righe_corrette AS 'Righe corrette' FROM LogManutenzione;
SELECT 'Totale modifiche effettuate: ' || (SELECT SUM(righe_corrette) FROM LogManutenzione) AS 'Totale correzioni';

-- Controllo finale: verifica se ci sono ancora riferimenti non validi
SELECT 'Verifica finale: riferimenti non validi rimanenti' AS Verifica;

SELECT 'LogCambioStato.cambiato_da', COUNT(*) FROM LogCambioStato WHERE cambiato_da NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Prenotazioni.attore_id', COUNT(*) FROM Prenotazioni WHERE attore_id IS NOT NULL AND attore_id NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Lotti.inserito_da', COUNT(*) FROM Lotti WHERE inserito_da NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Notifiche.destinatario_id', COUNT(*) FROM Notifiche WHERE destinatario_id NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Notifiche.origine_id', COUNT(*) FROM Notifiche WHERE origine_id IS NOT NULL AND origine_id NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'TokenRevocati.revocato_da', COUNT(*) FROM TokenRevocati WHERE revocato_da IS NOT NULL AND revocato_da NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'ParametriSistema.modificato_da', COUNT(*) FROM ParametriSistema WHERE modificato_da IS NOT NULL AND modificato_da NOT IN (SELECT id FROM Attori);

-- Elimina la tabella temporanea di log
DROP TABLE LogManutenzione;

-- Se tutto è andato bene e non ci sono più errori, commit della transazione
-- In caso di problemi, è possibile fare ROLLBACK invece di COMMIT
COMMIT;

-- ***********************************************************************
-- ISTRUZIONI POST-MANUTENZIONE
-- ***********************************************************************
-- Dopo aver eseguito questo script:
-- 1. Controllare il rapporto per verificare quante righe sono state corrette
-- 2. Verificare che la sezione "riferimenti non validi rimanenti" mostri tutti zeri
-- 3. Verificare che le procedure automatiche di aggiornamento dello stato dei lotti
--    funzionino correttamente senza errori di vincolo di chiave esterna
-- *********************************************************************** 