-- Script di migrazione per rinominare la tabella "Centri" in "Tipo_Utente"
-- Creato per Refood App - Version 1.0
-- IMPORTANTE: Eseguire un backup del database prima di applicare questa migrazione

-- Abilita la modalità transazione per garantire l'integrità dei dati
BEGIN TRANSACTION;

-- Step 1: Abilita la modalità di supporto per operazioni di modifica schema
PRAGMA foreign_keys = OFF;

-- Step 2: Crea la nuova tabella Tipo_Utente con la struttura desiderata
CREATE TABLE Tipo_Utente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('Privato', 'Canale sociale', 'centro riciclo')),
    indirizzo TEXT NOT NULL,
    email TEXT,
    telefono TEXT,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Inserisci i dati dai Centri esistenti in Tipo_Utente
-- Nota: Mappiamo i tipi attuali ai nuovi valori
INSERT INTO Tipo_Utente (id, tipo, indirizzo, email, telefono, creato_il)
SELECT 
    id, 
    CASE 
        WHEN tipo = 'Distribuzione' THEN 'Privato'
        WHEN tipo = 'Sociale' THEN 'Canale sociale'
        WHEN tipo = 'Riciclaggio' THEN 'centro riciclo'
        ELSE 'Privato' -- valore di default
    END,
    indirizzo,
    email,
    telefono,
    creato_il
FROM Centri;

-- Step 4: Aggiorna AttoriCentri per puntare alla nuova tabella
CREATE TABLE AttoriTipoUtente (
    attore_id INTEGER NOT NULL,
    tipo_utente_id INTEGER NOT NULL,
    ruolo_specifico TEXT,
    data_inizio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (attore_id, tipo_utente_id),
    FOREIGN KEY (attore_id) REFERENCES Attori(id),
    FOREIGN KEY (tipo_utente_id) REFERENCES Tipo_Utente(id)
);

INSERT INTO AttoriTipoUtente (attore_id, tipo_utente_id, ruolo_specifico, data_inizio)
SELECT attore_id, centro_id, ruolo_specifico, data_inizio FROM AttoriCentri;

-- Step 5: Aggiorna Lotti per puntare alla nuova tabella
CREATE TABLE Lotti_New (
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

INSERT INTO Lotti_New (id, prodotto, quantita, unita_misura, data_scadenza, giorni_permanenza, stato, tipo_utente_origine_id, inserito_da, creato_il, aggiornato_il)
SELECT id, prodotto, quantita, unita_misura, data_scadenza, giorni_permanenza, stato, centro_origine_id, inserito_da, creato_il, aggiornato_il FROM Lotti;

-- Step 6: Aggiorna Prenotazioni per puntare alla nuova tabella
CREATE TABLE Prenotazioni_New (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_id INTEGER NOT NULL,
    tipo_utente_ricevente_id INTEGER NOT NULL,
    stato TEXT NOT NULL CHECK (stato IN ('Prenotato', 'InTransito', 'Consegnato', 'Annullato')),
    data_prenotazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_ritiro TIMESTAMP,
    data_consegna TIMESTAMP,
    note TEXT,
    FOREIGN KEY (lotto_id) REFERENCES Lotti_New(id),
    FOREIGN KEY (tipo_utente_ricevente_id) REFERENCES Tipo_Utente(id)
);

INSERT INTO Prenotazioni_New (id, lotto_id, tipo_utente_ricevente_id, stato, data_prenotazione, data_ritiro, data_consegna, note)
SELECT id, lotto_id, centro_ricevente_id, stato, data_prenotazione, data_ritiro, data_consegna, note FROM Prenotazioni;

-- Step 7: Aggiorna Notifiche per puntare alla nuova tabella
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
    tipo_utente_id INTEGER,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (destinatario_id) REFERENCES Attori(id),
    FOREIGN KEY (origine_id) REFERENCES Attori(id),
    FOREIGN KEY (tipo_utente_id) REFERENCES Tipo_Utente(id)
);

INSERT INTO Notifiche_New (id, titolo, messaggio, tipo, priorita, destinatario_id, letto, data_lettura, eliminato, riferimento_id, riferimento_tipo, origine_id, tipo_utente_id, creato_il)
SELECT id, titolo, messaggio, tipo, priorita, destinatario_id, letto, data_lettura, eliminato, riferimento_id, riferimento_tipo, origine_id, centro_id, creato_il FROM Notifiche;

-- Step 8: Aggiorna Trasformazioni per puntare alla nuova tabella
CREATE TABLE Trasformazioni_New (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lotto_origine_id INTEGER NOT NULL,
    tipo_trasformazione TEXT NOT NULL CHECK (tipo_trasformazione IN ('Compost', 'Biogas', 'Alimentazione animale', 'Altro')),
    tipo_utente_trasformazione_id INTEGER NOT NULL,
    quantita_trasformata REAL,
    data_trasformazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    FOREIGN KEY (lotto_origine_id) REFERENCES Lotti_New(id),
    FOREIGN KEY (tipo_utente_trasformazione_id) REFERENCES Tipo_Utente(id)
);

INSERT INTO Trasformazioni_New (id, lotto_origine_id, tipo_trasformazione, tipo_utente_trasformazione_id, quantita_trasformata, data_trasformazione, note)
SELECT id, lotto_origine_id, tipo_trasformazione, centro_trasformazione_id, quantita_trasformata, data_trasformazione, note FROM Trasformazioni;

-- Step 9: Aggiorna StatisticheSettimanali per puntare alla nuova tabella
CREATE TABLE StatisticheSettimanali_New (
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

INSERT INTO StatisticheSettimanali_New (id, tipo_utente_id, settimana, anno, quantita_salvata, peso_totale_kg, co2_risparmiata_kg, valore_economico, numero_lotti)
SELECT id, centro_id, settimana, anno, quantita_salvata, peso_totale_kg, co2_risparmiata_kg, valore_economico, numero_lotti FROM StatisticheSettimanali;

-- Step 10: Elimina le vecchie tabelle
DROP TABLE AttoriCentri;
DROP TABLE Prenotazioni;
DROP TABLE Notifiche;
DROP TABLE Trasformazioni;
DROP TABLE StatisticheSettimanali;
DROP TABLE Lotti;
DROP TABLE Centri;
DROP TABLE CentriTipi;

-- Step 11: Rinomina le nuove tabelle
ALTER TABLE Lotti_New RENAME TO Lotti;
ALTER TABLE Prenotazioni_New RENAME TO Prenotazioni;
ALTER TABLE Notifiche_New RENAME TO Notifiche;
ALTER TABLE Trasformazioni_New RENAME TO Trasformazioni;
ALTER TABLE StatisticheSettimanali_New RENAME TO StatisticheSettimanali;

-- Step 12: Ricrea gli indici
CREATE INDEX idx_lotti_stato ON Lotti(stato);
CREATE INDEX idx_lotti_scadenza ON Lotti(data_scadenza);
CREATE INDEX idx_prenotazioni_stato ON Prenotazioni(stato);
CREATE INDEX idx_tipo_utente_tipo ON Tipo_Utente(tipo);
CREATE INDEX idx_attori_tipo_utente_attore_id ON AttoriTipoUtente(attore_id);
CREATE INDEX idx_attori_tipo_utente_tipo_utente_id ON AttoriTipoUtente(tipo_utente_id);

-- Step 13: Riabilita i controlli di foreign key
PRAGMA foreign_keys = ON;

-- Se tutto è andato bene, conferma la transazione
COMMIT;

-- Se ci sono errori, la transazione verrà annullata automaticamente
-- e sarà eseguito un rollback, preservando i dati originali 