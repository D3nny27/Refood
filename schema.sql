-- Schema Database per Refood: App contro lo spreco alimentare
-- Versione 2.0
-- Ultimo aggiornamento: 2023

-- ***********************************************************************
-- STRUTTURA DEL SISTEMA:
-- ***********************************************************************
-- Il sistema Refood è basato su un modello centralizzato per la gestione dei lotti alimentari e delle prenotazioni.
-- Nel flusso di registrazione, gli utenti possono scegliere tra due macro-categorie:
-- 
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
--
-- ***********************************************************************
-- EVOLUZIONE DEL DATABASE:
-- ***********************************************************************
-- Il database ha subito diverse evoluzioni nel tempo:
-- 1. Aggiunta campi di autenticazione e token JWT
-- 2. Aggiunta campi per la gestione dei prezzi nella tabella Lotti
-- 3. Aggiunta campi aggiuntivi di tracciamento nella tabella Prenotazioni
-- 4. Migrazione da 'cognome_old' a 'cognome' nella tabella Attori
-- 5. Aggiunta di indirizzo_ritiro, telefono_ritiro e email_ritiro nella tabella Prenotazioni
-- 6. Aggiunta di attore_id nella tabella Prenotazioni per tracciare chi ha effettuato la prenotazione
--
-- ***********************************************************************
-- TABELLE PRINCIPALI
-- ***********************************************************************

-- Tabella Attori: rappresenta gli utenti del sistema
-- Nota: il campo 'cognome_old' è stato mantenuto per retrocompatibilità e sostituito da 'cognome'
CREATE TABLE Attori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,                                  -- Email univoca per l'autenticazione
    password TEXT NOT NULL,                                      -- Password hash dell'utente
    nome TEXT NOT NULL,                                          -- Nome dell'utente
    cognome_old TEXT NOT NULL,                                   -- Campo deprecato, mantenuto per compatibilità
    ruolo TEXT NOT NULL CHECK (ruolo IN ('Operatore', 'Amministratore', 'Utente')), -- Ruolo dell'utente
    ultimo_accesso TIMESTAMP,                                    -- Data/ora ultimo accesso
    creato_da INTEGER,                                           -- ID dell'attore che ha creato questo account
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,               -- Data/ora di creazione
    cognome TEXT,                                                -- Nuovo campo per il cognome
    FOREIGN KEY (creato_da) REFERENCES Attori(id)                -- Relazione con l'attore creatore
);

-- Tabella per la gestione dei token JWT
-- Memorizza i token di accesso e refresh per ogni dispositivo
CREATE TABLE TokenAutenticazione (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attore_id INTEGER NOT NULL,                                  -- Riferimento all'attore proprietario del token
    access_token TEXT,                                           -- Token di accesso JWT
    refresh_token TEXT,                                          -- Token di refresh JWT
    access_token_scadenza TIMESTAMP NOT NULL,                    -- Data/ora di scadenza del token di accesso
    refresh_token_scadenza TIMESTAMP NOT NULL,                   -- Data/ora di scadenza del token di refresh
    device_info TEXT,                                            -- Informazioni sul dispositivo
    ip_address TEXT,                                             -- Indirizzo IP del client
    revocato BOOLEAN DEFAULT 0,                                  -- Flag per token revocato
    revocato_il TIMESTAMP,                                       -- Data/ora di revoca
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,               -- Data/ora di creazione
    FOREIGN KEY (attore_id) REFERENCES Attori(id)                -- Relazione con l'attore
);

-- Tabella per la gestione della lista di revoca dei token JWT
-- Usata per verificare se un token è stato esplicitamente revocato
CREATE TABLE TokenRevocati (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,                             -- Hash del token revocato
    revocato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,             -- Data/ora di revoca
    motivo TEXT,                                                 -- Motivo della revoca
    revocato_da INTEGER,                                         -- Attore che ha effettuato la revoca
    scadenza_originale TIMESTAMP NOT NULL,                       -- Data/ora di scadenza originale
    FOREIGN KEY (revocato_da) REFERENCES Attori(id)              -- Relazione con l'attore che ha revocato
);

-- Definizione delle tipologie di utenti che interagiscono con il sistema
-- Si applica SOLO agli attori con ruolo 'Utente' (non a Operatori o Amministratori)
-- Queste tipologie rappresentano le diverse categorie che possono interagire col sistema
CREATE TABLE Tipo_Utente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('Privato', 'Canale sociale', 'centro riciclo')), -- Tipologia dell'utente
    indirizzo TEXT NOT NULL,                                     -- Indirizzo fisico
    email TEXT,                                                  -- Email di contatto specifico per il tipo utente
    telefono TEXT,                                               -- Telefono di contatto
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP                -- Data/ora di creazione
);

-- Tabella Lotti: rappresenta i lotti alimentari disponibili
-- Ogni lotto ha una tipologia, una quantità, un'unità di misura e una scadenza
-- Il campo tipo_utente_origine_id indica chi ha fornito il lotto
CREATE TABLE Lotti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prodotto TEXT NOT NULL,                                      -- Nome del prodotto
    quantita REAL NOT NULL,                                      -- Quantità disponibile
    unita_misura TEXT NOT NULL,                                  -- Unità di misura (kg, lt, pz, etc.)
    data_scadenza DATE NOT NULL,                                 -- Data di scadenza
    giorni_permanenza INTEGER NOT NULL,                          -- Giorni previsti di permanenza a magazzino
    stato TEXT NOT NULL CHECK (stato IN ('Verde', 'Arancione', 'Rosso')), -- Stato del lotto in base alla scadenza
    inserito_da INTEGER NOT NULL,                                -- ID dell'attore che ha inserito il lotto
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,               -- Data/ora di creazione
    aggiornato_il TIMESTAMP,                                     -- Data/ora ultimo aggiornamento
    tipo_utente_origine_id INTEGER,                              -- Riferimento al tipo utente che ha fornito il lotto
    prezzo REAL DEFAULT NULL,                                    -- Prezzo del lotto (aggiunto successivamente)
    FOREIGN KEY (inserito_da) REFERENCES Attori(id),             -- Relazione con l'attore che ha inserito
    FOREIGN KEY (tipo_utente_origine_id) REFERENCES Tipo_Utente(id) -- Relazione con il tipo utente di origine
);

-- Tabella Prenotazioni: rappresenta le prenotazioni dei lotti
-- Gestisce il ciclo di vita delle prenotazioni, dal momento della richiesta fino alla consegna
CREATE TABLE Prenotazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,                                   -- Riferimento al lotto prenotato
    tipo_utente_ricevente_id INTEGER NOT NULL,                   -- Riferimento al tipo utente che riceve
    stato TEXT NOT NULL CHECK (                                  -- Stato della prenotazione
        stato IN ('Prenotato', 'InAttesa', 'Confermato', 'ProntoPerRitiro', 
                 'Rifiutato', 'InTransito', 'Consegnato', 'Annullato', 'Eliminato')
    ),
    data_prenotazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Data/ora della prenotazione
    data_ritiro TIMESTAMP,                                       -- Data/ora del ritiro previsto
    data_consegna TIMESTAMP,                                     -- Data/ora della consegna effettiva
    note TEXT,                                                   -- Note generali
    tipo_pagamento TEXT DEFAULT NULL,                            -- Metodo di pagamento (contanti, bonifico)
    ritirato_da TEXT DEFAULT NULL,                               -- Nome di chi ha ritirato fisicamente
    documento_ritiro TEXT DEFAULT NULL,                          -- Estremi documento di chi ha ritirato
    data_ritiro_effettivo DATETIME DEFAULT NULL,                 -- Data/ora del ritiro effettivo
    note_ritiro TEXT DEFAULT NULL,                               -- Note sul ritiro
    operatore_ritiro INTEGER DEFAULT NULL,                       -- ID dell'operatore che ha gestito il ritiro
    transizioni_stato TEXT DEFAULT NULL,                         -- JSON con storico transizioni di stato
    attore_id INTEGER,                                           -- Riferimento all'attore che ha effettuato la prenotazione
    updated_at DATETIME DEFAULT NULL,                            -- Data/ora ultimo aggiornamento
    indirizzo_ritiro TEXT,                                       -- Indirizzo di chi ritira
    telefono_ritiro TEXT,                                        -- Telefono di chi ritira
    email_ritiro TEXT,                                           -- Email di chi ritira
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id),                 -- Relazione con il lotto
    FOREIGN KEY (tipo_utente_ricevente_id) REFERENCES Tipo_Utente(id), -- Relazione con il tipo utente ricevente
    FOREIGN KEY (attore_id) REFERENCES Attori(id)                -- Relazione con l'attore che ha prenotato
);

-- Tabella Notifiche: sistema di notifiche interne all'applicazione
-- Permette di inviare avvisi e aggiornamenti agli utenti del sistema
CREATE TABLE Notifiche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titolo TEXT NOT NULL,                                        -- Titolo della notifica
    messaggio TEXT NOT NULL,                                     -- Contenuto della notifica
    tipo TEXT NOT NULL CHECK (                                   -- Tipologia di notifica
        tipo IN ('CambioStato', 'Prenotazione', 'Alert', 'LottoCreato', 'LottoModificato')
    ),
    priorita TEXT NOT NULL DEFAULT 'Media' CHECK (               -- Priorità della notifica
        priorita IN ('Bassa', 'Media', 'Alta')
    ), 
    destinatario_id INTEGER NOT NULL,                            -- Attore destinatario
    letto BOOLEAN DEFAULT 0,                                     -- Flag che indica se è stata letta
    data_lettura TIMESTAMP,                                      -- Data/ora lettura
    eliminato BOOLEAN DEFAULT 0,                                 -- Flag che indica se è stata eliminata
    riferimento_id INTEGER,                                      -- ID del lotto o prenotazione associato
    riferimento_tipo TEXT,                                       -- Tipo di riferimento ('Lotto', 'Prenotazione', etc.)
    origine_id INTEGER,                                          -- ID dell'attore che ha generato la notifica
    tipo_utente_id INTEGER,                                      -- Tipo utente associato alla notifica
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,               -- Data/ora di creazione
    FOREIGN KEY (destinatario_id) REFERENCES Attori(id),         -- Relazione con l'attore destinatario
    FOREIGN KEY (origine_id) REFERENCES Attori(id),              -- Relazione con l'attore origine
    FOREIGN KEY (tipo_utente_id) REFERENCES Tipo_Utente(id)      -- Relazione con il tipo utente
);

-- Tabella LogCambioStato: registra i cambiamenti di stato dei lotti
-- Utile per l'audit trail e per tracciare la storia di ogni lotto
CREATE TABLE LogCambioStato (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,                                   -- Riferimento al lotto
    stato_precedente TEXT NOT NULL,                              -- Stato precedente
    stato_nuovo TEXT NOT NULL,                                   -- Nuovo stato
    cambiato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,             -- Data/ora del cambiamento
    cambiato_da INTEGER NOT NULL,                                -- Attore che ha effettuato il cambiamento
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id),                 -- Relazione con il lotto
    FOREIGN KEY (cambiato_da) REFERENCES Attori(id)              -- Relazione con l'attore
);

-- ***********************************************************************
-- TABELLE AGGIUNTIVE PER COMPLETARE L'ECOSISTEMA
-- ***********************************************************************

-- Categorizzazione dei prodotti alimentari
-- Permette di organizzare i lotti in categorie specifiche
CREATE TABLE CategorieProdotti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,                                   -- Nome categoria
    descrizione TEXT,                                            -- Descrizione
    tempo_medio_permanenza INTEGER,                              -- Tempo medio di permanenza in giorni
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP                -- Data/ora di creazione
);

-- Relazione molti-a-molti tra Lotti e Categorie
-- Un lotto può appartenere a più categorie e una categoria può contenere più lotti
CREATE TABLE LottiCategorie (
    lotto_id INTEGER NOT NULL,                                   -- Riferimento al lotto
    categoria_id INTEGER NOT NULL,                               -- Riferimento alla categoria
    PRIMARY KEY (lotto_id, categoria_id),                        -- Chiave primaria composta
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id),                 -- Relazione con il lotto
    FOREIGN KEY (categoria_id) REFERENCES CategorieProdotti(id)  -- Relazione con la categoria
);

-- Tracciamento specifico della filiera
-- Informazioni dettagliate sull'origine dei prodotti
CREATE TABLE OriginiProdotti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,                                   -- Riferimento al lotto
    produttore TEXT,                                             -- Nome del produttore
    localita_origine TEXT,                                       -- Località di origine
    km_percorsi INTEGER,                                         -- Chilometri percorsi
    metodo_produzione TEXT CHECK (                               -- Metodo di produzione
        metodo_produzione IN ('Biologico', 'Convenzionale', 'Biodinamico', 'Altro')
    ),
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id)                  -- Relazione con il lotto
);

-- Gestione delle relazioni tra Tipi Utente e Attori (appartenenza)
-- NOTA: Solo gli attori con ruolo 'Utente' possono essere associati a un Tipo_Utente
CREATE TABLE AttoriTipoUtente (
    attore_id INTEGER NOT NULL,                                  -- Riferimento all'attore
    tipo_utente_id INTEGER NOT NULL,                             -- Riferimento al tipo utente
    ruolo_specifico TEXT,                                        -- Ruolo specifico all'interno dell'organizzazione
    data_inizio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,             -- Data di inizio rapporto
    PRIMARY KEY (attore_id, tipo_utente_id),                     -- Chiave primaria composta
    FOREIGN KEY (attore_id) REFERENCES Attori(id),               -- Relazione con l'attore
    FOREIGN KEY (tipo_utente_id) REFERENCES Tipo_Utente(id)      -- Relazione con il tipo utente
);

-- Monitoraggio dell'impatto ambientale ed economico
-- Calcolo e tracciamento dei benefici ambientali dei lotti salvati
CREATE TABLE ImpattoCO2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,                                   -- Riferimento al lotto
    co2_risparmiata_kg REAL,                                     -- CO2 risparmiata in kg
    valore_economico REAL,                                       -- Valore economico stimato
    metodo_calcolo TEXT,                                         -- Metodo utilizzato per il calcolo
    data_calcolo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,            -- Data/ora del calcolo
    FOREIGN KEY (lotto_id) REFERENCES Lotti(id)                  -- Relazione con il lotto
);

-- Per trasformazioni circolari dei prodotti (ad es. lotti scaduti trasformati in compost)
-- Traccia come i lotti vengono riutilizzati in altri processi dopo la vita utile
CREATE TABLE Trasformazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_origine_id INTEGER NOT NULL,                           -- Riferimento al lotto originale
    tipo_trasformazione TEXT NOT NULL CHECK (                    -- Tipo di trasformazione
        tipo_trasformazione IN ('Compost', 'Biogas', 'Alimentazione animale', 'Altro')
    ),
    tipo_utente_trasformazione_id INTEGER NOT NULL,              -- Tipo utente che effettua la trasformazione
    quantita_trasformata REAL,                                   -- Quantità trasformata
    data_trasformazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,     -- Data/ora della trasformazione
    note TEXT,                                                   -- Note aggiuntive
    FOREIGN KEY (lotto_origine_id) REFERENCES Lotti(id),         -- Relazione con il lotto
    FOREIGN KEY (tipo_utente_trasformazione_id) REFERENCES Tipo_Utente(id) -- Relazione con il tipo utente
);

-- Gestione dei trasporti per la logistica
-- Tracciamento dettagliato dei trasporti associati alle prenotazioni
CREATE TABLE Trasporti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prenotazione_id INTEGER NOT NULL,                            -- Riferimento alla prenotazione
    mezzo TEXT NOT NULL,                                         -- Mezzo di trasporto
    distanza_km REAL,                                            -- Distanza percorsa
    emissioni_co2 REAL,                                          -- Emissioni CO2 stimate
    costo REAL,                                                  -- Costo del trasporto
    autista TEXT,                                                -- Nome dell'autista
    telefono_autista TEXT,                                       -- Telefono dell'autista
    orario_partenza TIMESTAMP,                                   -- Orario di partenza
    orario_arrivo TIMESTAMP,                                     -- Orario di arrivo
    stato TEXT NOT NULL CHECK (                                  -- Stato del trasporto
        stato IN ('Pianificato', 'InCorso', 'Completato', 'Annullato')
    ),
    latitudine_origine REAL,                                     -- Latitudine origine
    longitudine_origine REAL,                                    -- Longitudine origine
    indirizzo_origine TEXT,                                      -- Indirizzo origine
    latitudine_destinazione REAL,                                -- Latitudine destinazione
    longitudine_destinazione REAL,                               -- Longitudine destinazione
    indirizzo_destinazione TEXT,                                 -- Indirizzo destinazione
    FOREIGN KEY (prenotazione_id) REFERENCES Prenotazioni(id)    -- Relazione con la prenotazione
);

-- Statistiche e reportistica aggregata
-- Dati aggregati settimanali per tipologia di utente
CREATE TABLE StatisticheSettimanali (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_utente_id INTEGER NOT NULL,                             -- Riferimento al tipo utente
    settimana INTEGER NOT NULL,                                  -- Numero della settimana
    anno INTEGER NOT NULL,                                       -- Anno di riferimento
    quantita_salvata REAL,                                       -- Quantità salvata
    peso_totale_kg REAL,                                         -- Peso totale in kg
    co2_risparmiata_kg REAL,                                     -- CO2 risparmiata in kg
    valore_economico REAL,                                       -- Valore economico
    numero_lotti INTEGER,                                        -- Numero di lotti
    FOREIGN KEY (tipo_utente_id) REFERENCES Tipo_Utente(id)      -- Relazione con il tipo utente
);

-- Tabella per configurazione parametri sistema
-- Gestione centralizzata dei parametri configurabili
CREATE TABLE ParametriSistema (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chiave TEXT NOT NULL UNIQUE,                                 -- Chiave del parametro
    valore TEXT NOT NULL,                                        -- Valore del parametro
    descrizione TEXT,                                            -- Descrizione
    modificabile BOOLEAN DEFAULT 1,                              -- Flag che indica se è modificabile
    modificato_da INTEGER,                                       -- Attore che ha modificato il parametro
    modificato_il TIMESTAMP,                                     -- Data/ora ultima modifica
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,               -- Data/ora di creazione
    FOREIGN KEY (modificato_da) REFERENCES Attori(id)            -- Relazione con l'attore
);

-- Tabella per le migrazioni dello schema
-- Serve per tracciare le modifiche allo schema nel tempo
CREATE TABLE MigrazioniSchema (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,                                          -- Nome della migrazione
    applicata_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,            -- Data/ora di applicazione
    descrizione TEXT                                             -- Descrizione della migrazione
);

-- ***********************************************************************
-- INSERIMENTO DATI DI DEFAULT
-- ***********************************************************************

-- Inserimento parametri di sistema di default
INSERT INTO ParametriSistema (chiave, valore, descrizione) 
VALUES 
('soglia_stato_arancione', '3', 'Giorni alla scadenza per passare allo stato arancione'),
('soglia_stato_rosso', '1', 'Giorni alla scadenza per passare allo stato rosso'),
('jwt_access_token_durata', '3600', 'Durata in secondi del token JWT di accesso'),
('jwt_refresh_token_durata', '604800', 'Durata in secondi del refresh token (7 giorni)');

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
WHEN OLD.attore_id != NEW.attore_id
FOR EACH ROW
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
WHEN OLD.stato != NEW.stato
FOR EACH ROW
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
WHEN OLD.stato != NEW.stato
FOR EACH ROW
BEGIN
    UPDATE Prenotazioni
    SET transizioni_stato = CASE
        WHEN transizioni_stato IS NULL THEN json('{"transizioni": [{"da": "' || OLD.stato || '", "a": "' || NEW.stato || '", "timestamp": "' || datetime('now') || '"}]}')
        ELSE json_insert(transizioni_stato, '$.transizioni[#]', json('{"da": "' || OLD.stato || '", "a": "' || NEW.stato || '", "timestamp": "' || datetime('now') || '"}'))
    END
    WHERE id = NEW.id;
END;

-- Trigger per registrare l'attore che ha effettuato la prenotazione
CREATE TRIGGER IF NOT EXISTS set_prenotazione_attore
BEFORE INSERT ON Prenotazioni
FOR EACH ROW
WHEN NEW.attore_id IS NULL
BEGIN
    -- Questo trigger deve essere implementato insieme a una funzione di autenticazione
    -- che fornisce l'ID dell'attore corrente. Per ora, è un segnaposto.
    -- SET NEW.attore_id = current_user_id();
END;

-- ***********************************************************************
-- PROCEDURE DI MANUTENZIONE AUTOMATICA
-- ***********************************************************************

-- Questa sezione contiene procedure SQL da eseguire periodicamente tramite job schedulati
-- Queste procedure non fanno parte dello schema del database ma sono incluse qui come riferimento
-- e documentazione per lo sviluppo del sistema di manutenzione automatica

/*
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
*/

-- ***********************************************************************
-- ESEMPI DI QUERY AVANZATE
-- ***********************************************************************

-- Esempio di query geospaziale (commentato per evitare errori durante la creazione del database)
-- SELECT t.*, 
--     (6371 * acos(cos(radians(?)) * cos(radians(t.latitudine)) * 
--     cos(radians(t.longitudine) - radians(?)) + 
--     sin(radians(?)) * sin(radians(t.latitudine)))) AS distanza
-- FROM Tipo_Utente t
-- WHERE t.tipo = 'Canale sociale'
-- HAVING distanza < 10
-- ORDER BY distanza; 

-- Esempio di query per ottenere utenti con le loro prenotazioni (commentato)
-- SELECT a.id, a.nome, a.cognome, a.email, a.ruolo, 
--        p.id as prenotazione_id, p.stato, p.data_prenotazione, 
--        l.prodotto, l.quantita, l.unita_misura
-- FROM Attori a
-- JOIN AttoriTipoUtente atu ON a.id = atu.attore_id
-- JOIN Prenotazioni p ON atu.tipo_utente_id = p.tipo_utente_ricevente_id
-- JOIN Lotti l ON p.lotto_id = l.id
-- WHERE a.ruolo = 'Utente'
-- ORDER BY a.cognome, a.nome, p.data_prenotazione DESC; 