-- ******************************************************************
-- SCRIPT DI CREAZIONE VISTE MATERIALIZZATE PER REFOOD
-- ******************************************************************
-- Questo script implementa le viste materializzate e le viste normali 
-- per il monitoraggio e l'analisi del database RefFood

-- ******************************************************************
-- CREAZIONE TABELLE PER VISTE MATERIALIZZATE
-- ******************************************************************

-- Vista materializzata per riepilogo lotti scaduti
CREATE TABLE IF NOT EXISTS MV_LottiScaduti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    periodo TEXT NOT NULL,                -- Ad esempio: '2023-05' per maggio 2023
    tipo_utente_id INTEGER,
    tipo_utente_nome TEXT,
    numero_lotti INTEGER,
    quantita_totale REAL,
    peso_totale_kg REAL,
    valore_economico REAL,
    co2_stimata_kg REAL,
    ultimo_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tipo_utente_id) REFERENCES Tipo_Utente(id)
);

-- Vista materializzata per statistiche prenotazioni
CREATE TABLE IF NOT EXISTS MV_StatistichePrenotazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    periodo TEXT NOT NULL,                -- Ad esempio: '2023-05' per maggio 2023
    tipo_utente_id INTEGER,
    tipo_utente_nome TEXT,
    num_prenotazioni_totali INTEGER,
    num_prenotazioni_completate INTEGER,
    num_prenotazioni_annullate INTEGER,
    tempo_medio_attesa_minuti INTEGER,    -- Tempo medio tra prenotazione e ritiro
    ultimo_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tipo_utente_id) REFERENCES Tipo_Utente(id)
);

-- Vista materializzata per statistiche impatto ambientale
CREATE TABLE IF NOT EXISTS MV_ImpattoAmbientale (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    periodo TEXT NOT NULL,                -- Ad esempio: '2023-05' per maggio 2023
    co2_risparmiata_totale_kg REAL,
    valore_economico_totale REAL,
    peso_salvato_totale_kg REAL,
    numero_lotti_salvati INTEGER,
    numero_prenotazioni_completate INTEGER,
    ultimo_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vista materializzata per performance degli attori
CREATE TABLE IF NOT EXISTS MV_PerformanceAttori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    periodo TEXT NOT NULL,                -- Ad esempio: '2023-05' per maggio 2023
    attore_id INTEGER,
    nome_attore TEXT,
    ruolo TEXT,
    num_lotti_inseriti INTEGER,
    num_prenotazioni_gestite INTEGER,
    ultimo_accesso TIMESTAMP,
    ultimo_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attore_id) REFERENCES Attori(id)
);

-- ******************************************************************
-- PROCEDURE PER AGGIORNARE LE VISTE MATERIALIZZATE
-- ******************************************************************

-- Procedura per aggiornare MV_LottiScaduti
-- Da eseguire mensilmente
CREATE TRIGGER IF NOT EXISTS update_mv_lotti_scaduti
AFTER INSERT ON LogCambioStato
WHEN NEW.stato_nuovo = 'Rosso'
BEGIN
    -- Inserisci o aggiorna i dati per il mese corrente
    INSERT OR REPLACE INTO MV_LottiScaduti (
        periodo,
        tipo_utente_id,
        tipo_utente_nome,
        numero_lotti,
        quantita_totale,
        peso_totale_kg,
        valore_economico,
        co2_stimata_kg,
        ultimo_aggiornamento
    )
    SELECT
        strftime('%Y-%m', 'now') AS periodo,
        l.tipo_utente_origine_id,
        tu.tipo,
        COUNT(l.id) AS numero_lotti,
        SUM(l.quantita) AS quantita_totale,
        SUM(CASE WHEN l.unita_misura = 'kg' THEN l.quantita ELSE l.quantita * 0.5 END) AS peso_totale_kg,
        SUM(l.prezzo) AS valore_economico,
        SUM(COALESCE(ic.co2_risparmiata_kg, 0)) AS co2_stimata_kg,
        datetime('now') AS ultimo_aggiornamento
    FROM Lotti l
    LEFT JOIN Tipo_Utente tu ON l.tipo_utente_origine_id = tu.id
    LEFT JOIN ImpattoCO2 ic ON l.id = ic.lotto_id
    WHERE l.stato = 'Rosso'
    AND strftime('%Y-%m', l.aggiornato_il) = strftime('%Y-%m', 'now')
    GROUP BY l.tipo_utente_origine_id, tu.tipo;
END;

-- ******************************************************************
-- VISTE NORMALI (NON MATERIALIZZATE)
-- ******************************************************************

-- Vista per analisi stato lotti corrente
CREATE VIEW IF NOT EXISTS V_StatoLottiCorrente AS
SELECT
    COUNT(*) AS totale_lotti,
    SUM(CASE WHEN stato = 'Verde' THEN 1 ELSE 0 END) AS lotti_verdi,
    SUM(CASE WHEN stato = 'Arancione' THEN 1 ELSE 0 END) AS lotti_arancioni,
    SUM(CASE WHEN stato = 'Rosso' THEN 1 ELSE 0 END) AS lotti_rossi,
    SUM(CASE WHEN stato = 'Verde' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS percentuale_verdi,
    SUM(CASE WHEN stato = 'Arancione' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS percentuale_arancioni,
    SUM(CASE WHEN stato = 'Rosso' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS percentuale_rossi,
    MIN(data_scadenza) AS prossima_scadenza,
    MAX(data_scadenza) AS scadenza_piu_lontana
FROM Lotti
WHERE stato IN ('Verde', 'Arancione', 'Rosso');

-- Vista per riepilogo prenotazioni per stato
CREATE VIEW IF NOT EXISTS V_RiepilogoPrenotazioni AS
SELECT
    stato,
    COUNT(*) AS numero_prenotazioni,
    COUNT(*) * 100.0 / (SELECT COUNT(*) FROM Prenotazioni) AS percentuale
FROM Prenotazioni
GROUP BY stato
ORDER BY COUNT(*) DESC;

-- Vista per analisi tempo di risposta prenotazioni
CREATE VIEW IF NOT EXISTS V_TempoRispostaPrenotazioni AS
SELECT
    AVG(CASE 
        WHEN stato IN ('Confermato', 'ProntoPerRitiro', 'InTransito', 'Consegnato') 
        THEN CAST((julianday(updated_at) - julianday(data_prenotazione)) * 24 * 60 AS INTEGER)
        ELSE NULL
    END) AS tempo_medio_conferma_minuti,
    MIN(CASE 
        WHEN stato IN ('Confermato', 'ProntoPerRitiro', 'InTransito', 'Consegnato') 
        THEN CAST((julianday(updated_at) - julianday(data_prenotazione)) * 24 * 60 AS INTEGER)
        ELSE NULL
    END) AS tempo_minimo_conferma_minuti,
    MAX(CASE 
        WHEN stato IN ('Confermato', 'ProntoPerRitiro', 'InTransito', 'Consegnato') 
        THEN CAST((julianday(updated_at) - julianday(data_prenotazione)) * 24 * 60 AS INTEGER)
        ELSE NULL
    END) AS tempo_massimo_conferma_minuti,
    AVG(CASE 
        WHEN stato = 'Consegnato' 
        THEN CAST((julianday(data_consegna) - julianday(data_prenotazione)) * 24 * 60 AS INTEGER)
        ELSE NULL
    END) AS tempo_medio_totale_minuti
FROM Prenotazioni;

-- Vista per attività utenti
CREATE VIEW IF NOT EXISTS V_AttivitaUtenti AS
SELECT
    a.id AS attore_id,
    a.nome || ' ' || COALESCE(a.cognome, a.cognome_old) AS nome_completo,
    a.ruolo,
    a.ultimo_accesso,
    (SELECT COUNT(*) FROM Lotti WHERE inserito_da = a.id) AS lotti_inseriti,
    (SELECT COUNT(*) FROM Prenotazioni WHERE attore_id = a.id) AS prenotazioni_effettuate,
    (SELECT COUNT(*) FROM LogCambioStato WHERE cambiato_da = a.id) AS cambi_stato_effettuati,
    (SELECT COUNT(*) FROM Notifiche WHERE destinatario_id = a.id AND letto = 0) AS notifiche_non_lette
FROM Attori a
ORDER BY a.ultimo_accesso DESC;

-- Vista per monitoraggio integrità database
CREATE VIEW IF NOT EXISTS V_MonitoraggioIntegrita AS
SELECT 'LogCambioStato.cambiato_da' AS riferimento, COUNT(*) AS riferimenti_non_validi
FROM LogCambioStato WHERE cambiato_da NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Prenotazioni.attore_id', COUNT(*) 
FROM Prenotazioni WHERE attore_id IS NOT NULL AND attore_id NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Lotti.inserito_da', COUNT(*) 
FROM Lotti WHERE inserito_da NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Notifiche.destinatario_id', COUNT(*) 
FROM Notifiche WHERE destinatario_id NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Notifiche.origine_id', COUNT(*) 
FROM Notifiche WHERE origine_id IS NOT NULL AND origine_id NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'TokenRevocati.revocato_da', COUNT(*) 
FROM TokenRevocati WHERE revocato_da IS NOT NULL AND revocato_da NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'ParametriSistema.modificato_da', COUNT(*) 
FROM ParametriSistema WHERE modificato_da IS NOT NULL AND modificato_da NOT IN (SELECT id FROM Attori);

-- ******************************************************************
-- FUNZIONI AUSILIARIE
-- ******************************************************************

-- Funzione per calcolare l'impatto ambientale di un lotto
CREATE TRIGGER IF NOT EXISTS calcola_impatto_lotto
AFTER INSERT ON Lotti
FOR EACH ROW
BEGIN
    -- Calcola l'impatto CO2 stimato (usando formule semplificate)
    INSERT INTO ImpattoCO2 (
        lotto_id,
        co2_risparmiata_kg,
        valore_economico,
        metodo_calcolo
    )
    VALUES (
        NEW.id,
        -- Formula semplificata: 2.5kg CO2 per kg di cibo salvato (media)
        CASE 
            WHEN NEW.unita_misura = 'kg' THEN NEW.quantita * 2.5
            WHEN NEW.unita_misura = 'lt' THEN NEW.quantita * 1.8
            ELSE NEW.quantita * 1.0 -- default per unità diverse
        END,
        -- Valore economico (se non specificato, stima basata sulla quantità)
        COALESCE(NEW.prezzo, 
            CASE 
                WHEN NEW.unita_misura = 'kg' THEN NEW.quantita * 5.0
                WHEN NEW.unita_misura = 'lt' THEN NEW.quantita * 4.0
                ELSE NEW.quantita * 3.0 -- default per unità diverse
            END
        ),
        'Stima automatica basata su quantità e unità di misura'
    );
END;

-- ******************************************************************
-- PROCEDURA PER AGGIORNARE TUTTE LE VISTE MATERIALIZZATE
-- ******************************************************************
/*
-- Eseguire questa procedura mensilmente per aggiornare tutte le viste materializzate
BEGIN TRANSACTION;

-- Aggiorna MV_StatistichePrenotazioni
INSERT OR REPLACE INTO MV_StatistichePrenotazioni (
    periodo,
    tipo_utente_id,
    tipo_utente_nome,
    num_prenotazioni_totali,
    num_prenotazioni_completate,
    num_prenotazioni_annullate,
    tempo_medio_attesa_minuti,
    ultimo_aggiornamento
)
SELECT
    strftime('%Y-%m', 'now') AS periodo,
    tu.id AS tipo_utente_id,
    tu.tipo AS tipo_utente_nome,
    COUNT(p.id) AS num_prenotazioni_totali,
    SUM(CASE WHEN p.stato = 'Consegnato' THEN 1 ELSE 0 END) AS num_prenotazioni_completate,
    SUM(CASE WHEN p.stato IN ('Rifiutato', 'Annullato', 'Eliminato') THEN 1 ELSE 0 END) AS num_prenotazioni_annullate,
    AVG(CASE 
        WHEN p.data_ritiro_effettivo IS NOT NULL 
        THEN CAST((julianday(p.data_ritiro_effettivo) - julianday(p.data_prenotazione)) * 24 * 60 AS INTEGER)
        ELSE NULL
    END) AS tempo_medio_attesa_minuti,
    datetime('now') AS ultimo_aggiornamento
FROM Prenotazioni p
JOIN Tipo_Utente tu ON p.tipo_utente_ricevente_id = tu.id
WHERE strftime('%Y-%m', p.data_prenotazione) = strftime('%Y-%m', 'now')
GROUP BY tu.id, tu.tipo;

-- Aggiorna MV_ImpattoAmbientale
INSERT OR REPLACE INTO MV_ImpattoAmbientale (
    periodo,
    co2_risparmiata_totale_kg,
    valore_economico_totale,
    peso_salvato_totale_kg,
    numero_lotti_salvati,
    numero_prenotazioni_completate,
    ultimo_aggiornamento
)
SELECT
    strftime('%Y-%m', 'now') AS periodo,
    SUM(COALESCE(ic.co2_risparmiata_kg, 0)) AS co2_risparmiata_totale_kg,
    SUM(COALESCE(ic.valore_economico, 0)) AS valore_economico_totale,
    SUM(CASE WHEN l.unita_misura = 'kg' THEN l.quantita ELSE l.quantita * 0.5 END) AS peso_salvato_totale_kg,
    COUNT(DISTINCT l.id) AS numero_lotti_salvati,
    COUNT(DISTINCT CASE WHEN p.stato = 'Consegnato' THEN p.id ELSE NULL END) AS numero_prenotazioni_completate,
    datetime('now') AS ultimo_aggiornamento
FROM Lotti l
LEFT JOIN ImpattoCO2 ic ON l.id = ic.lotto_id
LEFT JOIN Prenotazioni p ON l.id = p.lotto_id
WHERE strftime('%Y-%m', l.creato_il) = strftime('%Y-%m', 'now');

-- Aggiorna MV_PerformanceAttori
INSERT OR REPLACE INTO MV_PerformanceAttori (
    periodo,
    attore_id,
    nome_attore,
    ruolo,
    num_lotti_inseriti,
    num_prenotazioni_gestite,
    ultimo_accesso,
    ultimo_aggiornamento
)
SELECT
    strftime('%Y-%m', 'now') AS periodo,
    a.id AS attore_id,
    a.nome || ' ' || COALESCE(a.cognome, a.cognome_old) AS nome_attore,
    a.ruolo,
    COUNT(DISTINCT CASE WHEN l.inserito_da = a.id THEN l.id ELSE NULL END) AS num_lotti_inseriti,
    COUNT(DISTINCT CASE WHEN p.operatore_ritiro = a.id THEN p.id ELSE NULL END) AS num_prenotazioni_gestite,
    a.ultimo_accesso,
    datetime('now') AS ultimo_aggiornamento
FROM Attori a
LEFT JOIN Lotti l ON a.id = l.inserito_da AND strftime('%Y-%m', l.creato_il) = strftime('%Y-%m', 'now')
LEFT JOIN Prenotazioni p ON a.id = p.operatore_ritiro AND strftime('%Y-%m', p.updated_at) = strftime('%Y-%m', 'now')
GROUP BY a.id;

COMMIT;
*/

-- ******************************************************************
-- INDICI PER OTTIMIZZARE LE QUERY
-- ******************************************************************

-- Indici per ottimizzare le viste materializzate
CREATE INDEX IF NOT EXISTS idx_mv_lotti_scaduti_periodo ON MV_LottiScaduti(periodo);
CREATE INDEX IF NOT EXISTS idx_mv_lotti_scaduti_tipo_utente ON MV_LottiScaduti(tipo_utente_id);

CREATE INDEX IF NOT EXISTS idx_mv_statistiche_prenotazioni_periodo ON MV_StatistichePrenotazioni(periodo);
CREATE INDEX IF NOT EXISTS idx_mv_statistiche_prenotazioni_tipo ON MV_StatistichePrenotazioni(tipo_utente_id);

CREATE INDEX IF NOT EXISTS idx_mv_impatto_periodo ON MV_ImpattoAmbientale(periodo);

CREATE INDEX IF NOT EXISTS idx_mv_performance_periodo ON MV_PerformanceAttori(periodo);
CREATE INDEX IF NOT EXISTS idx_mv_performance_attore ON MV_PerformanceAttori(attore_id);

-- Indici addizionali per ottimizzare le query di analisi
CREATE INDEX IF NOT EXISTS idx_lotti_stato_scadenza ON Lotti(stato, data_scadenza);
CREATE INDEX IF NOT EXISTS idx_lotti_creato_il ON Lotti(creato_il);

CREATE INDEX IF NOT EXISTS idx_prenotazioni_stato_data ON Prenotazioni(stato, data_prenotazione);
CREATE INDEX IF NOT EXISTS idx_prenotazioni_ricevente ON Prenotazioni(tipo_utente_ricevente_id);

-- ******************************************************************
-- SCRIPT DI PULIZIA (OPZIONALE)
-- ******************************************************************
/*
-- Elimina tutte le viste e le tabelle di materializzazione se necessario
DROP VIEW IF EXISTS V_StatoLottiCorrente;
DROP VIEW IF EXISTS V_RiepilogoPrenotazioni;
DROP VIEW IF EXISTS V_TempoRispostaPrenotazioni;
DROP VIEW IF EXISTS V_AttivitaUtenti;
DROP VIEW IF EXISTS V_MonitoraggioIntegrita;

DROP TABLE IF EXISTS MV_LottiScaduti;
DROP TABLE IF EXISTS MV_StatistichePrenotazioni;
DROP TABLE IF EXISTS MV_ImpattoAmbientale;
DROP TABLE IF EXISTS MV_PerformanceAttori;
*/ 