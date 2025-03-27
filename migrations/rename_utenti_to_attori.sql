-- Script di migrazione per rinominare la tabella "Utenti" in "Attori"
-- Creato per Refood App - Version 1.0
-- IMPORTANTE: Eseguire un backup del database prima di applicare questa migrazione

-- Abilita la modalità transazione per garantire l'integrità dei dati
BEGIN TRANSACTION;

-- Step 1: Abilita foreign keys
PRAGMA foreign_keys = OFF;

-- Step 2: Crea la nuova tabella Attori con la stessa struttura di Utenti
CREATE TABLE Attori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    ruolo TEXT NOT NULL CHECK (ruolo IN ('Operatore', 'Amministratore', 'CentroSociale', 'CentroRiciclaggio')),
    ultimo_accesso TIMESTAMP,
    creato_da INTEGER,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creato_da) REFERENCES Attori(id)
);

-- Step 3: Copia tutti i dati da Utenti a Attori
INSERT INTO Attori (id, email, password, nome, cognome, ruolo, ultimo_accesso, creato_da, creato_il)
SELECT id, email, password, nome, cognome, ruolo, ultimo_accesso, creato_da, creato_il FROM Utenti;

-- Step 4: Rinomina la tabella UtentiCentri in AttoriCentri
CREATE TABLE AttoriCentri (
    attore_id INTEGER NOT NULL,
    centro_id INTEGER NOT NULL,
    ruolo_specifico TEXT,
    data_inizio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (attore_id, centro_id),
    FOREIGN KEY (attore_id) REFERENCES Attori(id),
    FOREIGN KEY (centro_id) REFERENCES Centri(id)
);

-- Step 5: Copia i dati da UtentiCentri a AttoriCentri
INSERT INTO AttoriCentri (attore_id, centro_id, ruolo_specifico, data_inizio)
SELECT utente_id, centro_id, ruolo_specifico, data_inizio FROM UtentiCentri;

-- Step 6: Aggiorna la tabella TokenAutenticazione per riferirsi a Attori
CREATE TABLE TokenAutenticazione_New (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attore_id INTEGER NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    access_token_scadenza TIMESTAMP NOT NULL,
    refresh_token_scadenza TIMESTAMP NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    revocato BOOLEAN DEFAULT 0,
    revocato_il TIMESTAMP,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attore_id) REFERENCES Attori(id)
);

INSERT INTO TokenAutenticazione_New (id, attore_id, access_token, refresh_token, access_token_scadenza, refresh_token_scadenza, device_info, ip_address, revocato, revocato_il, creato_il)
SELECT id, utente_id, access_token, refresh_token, access_token_scadenza, refresh_token_scadenza, device_info, ip_address, revocato, revocato_il, creato_il FROM TokenAutenticazione;

-- Step 7: Aggiorna la tabella TokenRevocati per riferirsi a Attori
CREATE TABLE TokenRevocati_New (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    revocato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    motivo TEXT,
    revocato_da INTEGER,
    scadenza_originale TIMESTAMP NOT NULL,
    FOREIGN KEY (revocato_da) REFERENCES Attori(id)
);

INSERT INTO TokenRevocati_New (id, token_hash, revocato_il, motivo, revocato_da, scadenza_originale)
SELECT id, token_hash, revocato_il, motivo, revocato_da, scadenza_originale FROM TokenRevocati;

-- Step 8: Aggiorna la tabella Lotti per riferirsi a Attori
CREATE TABLE Lotti_New (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prodotto TEXT NOT NULL,
    quantita REAL NOT NULL,
    unita_misura TEXT NOT NULL,
    data_scadenza DATE NOT NULL,
    giorni_permanenza INTEGER NOT NULL,
    stato TEXT NOT NULL CHECK (stato IN ('Verde', 'Arancione', 'Rosso')),
    centro_origine_id INTEGER NOT NULL,
    inserito_da INTEGER NOT NULL,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aggiornato_il TIMESTAMP,
    FOREIGN KEY (centro_origine_id) REFERENCES Centri(id),
    FOREIGN KEY (inserito_da) REFERENCES Attori(id)
);

INSERT INTO Lotti_New (id, prodotto, quantita, unita_misura, data_scadenza, giorni_permanenza, stato, centro_origine_id, inserito_da, creato_il, aggiornato_il)
SELECT id, prodotto, quantita, unita_misura, data_scadenza, giorni_permanenza, stato, centro_origine_id, inserito_da, creato_il, aggiornato_il FROM Lotti;

-- Step 9: Aggiorna la tabella Notifiche per riferirsi a Attori
CREATE TABLE Notifiche_New (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titolo TEXT NOT NULL,
    messaggio TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('CambioStato', 'Prenotazione', 'Alert', 'LottoCreato', 'LottoModificato')),
    priorita TEXT NOT NULL DEFAULT 'Media' CHECK (priorita IN ('Bassa', 'Media', 'Alta')), 
    destinatario_id INTEGER NOT NULL,
    letto BOOLEAN DEFAULT 0,
    data_lettura TIMESTAMP,
    eliminato BOOLEAN DEFAULT 0,
    riferimento_id INTEGER,
    riferimento_tipo TEXT,
    origine_id INTEGER,
    centro_id INTEGER,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (destinatario_id) REFERENCES Attori(id),
    FOREIGN KEY (origine_id) REFERENCES Attori(id),
    FOREIGN KEY (centro_id) REFERENCES Centri(id)
);

INSERT INTO Notifiche_New (id, titolo, messaggio, tipo, priorita, destinatario_id, letto, data_lettura, eliminato, riferimento_id, riferimento_tipo, origine_id, centro_id, creato_il)
SELECT id, titolo, messaggio, tipo, priorita, destinatario_id, letto, data_lettura, eliminato, riferimento_id, riferimento_tipo, origine_id, centro_id, creato_il FROM Notifiche;

-- Step 10: Aggiorna la tabella LogCambioStato per riferirsi a Attori
CREATE TABLE LogCambioStato_New (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    stato_precedente TEXT NOT NULL,
    stato_nuovo TEXT NOT NULL,
    cambiato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cambiato_da INTEGER NOT NULL,
    FOREIGN KEY (lotto_id) REFERENCES Lotti_New(id),
    FOREIGN KEY (cambiato_da) REFERENCES Attori(id)
);

INSERT INTO LogCambioStato_New (id, lotto_id, stato_precedente, stato_nuovo, cambiato_il, cambiato_da)
SELECT id, lotto_id, stato_precedente, stato_nuovo, cambiato_il, cambiato_da FROM LogCambioStato;

-- Step 11: Aggiorna la tabella ParametriSistema per riferirsi a Attori
CREATE TABLE ParametriSistema_New (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chiave TEXT NOT NULL UNIQUE,
    valore TEXT NOT NULL,
    descrizione TEXT,
    modificabile BOOLEAN DEFAULT 1,
    modificato_da INTEGER,
    modificato_il TIMESTAMP,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (modificato_da) REFERENCES Attori(id)
);

INSERT INTO ParametriSistema_New (id, chiave, valore, descrizione, modificabile, modificato_da, modificato_il, creato_il)
SELECT id, chiave, valore, descrizione, modificabile, modificato_da, modificato_il, creato_il FROM ParametriSistema;

-- Step 12: Elimina le vecchie tabelle
DROP TABLE Utenti;
DROP TABLE UtentiCentri;
DROP TABLE TokenAutenticazione;
DROP TABLE TokenRevocati;
DROP TABLE Lotti;
DROP TABLE Notifiche;
DROP TABLE LogCambioStato;
DROP TABLE ParametriSistema;

-- Step 13: Rinomina le nuove tabelle
ALTER TABLE Lotti_New RENAME TO Lotti;
ALTER TABLE Notifiche_New RENAME TO Notifiche;
ALTER TABLE LogCambioStato_New RENAME TO LogCambioStato;
ALTER TABLE TokenAutenticazione_New RENAME TO TokenAutenticazione;
ALTER TABLE TokenRevocati_New RENAME TO TokenRevocati;
ALTER TABLE ParametriSistema_New RENAME TO ParametriSistema;

-- Step 14: Ricrea gli indici
-- Creazione condizionale degli indici per evitare errori se esistono già
CREATE INDEX IF NOT EXISTS idx_attori_ruolo ON Attori(ruolo);

-- Non ricreare gli indici che potrebbero esistere già, SQLite li manterrà
-- quando le tabelle vengono rinominate 
CREATE INDEX IF NOT EXISTS idx_lotti_stato ON Lotti(stato);
CREATE INDEX IF NOT EXISTS idx_lotti_scadenza ON Lotti(data_scadenza);

-- Creazione di nuovi indici specifici per le nuove tabelle
CREATE INDEX idx_token_attore ON TokenAutenticazione(attore_id);
CREATE INDEX idx_attori_centri_attore_id ON AttoriCentri(attore_id);
CREATE INDEX idx_attori_centri_centro_id ON AttoriCentri(centro_id);

-- Step 15: Riabilita i controlli di foreign key
PRAGMA foreign_keys = ON;

-- Se tutto è andato bene, conferma la transazione
COMMIT;

-- Se ci sono errori, la transazione verrà annullata automaticamente
-- e sarà eseguito un rollback, preservando i dati originali 