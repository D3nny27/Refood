-- Ripristina la colonna tipo_utente_origine_id nella tabella Lotti

-- Crea una tabella temporanea con il campo tipo_utente_origine_id
CREATE TABLE IF NOT EXISTS Lotti_Temp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prodotto TEXT NOT NULL,
    quantita REAL NOT NULL,
    unita_misura TEXT NOT NULL,
    data_scadenza DATE NOT NULL,
    giorni_permanenza INTEGER NOT NULL,
    stato TEXT NOT NULL CHECK (stato IN ('Verde', 'Arancione', 'Rosso')),
    tipo_utente_origine_id INTEGER,
    inserito_da INTEGER NOT NULL,
    creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aggiornato_il TIMESTAMP,
    prezzo REAL DEFAULT NULL,
    FOREIGN KEY (inserito_da) REFERENCES "Attori"(id)
);

-- Copia i dati dalla tabella originale alla temporanea
INSERT INTO Lotti_Temp (
    id, prodotto, quantita, unita_misura, data_scadenza, 
    giorni_permanenza, stato, inserito_da, creato_il, aggiornato_il,
    prezzo
) 
SELECT 
    id, prodotto, quantita, unita_misura, data_scadenza, 
    giorni_permanenza, stato, inserito_da, creato_il, aggiornato_il,
    prezzo
FROM Lotti;

-- Elimina la tabella originale
DROP TABLE Lotti;

-- Rinomina la tabella temporanea alla originale
ALTER TABLE Lotti_Temp RENAME TO Lotti;

-- Ricrea gli indici
CREATE INDEX idx_lotti_stato ON Lotti(stato);
CREATE INDEX idx_lotti_scadenza ON Lotti(data_scadenza);
