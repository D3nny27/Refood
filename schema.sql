-- Schema Database per Refood: App contro lo spreco alimentare
-- Versione 2.0 - Aggiornato con la nuova struttura entità

-- Tabella Utenti (ex Centri) - rappresenta organizzazioni/centri
CREATE TABLE Utenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    indirizzo TEXT,
    latitudine REAL,
    longitudine REAL,
    telefono TEXT,
    tipo TEXT NOT NULL CHECK (tipo IN ('Privato', 'Canale sociale', 'Centro riciclo')),
    attivo INTEGER DEFAULT 1,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo_id INTEGER,
    email TEXT,
    attore_id INTEGER REFERENCES Attori(id),
    creato_da INTEGER REFERENCES Attori(id)
);

-- Tabella Attori (ex Utenti) - rappresenta persone fisiche
CREATE TABLE Attori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    ruolo TEXT NOT NULL CHECK (ruolo IN ('Operatore', 'Amministratore', 'Utente')),
    attivo INTEGER DEFAULT 1,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_accesso TIMESTAMP,
    utente_id INTEGER,
    creato_da INTEGER REFERENCES Attori(id),
    FOREIGN KEY (utente_id) REFERENCES Utenti(id) ON DELETE CASCADE
);

-- Nuova tabella per la gestione dei JWT
CREATE TABLE TokenAutenticazione (
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
    FOREIGN KEY (attore_id) REFERENCES Attori(id) ON DELETE CASCADE
);

-- Nuova tabella per la gestione della lista di revoca dei token JWT
CREATE TABLE TokenRevocati (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    attore_id INTEGER,
    revocato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    motivo TEXT,
    scadenza_originale TIMESTAMP NOT NULL,
    FOREIGN KEY (attore_id) REFERENCES Attori(id) ON DELETE SET NULL
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
    FOREIGN KEY (centro_origine_id) REFERENCES Utenti(id) ON DELETE RESTRICT,
    FOREIGN KEY (inserito_da) REFERENCES Attori(id) ON DELETE RESTRICT
);

CREATE TABLE Prenotazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    utente_id INTEGER NOT NULL,
    stato TEXT NOT NULL,
    attore_id INTEGER,
    data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_modifica TIMESTAMP,
    note TEXT,
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id) ON DELETE CASCADE,
    FOREIGN KEY (utente_id) REFERENCES Utenti(id) ON DELETE CASCADE,
    FOREIGN KEY (attore_id) REFERENCES Attori(id) ON DELETE SET NULL
);

CREATE TABLE Notifiche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titolo TEXT NOT NULL,
    messaggio TEXT NOT NULL,
    tipo TEXT NOT NULL,
    priorita TEXT NOT NULL DEFAULT 'Media',
    destinatario_id INTEGER,
    letto BOOLEAN DEFAULT 0,
    data_lettura TIMESTAMP,
    eliminato BOOLEAN DEFAULT 0,
    riferimento_id INTEGER,  -- ID del lotto o prenotazione associato
    riferimento_tipo TEXT,   -- Tipo di riferimento ('Lotto', 'Prenotazione', etc.)
    origine_id INTEGER,      -- ID dell'attore che ha generato la notifica
    centro_id INTEGER,       -- Utente associato alla notifica
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (destinatario_id) REFERENCES Attori(id) ON DELETE CASCADE,
    FOREIGN KEY (origine_id) REFERENCES Attori(id) ON DELETE SET NULL,
    FOREIGN KEY (centro_id) REFERENCES Utenti(id) ON DELETE SET NULL
);

CREATE TABLE LogCambioStato (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    stato_precedente TEXT NOT NULL,
    stato_nuovo TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    attore_id INTEGER,
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id) ON DELETE CASCADE,
    FOREIGN KEY (attore_id) REFERENCES Attori(id) ON DELETE SET NULL
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
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id) ON DELETE CASCADE,
    FOREIGN KEY (categoria_id) REFERENCES CategorieProdotti(id) ON DELETE CASCADE
);

-- Tracciamento specifico della filiera
CREATE TABLE OriginiProdotti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    produttore TEXT,
    localita_origine TEXT,
    km_percorsi INTEGER,
    metodo_produzione TEXT CHECK (metodo_produzione IN ('Biologico', 'Convenzionale', 'Biodinamico', 'Altro')),
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id) ON DELETE CASCADE
);

-- Gestione delle relazioni tra Attori e Utenti (appartenenza)
CREATE TABLE UtentiCentri (
    utente_id INTEGER NOT NULL,
    centro_id INTEGER NOT NULL,
    ruolo_specifico TEXT,
    data_inizio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (utente_id, centro_id),
    FOREIGN KEY (utente_id) REFERENCES Attori(id) ON DELETE CASCADE,
    FOREIGN KEY (centro_id) REFERENCES Utenti(id) ON DELETE CASCADE
);

-- Monitoraggio del valore salvato (economico ed ecologico)
CREATE TABLE ImpattoCO2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    co2_risparmiata_kg REAL,
    valore_economico REAL,
    metodo_calcolo TEXT,
    data_calcolo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id) ON DELETE CASCADE
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
    FOREIGN KEY (lotto_origine_id) REFERENCES Lotti(id) ON DELETE CASCADE,
    FOREIGN KEY (centro_trasformazione_id) REFERENCES Utenti(id) ON DELETE RESTRICT
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
    latitudine_origine REAL,
    longitudine_origine REAL,
    indirizzo_origine TEXT,
    latitudine_destinazione REAL,
    longitudine_destinazione REAL,
    indirizzo_destinazione TEXT,
    FOREIGN KEY (prenotazione_id) REFERENCES Prenotazioni(id) ON DELETE CASCADE
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
    FOREIGN KEY (centro_id) REFERENCES Utenti(id) ON DELETE CASCADE
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
    FOREIGN KEY (modificato_da) REFERENCES Attori(id) ON DELETE SET NULL
);

-- Tabella per gestire i tipi di centri (precedentemente CentriTipi)
CREATE TABLE CentriTipi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    descrizione TEXT,
    icona TEXT,
    colore TEXT,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserimento parametri di default
INSERT INTO ParametriSistema (chiave, valore, descrizione, modificabile) 
VALUES 
('soglia_stato_arancione', '3', 'Giorni alla scadenza per passare allo stato arancione', 1),
('soglia_stato_rosso', '1', 'Giorni alla scadenza per passare allo stato rosso', 1),
('jwt_access_token_durata', '3600', 'Durata in secondi del token JWT di accesso', 1),
('jwt_refresh_token_durata', '604800', 'Durata in secondi del refresh token (7 giorni)', 1),
('DEFAULT_USER_ROLE', 'Utente', 'Ruolo predefinito per i nuovi utenti', 1),
('DEFAULT_ADMIN_ROLE', 'Amministratore', 'Ruolo amministratore', 0),
('DEFAULT_OPERATOR_ROLE', 'Operatore', 'Ruolo operatore', 0);

-- Indici per ottimizzare le query più frequenti
CREATE INDEX idx_lotti_stato ON Lotti(stato);
CREATE INDEX idx_lotti_scadenza ON Lotti(data_scadenza);
CREATE INDEX idx_prenotazioni_stato ON Prenotazioni(stato);
CREATE INDEX idx_attori_email ON Attori(email);
CREATE INDEX idx_attori_ruolo ON Attori(ruolo);
CREATE INDEX idx_attori_utente_id ON Attori(utente_id);
CREATE INDEX idx_utenti_tipo ON Utenti(tipo);
CREATE INDEX idx_token_autenticazione_attore_id ON TokenAutenticazione(attore_id);
CREATE INDEX idx_token_revocati_attore_id ON TokenRevocati(attore_id);
CREATE INDEX idx_token_revocati_hash ON TokenRevocati(token_hash);
CREATE INDEX idx_log_cambio_stato_attore_id ON LogCambioStato(attore_id);
CREATE INDEX idx_prenotazioni_utente_id ON Prenotazioni(utente_id);
CREATE INDEX idx_prenotazioni_attore_id ON Prenotazioni(attore_id);
CREATE INDEX idx_notifiche_destinatario_id ON Notifiche(destinatario_id);
CREATE INDEX idx_notifiche_origine_id ON Notifiche(origine_id);
CREATE INDEX idx_utenti_centri_utente_id ON UtentiCentri(utente_id);
CREATE INDEX idx_utenti_centri_centro_id ON UtentiCentri(centro_id);

-- Esempio di query geospaziale (commentato per evitare errori durante la creazione del database)
-- SELECT c.*, 
--     (6371 * acos(cos(radians(?)) * cos(radians(c.latitudine)) * 
--     cos(radians(c.longitudine) - radians(?)) + 
--     sin(radians(?)) * sin(radians(c.latitudine)))) AS distanza
-- FROM Centri c
-- WHERE c.tipo = 'Sociale'
-- HAVING distanza < 10
-- ORDER BY distanza; 