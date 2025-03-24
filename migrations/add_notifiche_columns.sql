-- Migrazione per aggiungere colonne mancanti alla tabella Notifiche

-- Aggiungi la colonna titolo
ALTER TABLE Notifiche ADD COLUMN titolo TEXT NOT NULL DEFAULT 'Notifica';

-- Aggiungi la colonna priorita
ALTER TABLE Notifiche ADD COLUMN priorita TEXT NOT NULL DEFAULT 'Media' CHECK (priorita IN ('Bassa', 'Media', 'Alta'));

-- Aggiungi la colonna origine_id (utente che ha creato la notifica)
ALTER TABLE Notifiche ADD COLUMN origine_id INTEGER REFERENCES Utenti(id);

-- Aggiungi colonne per riferimenti a entità
ALTER TABLE Notifiche ADD COLUMN riferimento_id INTEGER;
ALTER TABLE Notifiche ADD COLUMN riferimento_tipo TEXT;

-- Aggiungi la colonna centro_id
ALTER TABLE Notifiche ADD COLUMN centro_id INTEGER REFERENCES Centri(id);

-- Aggiungi la colonna eliminato per supportare la cancellazione logica
ALTER TABLE Notifiche ADD COLUMN eliminato BOOLEAN DEFAULT 0;

-- Aggiungi la colonna data_lettura per tenere traccia di quando è stata letta
ALTER TABLE Notifiche ADD COLUMN data_lettura TIMESTAMP;

-- Crea indici per migliorare le prestazioni
CREATE INDEX IF NOT EXISTS idx_notifiche_destinatario ON Notifiche(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_letto ON Notifiche(letto);
CREATE INDEX IF NOT EXISTS idx_notifiche_eliminato ON Notifiche(eliminato);
CREATE INDEX IF NOT EXISTS idx_notifiche_centro ON Notifiche(centro_id); 