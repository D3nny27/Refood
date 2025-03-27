-- Migrazione database per la ristrutturazione delle entità
-- 1. Rinominare Utenti a Attori
-- 2. Rinominare Centri a Utenti
-- 3. Aggiornare le relazioni tra tabelle

-- Attivare modalità foreign_keys per garantire l'integrità referenziale
PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- =========================================
-- Step 1: Creare tabelle temporanee per i dati attuali
-- =========================================

-- Tabella temporanea per gli utenti attuali
CREATE TABLE temp_utenti AS SELECT * FROM Utenti;

-- Tabella temporanea per i centri attuali
CREATE TABLE temp_centri AS SELECT * FROM Centri;

-- Tabella temporanea per token autenticazione
CREATE TABLE temp_token_autenticazione AS SELECT * FROM TokenAutenticazione;

-- Tabella temporanea per token revocati
CREATE TABLE temp_token_revocati AS SELECT * FROM TokenRevocati;

-- Backup di altre tabelle con relazioni
CREATE TABLE temp_log_cambio_stato AS SELECT * FROM LogCambioStato;
CREATE TABLE temp_prenotazioni AS SELECT * FROM Prenotazioni;
CREATE TABLE temp_notifiche AS SELECT * FROM Notifiche;
CREATE TABLE temp_utenti_centri AS SELECT * FROM UtentiCentri;

-- =========================================
-- Step 2: Eliminare tabelle esistenti che dipendono dalle tabelle principali
-- =========================================

-- Eliminare tabelle con vincoli di chiave esterna che dipendono da Utenti o Centri
DROP TABLE IF EXISTS TokenAutenticazione;
DROP TABLE IF EXISTS TokenRevocati;
DROP TABLE IF EXISTS LogCambioStato;
DROP TABLE IF EXISTS Prenotazioni;
DROP TABLE IF EXISTS Notifiche;
DROP TABLE IF EXISTS UtentiCentri;

-- =========================================
-- Step 3: Eliminare tabelle principali
-- =========================================

DROP TABLE IF EXISTS Utenti;
DROP TABLE IF EXISTS Centri;

-- =========================================
-- Step 4: Creare le nuove tabelle con la struttura aggiornata
-- =========================================

-- Creare nuova tabella Attori (ex Utenti)
CREATE TABLE Attori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    ruolo TEXT NOT NULL CHECK(ruolo IN ('Operatore', 'Amministratore', 'Utente')),
    attivo INTEGER DEFAULT 1,
    creato_il TEXT DEFAULT (datetime('now', 'localtime')),
    ultimo_accesso TEXT,
    utente_id INTEGER,
    FOREIGN KEY (utente_id) REFERENCES Utenti(id) ON DELETE CASCADE
);

-- Creare tabella Utenti (ex Centri)
CREATE TABLE Utenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    indirizzo TEXT,
    citta TEXT,
    provincia TEXT,
    cap TEXT,
    telefono TEXT,
    tipo TEXT NOT NULL CHECK(tipo IN ('Privato', 'Canale sociale', 'Centro riciclo')),
    attivo INTEGER DEFAULT 1,
    creato_il TEXT DEFAULT (datetime('now', 'localtime')),
    note TEXT
);

-- Ricreare tabelle di supporto
CREATE TABLE TokenAutenticazione (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attore_id INTEGER NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token_scadenza TEXT NOT NULL,
    refresh_token_scadenza TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    revocato INTEGER DEFAULT 0,
    revocato_il TEXT,
    creato_il TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (attore_id) REFERENCES Attori(id) ON DELETE CASCADE
);

CREATE TABLE TokenRevocati (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL,
    attore_id INTEGER,
    revocato_il TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (attore_id) REFERENCES Attori(id) ON DELETE SET NULL
);

CREATE TABLE LogCambioStato (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER,
    stato_precedente TEXT,
    stato_nuovo TEXT,
    note TEXT,
    attore_id INTEGER,
    timestamp TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id) ON DELETE CASCADE,
    FOREIGN KEY (attore_id) REFERENCES Attori(id) ON DELETE SET NULL
);

CREATE TABLE Prenotazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    utente_id INTEGER NOT NULL,
    stato TEXT NOT NULL CHECK(stato IN ('Richiesta', 'Confermata', 'Ritirata', 'Annullata')),
    attore_id INTEGER,
    data_creazione TEXT DEFAULT (datetime('now', 'localtime')),
    data_modifica TEXT,
    note TEXT,
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id) ON DELETE CASCADE,
    FOREIGN KEY (utente_id) REFERENCES Utenti(id) ON DELETE CASCADE,
    FOREIGN KEY (attore_id) REFERENCES Attori(id) ON DELETE SET NULL
);

CREATE TABLE Notifiche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destinatario_id INTEGER,
    mittente_id INTEGER,
    titolo TEXT NOT NULL,
    messaggio TEXT NOT NULL,
    tipo TEXT NOT NULL,
    letto INTEGER DEFAULT 0,
    data_invio TEXT DEFAULT (datetime('now', 'localtime')),
    data_lettura TEXT,
    riferimento_id INTEGER,
    riferimento_tipo TEXT,
    FOREIGN KEY (destinatario_id) REFERENCES Attori(id) ON DELETE CASCADE,
    FOREIGN KEY (mittente_id) REFERENCES Attori(id) ON DELETE SET NULL
);

CREATE TABLE UtentiCentri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utente_id INTEGER NOT NULL,
    centro_id INTEGER NOT NULL,
    creato_il TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (utente_id) REFERENCES Attori(id) ON DELETE CASCADE,
    FOREIGN KEY (centro_id) REFERENCES Utenti(id) ON DELETE CASCADE
);

-- =========================================
-- Step 5: Migrare i dati alle nuove tabelle
-- =========================================

-- Inserire i dati in Utenti (ex Centri)
INSERT INTO Utenti (id, nome, indirizzo, citta, provincia, cap, telefono, tipo, attivo, creato_il, note)
SELECT 
    id, 
    nome, 
    indirizzo, 
    citta, 
    provincia, 
    cap, 
    telefono, 
    CASE 
        WHEN tipo = 'Sociale' THEN 'Canale sociale'
        WHEN tipo = 'Riciclo' THEN 'Centro riciclo'
        ELSE 'Privato'
    END as tipo,
    attivo, 
    creato_il, 
    note
FROM temp_centri;

-- Conserviamo in una tabella temporanea gli email duplicati
CREATE TABLE temp_email_duplicate AS
SELECT email, COUNT(*) as count
FROM (
    SELECT email FROM temp_utenti WHERE email IS NOT NULL AND email != ''
    UNION ALL
    SELECT email FROM temp_centri WHERE email IS NOT NULL AND email != ''
) 
GROUP BY email
HAVING COUNT(*) > 1;

-- Inserire i dati da Utenti a Attori
INSERT INTO Attori (id, email, password, nome, cognome, ruolo, attivo, creato_il, ultimo_accesso, utente_id)
SELECT 
    u.id, 
    u.email,
    u.password, 
    u.nome, 
    u.cognome, 
    CASE 
        WHEN u.ruolo = 'CentroSociale' THEN 'Utente'
        WHEN u.ruolo = 'CentroRiciclaggio' THEN 'Utente'
        ELSE u.ruolo
    END as ruolo,
    u.attivo, 
    u.creato_il, 
    u.ultimo_accesso,
    CASE 
        WHEN u.ruolo = 'CentroSociale' OR u.ruolo = 'CentroRiciclaggio' THEN
            (SELECT c.id FROM temp_centri c WHERE c.email = u.email LIMIT 1)
        ELSE NULL
    END as utente_id
FROM temp_utenti u
WHERE NOT EXISTS (
    SELECT 1 FROM Attori WHERE email = u.email
);

-- Migrazione da Centri a Attori per i centri che hanno un'email ma non corrispondono a utenti esistenti
INSERT INTO Attori (email, password, nome, cognome, ruolo, utente_id)
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM temp_email_duplicate d WHERE d.email = c.email) THEN
            c.email || '_centro_' || c.id -- Aggiungiamo un suffisso all'email duplicata
        ELSE c.email
    END as email,
    '$2a$10$RANDOM_HASH_FOR_SECURITY', -- Hash di password temporanea
    c.nome, 
    'Centro', -- Cognome generico
    'Utente', -- Ruolo: Utente
    c.id -- Collegamento al centro
FROM temp_centri c
WHERE c.email IS NOT NULL AND c.email != ''
    AND NOT EXISTS (SELECT 1 FROM Attori a WHERE a.email = c.email);

-- =========================================
-- Step 6: Aggiornare le relazioni nelle altre tabelle
-- =========================================

-- Aggiornare TokenAutenticazione per riferirsi a Attori invece di Utenti
INSERT INTO TokenAutenticazione (id, attore_id, access_token, refresh_token, access_token_scadenza, 
    refresh_token_scadenza, device_info, ip_address, revocato, revocato_il, creato_il)
SELECT id, utente_id, access_token, refresh_token, access_token_scadenza, 
    refresh_token_scadenza, device_info, ip_address, revocato, revocato_il, creato_il
FROM temp_token_autenticazione;

-- Aggiornare TokenRevocati per riferirsi a Attori invece di Utenti
INSERT INTO TokenRevocati (id, token, attore_id, revocato_il)
SELECT id, token, utente_id, revocato_il
FROM temp_token_revocati;

-- Aggiornare LogCambioStato per riferirsi a Attori invece di Utenti
INSERT INTO LogCambioStato (id, lotto_id, stato_precedente, stato_nuovo, note, attore_id, timestamp)
SELECT id, lotto_id, stato_precedente, stato_nuovo, note, utente_id, timestamp
FROM temp_log_cambio_stato;

-- Aggiornare Prenotazioni per riferirsi sia a Attori che a Utenti
INSERT INTO Prenotazioni (id, lotto_id, utente_id, stato, attore_id, data_creazione, data_modifica, note)
SELECT 
    id, 
    lotto_id, 
    centro_id as utente_id, 
    stato, 
    utente_id as attore_id, 
    data_creazione, 
    data_modifica, 
    note
FROM temp_prenotazioni;

-- Aggiornare Notifiche per riferirsi a Attori
INSERT INTO Notifiche (id, destinatario_id, mittente_id, titolo, messaggio, tipo, letto, data_invio, data_lettura, riferimento_id, riferimento_tipo)
SELECT id, destinatario_id, mittente_id, titolo, messaggio, tipo, letto, data_invio, data_lettura, riferimento_id, riferimento_tipo
FROM temp_notifiche;

-- Aggiornare UtentiCentri per riferirsi a Attori e Utenti
INSERT INTO UtentiCentri (id, utente_id, centro_id, creato_il)
SELECT id, utente_id, centro_id, creato_il
FROM temp_utenti_centri;

-- =========================================
-- Step 7: Creare indici per migliorare le prestazioni
-- =========================================

CREATE INDEX idx_attori_email ON Attori(email);
CREATE INDEX idx_attori_ruolo ON Attori(ruolo);
CREATE INDEX idx_attori_utente_id ON Attori(utente_id);
CREATE INDEX idx_utenti_tipo ON Utenti(tipo);
CREATE INDEX idx_token_autenticazione_attore_id ON TokenAutenticazione(attore_id);
CREATE INDEX idx_token_revocati_attore_id ON TokenRevocati(attore_id);
CREATE INDEX idx_log_cambio_stato_attore_id ON LogCambioStato(attore_id);
CREATE INDEX idx_prenotazioni_utente_id ON Prenotazioni(utente_id);
CREATE INDEX idx_prenotazioni_attore_id ON Prenotazioni(attore_id);
CREATE INDEX idx_notifiche_destinatario_id ON Notifiche(destinatario_id);
CREATE INDEX idx_notifiche_mittente_id ON Notifiche(mittente_id);
CREATE INDEX idx_utenti_centri_utente_id ON UtentiCentri(utente_id);
CREATE INDEX idx_utenti_centri_centro_id ON UtentiCentri(centro_id);

-- =========================================
-- Step 8: Eliminare le tabelle temporanee
-- =========================================

DROP TABLE temp_utenti;
DROP TABLE temp_centri;
DROP TABLE temp_token_autenticazione;
DROP TABLE temp_token_revocati;
DROP TABLE temp_log_cambio_stato;
DROP TABLE temp_prenotazioni;
DROP TABLE temp_notifiche;
DROP TABLE temp_utenti_centri;
DROP TABLE temp_email_duplicate;

-- =========================================
-- Step 9: Inserire parametri di sistema predefiniti
-- =========================================

INSERT INTO ParametriSistema (chiave, valore, descrizione, modificabile)
VALUES 
('DEFAULT_USER_ROLE', 'Utente', 'Ruolo predefinito per i nuovi utenti', 1),
('DEFAULT_ADMIN_ROLE', 'Amministratore', 'Ruolo amministratore', 0),
('DEFAULT_OPERATOR_ROLE', 'Operatore', 'Ruolo operatore', 0);

COMMIT;

-- Riattivare foreign_keys
PRAGMA foreign_keys = ON; 