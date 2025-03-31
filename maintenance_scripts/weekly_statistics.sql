-- Procedura per calcolare statistiche settimanali
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

-- Seleziona il numero di statistiche aggiornate per il log
SELECT 'Statistiche aggiornate: ' || changes() AS stats_info;

COMMIT;

-- Log esecuzione
SELECT 'Calcolo statistiche settimanali completato il ' || datetime('now') AS execution_log;
