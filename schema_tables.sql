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