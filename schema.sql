-- Schema Database per Refood: App contro lo spreco alimentare
-- Versione 1.0

-- Tabelle Principali già definite
CREATE TABLE Utenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    ruolo TEXT NOT NULL CHECK (ruolo IN ('Operatore', 'Amministratore', 'CentroSociale', 'CentroRiciclaggio')),
    ultimo_accesso TIMESTAMP,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Nuova tabella per la gestione dei JWT
CREATE TABLE TokenAutenticazione (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utente_id INTEGER NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    access_token_scadenza TIMESTAMP NOT NULL,
    refresh_token_scadenza TIMESTAMP NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    revocato BOOLEAN DEFAULT 0,
    revocato_il TIMESTAMP,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utente_id) REFERENCES Utenti(id)
);

-- Nuova tabella per la gestione della lista di revoca dei token JWT
CREATE TABLE TokenRevocati (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    revocato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    motivo TEXT,
    revocato_da INTEGER,
    scadenza_originale TIMESTAMP NOT NULL,
    FOREIGN KEY (revocato_da) REFERENCES Utenti(id)
);

CREATE TABLE Centri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Distribuzione', 'Sociale', 'Riciclaggio')),
    indirizzo TEXT NOT NULL,
    latitudine REAL,
    longitudine REAL,
    telefono TEXT,
    email TEXT,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Lotti (
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
    FOREIGN KEY (inserito_da) REFERENCES Utenti(id)
);

CREATE TABLE Prenotazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    centro_ricevente_id INTEGER NOT NULL,
    stato TEXT NOT NULL CHECK (stato IN ('Prenotato', 'InTransito', 'Consegnato', 'Annullato')),
    data_prenotazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_ritiro TIMESTAMP,
    data_consegna TIMESTAMP,
    note TEXT,
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id),
    FOREIGN KEY (centro_ricevente_id) REFERENCES Centri(id)
);

CREATE TABLE Notifiche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('CambioStato', 'Prenotazione', 'Alert')),
    messaggio TEXT NOT NULL,
    destinatario_id INTEGER NOT NULL,
    letto BOOLEAN DEFAULT 0,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (destinatario_id) REFERENCES Utenti(id)
);

CREATE TABLE LogCambioStato (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    stato_precedente TEXT NOT NULL,
    stato_nuovo TEXT NOT NULL,
    cambiato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cambiato_da INTEGER NOT NULL,
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id),
    FOREIGN KEY (cambiato_da) REFERENCES Utenti(id)
);

-- Tabelle Aggiuntive per completare l'ecosistema

-- Categorizzazione dei prodotti alimentari
CREATE TABLE CategorieProdotti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    descrizione TEXT,
    tempo_medio_permanenza INTEGER, -- in giorni, valore di default per questa categoria
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relazione tra Lotti e Categorie
CREATE TABLE LottiCategorie (
    lotto_id INTEGER NOT NULL,
    categoria_id INTEGER NOT NULL,
    PRIMARY KEY (lotto_id, categoria_id),
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id),
    FOREIGN KEY (categoria_id) REFERENCES CategorieProdotti(id)
);

-- Tracciamento specifico della filiera
CREATE TABLE OriginiProdotti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    produttore TEXT,
    localita_origine TEXT,
    km_percorsi INTEGER,
    metodo_produzione TEXT CHECK (metodo_produzione IN ('Biologico', 'Convenzionale', 'Biodinamico', 'Altro')),
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id)
);

-- Gestione delle relazioni tra Centri e Utenti (appartenenza)
CREATE TABLE UtentiCentri (
    utente_id INTEGER NOT NULL,
    centro_id INTEGER NOT NULL,
    ruolo_specifico TEXT,
    data_inizio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (utente_id, centro_id),
    FOREIGN KEY (utente_id) REFERENCES Utenti(id),
    FOREIGN KEY (centro_id) REFERENCES Centri(id)
);

-- Monitoraggio del valore salvato (economico ed ecologico)
CREATE TABLE ImpattoCO2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    co2_risparmiata_kg REAL,
    valore_economico REAL,
    metodo_calcolo TEXT,
    data_calcolo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id)
);

-- Per trasformazioni circolari dei prodotti (ad es. lotti scaduti trasformati in compost o biogas)
CREATE TABLE Trasformazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_origine_id INTEGER NOT NULL,
    tipo_trasformazione TEXT NOT NULL CHECK (tipo_trasformazione IN ('Compost', 'Biogas', 'Alimentazione animale', 'Altro')),
    centro_trasformazione_id INTEGER NOT NULL,
    quantita_trasformata REAL,
    data_trasformazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    FOREIGN KEY (lotto_origine_id) REFERENCES Lotti(id),
    FOREIGN KEY (centro_trasformazione_id) REFERENCES Centri(id)
);

-- Gestione dei trasporti per la logistica
CREATE TABLE Trasporti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prenotazione_id INTEGER NOT NULL,
    mezzo TEXT NOT NULL,
    distanza_km REAL,
    emissioni_co2 REAL,
    costo REAL,
    autista TEXT,
    telefono_autista TEXT,
    orario_partenza TIMESTAMP,
    orario_arrivo TIMESTAMP,
    stato TEXT NOT NULL CHECK (stato IN ('Pianificato', 'InCorso', 'Completato', 'Annullato')),
    FOREIGN KEY (prenotazione_id) REFERENCES Prenotazioni(id)
);

-- Statistiche e reportistica aggregata
CREATE TABLE StatisticheSettimanali (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro_id INTEGER NOT NULL,
    settimana INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    quantita_salvata REAL,
    peso_totale_kg REAL,
    co2_risparmiata_kg REAL,
    valore_economico REAL,
    numero_lotti INTEGER,
    FOREIGN KEY (centro_id) REFERENCES Centri(id)
);

-- Tabella per configurazione parametri sistema
CREATE TABLE ParametriSistema (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chiave TEXT NOT NULL UNIQUE,
    valore TEXT NOT NULL,
    descrizione TEXT,
    modificabile BOOLEAN DEFAULT 1,
    modificato_da INTEGER,
    modificato_il TIMESTAMP,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (modificato_da) REFERENCES Utenti(id)
);

-- Inserimento parametri di default
INSERT INTO ParametriSistema (chiave, valore, descrizione) 
VALUES 
('soglia_stato_arancione', '3', 'Giorni alla scadenza per passare allo stato arancione'),
('soglia_stato_rosso', '1', 'Giorni alla scadenza per passare allo stato rosso'),
('jwt_access_token_durata', '3600', 'Durata in secondi del token JWT di accesso'),
('jwt_refresh_token_durata', '604800', 'Durata in secondi del refresh token (7 giorni)');

-- Indici per ottimizzare le query più frequenti
CREATE INDEX idx_lotti_stato ON Lotti(stato);
CREATE INDEX idx_lotti_scadenza ON Lotti(data_scadenza);
CREATE INDEX idx_prenotazioni_stato ON Prenotazioni(stato);
CREATE INDEX idx_utenti_ruolo ON Utenti(ruolo);
CREATE INDEX idx_centri_tipo ON Centri(tipo);
CREATE INDEX idx_token_utente ON TokenAutenticazione(utente_id);
CREATE INDEX idx_token_revocati_hash ON TokenRevocati(token_hash);

-- Esempio di query geospaziale (commentato per evitare errori durante la creazione del database)
-- SELECT c.*, 
--     (6371 * acos(cos(radians(?)) * cos(radians(c.latitudine)) * 
--     cos(radians(c.longitudine) - radians(?)) + 
--     sin(radians(?)) * sin(radians(c.latitudine)))) AS distanza
-- FROM Centri c
-- WHERE c.tipo = 'Sociale'
-- HAVING distanza < 10
-- ORDER BY distanza; 