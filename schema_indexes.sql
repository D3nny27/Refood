-- ***********************************************************************
-- INDICI PER OTTIMIZZAZIONE DELLE QUERY
-- ***********************************************************************

-- Indici per la tabella Attori
CREATE INDEX idx_attori_ruolo ON Attori(ruolo);

-- Indici per la tabella Lotti
CREATE INDEX idx_lotti_stato ON Lotti(stato);
CREATE INDEX idx_lotti_scadenza ON Lotti(data_scadenza);

-- Indici per la tabella Prenotazioni
CREATE INDEX idx_prenotazioni_stato ON Prenotazioni(stato);

-- Indici per la tabella Tipo_Utente
CREATE INDEX idx_tipo_utente_tipo ON Tipo_Utente(tipo);

-- Indici per la tabella TokenAutenticazione
CREATE INDEX idx_token_attore ON TokenAutenticazione(attore_id);

-- Indici per la tabella TokenRevocati
CREATE INDEX idx_token_revocati_hash ON TokenRevocati(token_hash);

-- Indici per la tabella AttoriTipoUtente
CREATE INDEX idx_attori_tipo_utente_attore_id ON AttoriTipoUtente(attore_id);
CREATE INDEX idx_attori_tipo_utente_tipo_utente_id ON AttoriTipoUtente(tipo_utente_id);

-- Indici per la tabella Notifiche
CREATE INDEX idx_notifiche_destinatario ON Notifiche(destinatario_id);
CREATE INDEX idx_notifiche_non_lette ON Notifiche(destinatario_id, letto, eliminato);
CREATE INDEX idx_notifiche_tipo ON Notifiche(tipo);
CREATE INDEX idx_notifiche_data ON Notifiche(creato_il); 