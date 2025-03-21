-- Query di esempio per l'app Refood
-- Esempi pratici di utilizzo del database

-- 1. Ottenere tutti i lotti disponibili in scadenza (stato arancione) per un centro sociale
SELECT l.*, c.nome AS centro_origine, u.nome || ' ' || u.cognome AS inserito_da_utente
FROM Lotti l
JOIN Centri c ON l.centro_origine_id = c.id
JOIN Utenti u ON l.inserito_da = u.id
WHERE l.stato = 'Arancione'
AND l.id NOT IN (SELECT lotto_id FROM Prenotazioni WHERE stato != 'Annullato')
ORDER BY l.data_scadenza ASC;

-- 2. Recuperare le prenotazioni attive per un centro sociale specifico
SELECT p.*, l.prodotto, l.quantita, l.unita_misura, l.data_scadenza, 
       c.nome AS centro_origine, c.indirizzo AS indirizzo_origine
FROM Prenotazioni p
JOIN Lotti l ON p.lotto_id = l.id
JOIN Centri c ON l.centro_origine_id = c.id
WHERE p.centro_ricevente_id = ?  -- Sostituire con l'ID del centro sociale
AND p.stato IN ('Prenotato', 'InTransito')
ORDER BY p.data_prenotazione DESC;

-- 3. Calcolare le statistiche di un centro per la settimana corrente
INSERT INTO StatisticheSettimanali (
    centro_id, settimana, anno, quantita_salvata, peso_totale_kg, 
    co2_risparmiata_kg, valore_economico, numero_lotti
)
SELECT 
    l.centro_origine_id,
    strftime('%W', 'now') AS settimana,
    strftime('%Y', 'now') AS anno,
    SUM(l.quantita) AS quantita_salvata,
    SUM(CASE WHEN l.unita_misura = 'kg' THEN l.quantita 
              WHEN l.unita_misura = 'g' THEN l.quantita / 1000.0
              ELSE 0 END) AS peso_totale_kg,
    SUM(i.co2_risparmiata_kg) AS co2_risparmiata_kg,
    SUM(i.valore_economico) AS valore_economico,
    COUNT(l.id) AS numero_lotti
FROM Lotti l
LEFT JOIN ImpattoCO2 i ON l.id = i.lotto_id
WHERE l.centro_origine_id = ?  -- Sostituire con l'ID del centro
AND l.creato_il >= date('now', 'weekday 0', '-7 days')
AND l.creato_il <  date('now', 'weekday 0')
GROUP BY l.centro_origine_id, settimana, anno;

-- 4. Monitoraggio automatico dello stato dei lotti (da eseguire come job pianificato)
-- Aggiorna lo stato dei lotti in base alla data di scadenza
UPDATE Lotti
SET 
    stato = CASE 
        WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') THEN 'Rosso'
        WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') THEN 'Arancione'
        ELSE 'Verde'
    END,
    aggiornato_il = CURRENT_TIMESTAMP
WHERE 
    stato != CASE 
        WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') THEN 'Rosso'
        WHEN julianday(data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') THEN 'Arancione'
        ELSE 'Verde'
    END
AND id NOT IN (SELECT lotto_id FROM Prenotazioni WHERE stato IN ('Consegnato', 'Annullato'));

-- 5. Tracciare il cambio di stato (trigger)
-- Da implementare come trigger SQLite
CREATE TRIGGER IF NOT EXISTS after_lotto_update
AFTER UPDATE OF stato ON Lotti
WHEN OLD.stato != NEW.stato
BEGIN
    INSERT INTO LogCambioStato (
        lotto_id, stato_precedente, stato_nuovo, cambiato_da
    ) VALUES (
        NEW.id, OLD.stato, NEW.stato, NEW.inserito_da
    );
    
    -- Inserisci una notifica per il centro di origine
    INSERT INTO Notifiche (
        tipo, messaggio, destinatario_id
    )
    SELECT 
        'CambioStato', 
        'Il lotto "' || NEW.prodotto || '" è passato dallo stato ' || OLD.stato || ' a ' || NEW.stato, 
        u.id
    FROM Utenti u
    JOIN UtentiCentri uc ON u.id = uc.utente_id
    WHERE uc.centro_id = NEW.centro_origine_id;
END;

-- 6. Recuperare tutti i centri sociali nel raggio di 10km da un punto
SELECT c.*, 
    (6371 * acos(cos(radians(?)) * cos(radians(c.latitudine)) * 
    cos(radians(c.longitudine) - radians(?)) + 
    sin(radians(?)) * sin(radians(c.latitudine)))) AS distanza
FROM Centri c
WHERE c.tipo = 'Sociale'
HAVING distanza < 10
ORDER BY distanza;
-- Parametri: latitudine, longitudine, latitudine (in questo ordine)

-- 7. Elenco delle trasformazioni per lotti scaduti in un periodo specifico
SELECT t.*, l.prodotto, l.quantita AS quantita_originale, c.nome AS centro_trasformazione
FROM Trasformazioni t
JOIN Lotti l ON t.lotto_origine_id = l.id
JOIN Centri c ON t.centro_trasformazione_id = c.id
WHERE t.data_trasformazione BETWEEN ? AND ?  -- Intervallo di date
ORDER BY t.data_trasformazione DESC;

-- 8. Dashboard: Impatto ambientale totale per centro
SELECT c.nome AS centro, 
       COUNT(DISTINCT l.id) AS lotti_salvati,
       SUM(CASE WHEN l.unita_misura = 'kg' THEN l.quantita 
                 WHEN l.unita_misura = 'g' THEN l.quantita / 1000.0
                 ELSE 0 END) AS kg_cibo_salvato,
       SUM(i.co2_risparmiata_kg) AS kg_co2_risparmiata,
       SUM(i.valore_economico) AS valore_economico_totale
FROM Centri c
LEFT JOIN Lotti l ON c.id = l.centro_origine_id
LEFT JOIN ImpattoCO2 i ON l.id = i.lotto_id
WHERE c.id = ?  -- ID del centro
GROUP BY c.id, c.nome;

-- 9. Calcolo automatico dell'impatto CO2 per un nuovo lotto (esempio di trigger)
CREATE TRIGGER IF NOT EXISTS after_lotto_insert
AFTER INSERT ON Lotti
BEGIN
    -- Calcola e inserisci l'impatto CO2 (calcolo semplificato)
    INSERT INTO ImpattoCO2 (
        lotto_id, co2_risparmiata_kg, valore_economico, metodo_calcolo
    )
    SELECT
        NEW.id,
        CASE 
            WHEN NEW.unita_misura = 'kg' THEN NEW.quantita * 2.5  -- 2.5 kg CO2 per kg di cibo salvato
            WHEN NEW.unita_misura = 'g' THEN NEW.quantita * 0.0025
            ELSE 0 
        END AS co2_risparmiata_kg,
        CASE 
            WHEN NEW.unita_misura = 'kg' THEN NEW.quantita * 3.0  -- 3.0 EUR per kg di cibo
            WHEN NEW.unita_misura = 'g' THEN NEW.quantita * 0.003
            ELSE 0 
        END AS valore_economico,
        'Calcolo standard basato su peso' AS metodo_calcolo;
END;

-- 10. Ottenere tutte le notifiche non lette per un utente
SELECT *
FROM Notifiche
WHERE destinatario_id = ?  -- ID dell'utente
AND letto = 0
ORDER BY creato_il DESC;

-- NUOVE QUERY PER LA GESTIONE JWT

-- 11. Generazione nuovo token JWT (al login)
INSERT INTO TokenAutenticazione (
    utente_id, 
    access_token, 
    refresh_token, 
    access_token_scadenza, 
    refresh_token_scadenza, 
    device_info, 
    ip_address
)
VALUES (
    ?,  -- ID utente autenticato
    ?,  -- Access token JWT generato
    ?,  -- Refresh token generato
    datetime('now', '+' || (SELECT valore FROM ParametriSistema WHERE chiave = 'jwt_access_token_durata') || ' seconds'),
    datetime('now', '+' || (SELECT valore FROM ParametriSistema WHERE chiave = 'jwt_refresh_token_durata') || ' seconds'),
    ?,  -- Informazioni sul dispositivo
    ?   -- Indirizzo IP
);

-- 12. Verificare la validità di un token JWT
SELECT u.id, u.email, u.nome, u.cognome, u.ruolo, t.access_token_scadenza, t.revocato
FROM TokenAutenticazione t
JOIN Utenti u ON t.utente_id = u.id
WHERE t.access_token = ?  -- Token fornito nella richiesta
AND t.access_token_scadenza > datetime('now')
AND t.revocato = 0
AND NOT EXISTS (
    SELECT 1 FROM TokenRevocati tr 
    WHERE tr.token_hash = ?  -- Hash del token JWT
);

-- 13. Rinnovo del token JWT usando il refresh token
UPDATE TokenAutenticazione
SET 
    access_token = ?,  -- Nuovo access token
    access_token_scadenza = datetime('now', '+' || (SELECT valore FROM ParametriSistema WHERE chiave = 'jwt_access_token_durata') || ' seconds')
WHERE refresh_token = ?  -- Refresh token fornito
AND refresh_token_scadenza > datetime('now')
AND revocato = 0;

-- 14. Revoca di un token JWT (al logout)
UPDATE TokenAutenticazione
SET 
    revocato = 1,
    revocato_il = CURRENT_TIMESTAMP
WHERE access_token = ?;  -- Token da revocare

-- 15. Revoca di tutti i token di un utente (cambio password o sospetto di compromissione)
UPDATE TokenAutenticazione
SET 
    revocato = 1,
    revocato_il = CURRENT_TIMESTAMP
WHERE utente_id = ?  -- ID utente
AND revocato = 0;

-- 16. Inserimento nella lista di revoca (blacklist)
INSERT INTO TokenRevocati (
    token_hash, 
    revocato_da, 
    motivo, 
    scadenza_originale
)
SELECT 
    ?,  -- Hash del token JWT
    ?,  -- ID dell'utente che ha effettuato la revoca
    ?,  -- Motivo della revoca
    t.access_token_scadenza
FROM TokenAutenticazione t
WHERE t.access_token = ?;  -- Token originale

-- 17. Pulizia dei token scaduti (job pianificato)
DELETE FROM TokenAutenticazione
WHERE (access_token_scadenza < datetime('now') AND refresh_token_scadenza < datetime('now'))
   OR (revocato = 1 AND revocato_il < datetime('now', '-30 days'));

-- 18. Pulizia della lista di revoca (job pianificato)
DELETE FROM TokenRevocati
WHERE scadenza_originale < datetime('now', '-1 day');

-- 19. Verificare i dispositivi attivi di un utente
SELECT 
    id,
    device_info,
    ip_address,
    creato_il,
    access_token_scadenza,
    refresh_token_scadenza
FROM TokenAutenticazione
WHERE utente_id = ?  -- ID utente
AND revocato = 0
AND refresh_token_scadenza > datetime('now')
ORDER BY creato_il DESC;

-- 20. Aggiornamento dell'ultimo accesso utente (al login)
UPDATE Utenti
SET ultimo_accesso = CURRENT_TIMESTAMP
WHERE id = ?;  -- ID utente 