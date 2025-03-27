-- Schema Database per Refood: App contro lo spreco alimentare
-- Versione 1.0

-- STRUTTURA DEL SISTEMA:
-- Il sistema Refood è basato su un modello centralizzato con un centro di distribuzione centrale.
-- Nel flusso di registrazione, gli utenti possono scegliere tra due macro-categorie:
-- 1. ORGANIZZAZIONE: Utenti che gestiscono il sistema centrale, suddivisi in:
--    - Operatore: gestisce le operazioni quotidiane
--    - Amministratore: ha accesso completo al sistema e può gestire altri utenti
--
-- 2. UTENTE: Entità che interagiscono con il sistema centrale, suddivise in:
--    - Privato: utenti privati che possono prenotare prodotti
--    - Canale sociale: organizzazioni con finalità sociali
--    - Centro riciclo: centri che si occupano del riciclo di prodotti
--
-- Questa logica si riflette nello schema del database:
-- - Tabella Attori: contiene tutti gli utenti del sistema con ruolo 'Operatore', 'Amministratore' o 'Utente'
-- - Tabella Tipo_Utente: specifica la tipologia degli attori con ruolo 'Utente'
-- - Tabella AttoriTipoUtente: associa gli attori con ruolo 'Utente' alla loro tipologia specifica

-- Tabelle Principali già definite
CREATE TABLE Attori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    ruolo TEXT NOT NULL CHECK (ruolo IN ('Operatore', 'Amministratore', 'Utente')),
    ultimo_accesso TIMESTAMP,
    creato_da INTEGER,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creato_da) REFERENCES Attori(id)
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
    FOREIGN KEY (attore_id) REFERENCES Attori(id)
);

-- Nuova tabella per la gestione della lista di revoca dei token JWT
CREATE TABLE TokenRevocati (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    revocato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    motivo TEXT,
    revocato_da INTEGER,
    scadenza_originale TIMESTAMP NOT NULL,
    FOREIGN KEY (revocato_da) REFERENCES Attori(id)
);

-- Definizione delle tipologie di utenti che interagiscono con il sistema
-- Si applica SOLO agli attori con ruolo 'Utente' (non a Operatori o Amministratori)
-- Queste tipologie rappresentano le diverse categorie che possono interagire con il centro distribuzione
CREATE TABLE Tipo_Utente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('Privato', 'Canale sociale', 'centro riciclo')),
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
    tipo_utente_origine_id INTEGER NOT NULL,
    inserito_da INTEGER NOT NULL,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aggiornato_il TIMESTAMP,
    FOREIGN KEY (tipo_utente_origine_id) REFERENCES Tipo_Utente(id),
    FOREIGN KEY (inserito_da) REFERENCES Attori(id)
);

CREATE TABLE Prenotazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    tipo_utente_ricevente_id INTEGER NOT NULL,
    stato TEXT NOT NULL CHECK (stato IN ('Prenotato', 'InTransito', 'Consegnato', 'Annullato')),
    data_prenotazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_ritiro TIMESTAMP,
    data_consegna TIMESTAMP,
    note TEXT,
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id),
    FOREIGN KEY (tipo_utente_ricevente_id) REFERENCES Tipo_Utente(id)
);

CREATE TABLE Notifiche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titolo TEXT NOT NULL,
    messaggio TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('CambioStato', 'Prenotazione', 'Alert', 'LottoCreato', 'LottoModificato')),
    priorita TEXT NOT NULL DEFAULT 'Media' CHECK (priorita IN ('Bassa', 'Media', 'Alta')), 
    destinatario_id INTEGER NOT NULL,
    letto BOOLEAN DEFAULT 0,
    data_lettura TIMESTAMP,
    eliminato BOOLEAN DEFAULT 0,
    riferimento_id INTEGER,  -- ID del lotto o prenotazione associato
    riferimento_tipo TEXT,   -- Tipo di riferimento ('Lotto', 'Prenotazione', etc.)
    origine_id INTEGER,      -- ID dell'attore che ha generato la notifica
    tipo_utente_id INTEGER,       -- Tipo utente associato alla notifica
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (destinatario_id) REFERENCES Attori(id),
    FOREIGN KEY (origine_id) REFERENCES Attori(id),
    FOREIGN KEY (tipo_utente_id) REFERENCES Tipo_Utente(id)
);

CREATE TABLE LogCambioStato (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    stato_precedente TEXT NOT NULL,
    stato_nuovo TEXT NOT NULL,
    cambiato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cambiato_da INTEGER NOT NULL,
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id),
    FOREIGN KEY (cambiato_da) REFERENCES Attori(id)
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

-- Gestione delle relazioni tra Tipi Utente e Attori (appartenenza)
-- NOTA: Solo gli attori con ruolo 'Utente' possono essere associati a un Tipo_Utente.
-- Gli attori con ruolo 'Operatore' o 'Amministratore' NON devono essere associati a un Tipo_Utente.
CREATE TABLE AttoriTipoUtente (
    attore_id INTEGER NOT NULL,
    tipo_utente_id INTEGER NOT NULL,
    ruolo_specifico TEXT,
    data_inizio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (attore_id, tipo_utente_id),
    FOREIGN KEY (attore_id) REFERENCES Attori(id),
    FOREIGN KEY (tipo_utente_id) REFERENCES Tipo_Utente(id)
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
    tipo_utente_trasformazione_id INTEGER NOT NULL,
    quantita_trasformata REAL,
    data_trasformazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    FOREIGN KEY (lotto_origine_id) REFERENCES Lotti(id),
    FOREIGN KEY (tipo_utente_trasformazione_id) REFERENCES Tipo_Utente(id)
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
    FOREIGN KEY (prenotazione_id) REFERENCES Prenotazioni(id)
);

-- Statistiche e reportistica aggregata
CREATE TABLE StatisticheSettimanali (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_utente_id INTEGER NOT NULL,
    settimana INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    quantita_salvata REAL,
    peso_totale_kg REAL,
    co2_risparmiata_kg REAL,
    valore_economico REAL,
    numero_lotti INTEGER,
    FOREIGN KEY (tipo_utente_id) REFERENCES Tipo_Utente(id)
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
    FOREIGN KEY (modificato_da) REFERENCES Attori(id)
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
CREATE INDEX idx_attori_ruolo ON Attori(ruolo);
CREATE INDEX idx_tipo_utente_tipo ON Tipo_Utente(tipo);
CREATE INDEX idx_token_attore ON TokenAutenticazione(attore_id);
CREATE INDEX idx_token_revocati_hash ON TokenRevocati(token_hash);

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
WHEN OLD.attore_id != NEW.attore_id
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN (SELECT ruolo FROM Attori WHERE id = NEW.attore_id) != 'Utente'
        THEN RAISE(ABORT, 'Solo attori con ruolo Utente possono essere associati a un Tipo_Utente')
    END;
END;

-- Esempio di query geospaziale (commentato per evitare errori durante la creazione del database)
-- SELECT t.*, 
--     (6371 * acos(cos(radians(?)) * cos(radians(t.latitudine)) * 
--     cos(radians(t.longitudine) - radians(?)) + 
--     sin(radians(?)) * sin(radians(t.latitudine)))) AS distanza
-- FROM Tipo_Utente t
-- WHERE t.tipo = 'Canale sociale'
-- HAVING distanza < 10
-- ORDER BY distanza; 