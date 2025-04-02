-- ***********************************************************************
-- TRIGGER
-- ***********************************************************************

-- Trigger per garantire che solo attori con ruolo 'Utente' possano essere associati a un Tipo_Utente
CREATE TRIGGER IF NOT EXISTS check_attore_ruolo_before_insert
BEFORE INSERT ON AttoriTipoUtente
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN (SELECT ruolo FROM Attori WHERE id = NEW.attore_id) != 'Utente'
        THEN RAISE(ABORT, 'Solo attori con ruolo Utente possono essere associati a un Tipo_Utente')
    END;
END;

CREATE TRIGGER IF NOT EXISTS check_attore_ruolo_before_update
BEFORE UPDATE ON AttoriTipoUtente
FOR EACH ROW
WHEN OLD.attore_id != NEW.attore_id
BEGIN
    SELECT CASE
        WHEN (SELECT ruolo FROM Attori WHERE id = NEW.attore_id) != 'Utente'
        THEN RAISE(ABORT, 'Solo attori con ruolo Utente possono essere associati a un Tipo_Utente')
    END;
END;

-- Trigger per aggiornare automaticamente il campo 'aggiornato_il' nella tabella Lotti
CREATE TRIGGER IF NOT EXISTS update_lotti_timestamp
AFTER UPDATE ON Lotti
FOR EACH ROW
BEGIN
    UPDATE Lotti SET aggiornato_il = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger per registrare automaticamente i cambi di stato dei lotti nella tabella LogCambioStato
-- Corretto per utilizzare un ID di sistema valido se manca un operatore
CREATE TRIGGER IF NOT EXISTS log_cambio_stato_lotti
AFTER UPDATE OF stato ON Lotti
FOR EACH ROW
WHEN OLD.stato != NEW.stato
BEGIN
    -- Utilizza l'ID di un amministratore di sistema predefinito (in genere ID 1) se
    -- l'inserito_da è NULL o non valido
    INSERT INTO LogCambioStato (lotto_id, stato_precedente, stato_nuovo, cambiato_da)
    VALUES (
        NEW.id, 
        OLD.stato, 
        NEW.stato, 
        CASE 
            WHEN (SELECT COUNT(*) FROM Attori WHERE id = NEW.inserito_da) > 0 THEN NEW.inserito_da
            WHEN (SELECT COUNT(*) FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1) > 0 THEN (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1)
            ELSE 1 -- Fallback su ID 1 se non ci sono amministratori
        END
    );
END;

-- Trigger per impedire la modifica di lotti già prenotati
CREATE TRIGGER IF NOT EXISTS prevent_booked_lotto_modification
BEFORE UPDATE ON Lotti
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN (SELECT COUNT(*) FROM Prenotazioni WHERE lotto_id = NEW.id AND stato IN ('Prenotato', 'InAttesa', 'Confermato', 'ProntoPerRitiro', 'InTransito')) > 0
            AND (OLD.quantita != NEW.quantita OR OLD.data_scadenza != NEW.data_scadenza OR OLD.prodotto != NEW.prodotto)
        THEN RAISE(ABORT, 'Non è possibile modificare un lotto che ha prenotazioni attive')
    END;
END;

-- Trigger per aggiornare automaticamente lo stato di un lotto in base alla data di scadenza
-- Ottimizzato per evitare conflitti con altre operazioni
CREATE TRIGGER IF NOT EXISTS update_lotto_stato_by_scadenza
AFTER UPDATE OF data_scadenza ON Lotti
FOR EACH ROW
BEGIN
    -- Calcola il nuovo stato basato sulla data di scadenza
    UPDATE Lotti 
    SET stato = CASE
        WHEN julianday(NEW.data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') THEN 'Rosso'
        WHEN julianday(NEW.data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') THEN 'Arancione'
        ELSE 'Verde'
    END
    WHERE id = NEW.id AND stato != (
        CASE
            WHEN julianday(NEW.data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_rosso') THEN 'Rosso'
            WHEN julianday(NEW.data_scadenza) - julianday('now') <= (SELECT CAST(valore AS INTEGER) FROM ParametriSistema WHERE chiave = 'soglia_stato_arancione') THEN 'Arancione'
            ELSE 'Verde'
        END
    );
END;

-- Trigger per aggiornare automaticamente il campo 'updated_at' nella tabella Prenotazioni
CREATE TRIGGER IF NOT EXISTS update_prenotazioni_timestamp
AFTER UPDATE ON Prenotazioni
FOR EACH ROW
BEGIN
    UPDATE Prenotazioni SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger per tracciare le transizioni di stato delle prenotazioni
CREATE TRIGGER IF NOT EXISTS track_prenotazione_state_changes
AFTER UPDATE OF stato ON Prenotazioni
FOR EACH ROW
WHEN OLD.stato != NEW.stato
BEGIN
    UPDATE Prenotazioni
    SET transizioni_stato = CASE
        WHEN transizioni_stato IS NULL THEN json('{"transizioni": [{"da": "' || OLD.stato || '", "a": "' || NEW.stato || '", "timestamp": "' || datetime('now') || '"}]}')
        ELSE json_insert(transizioni_stato, '$.transizioni[#]', json('{"da": "' || OLD.stato || '", "a": "' || NEW.stato || '", "timestamp": "' || datetime('now') || '"}'))
    END
    WHERE id = NEW.id;
END; 