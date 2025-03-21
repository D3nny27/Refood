const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Ottiene un conteggio di base delle entità nel sistema
 */
exports.getCounters = async (req, res, next) => {
  try {
    // Esegui query per contare le entità principali
    const [
      lotti,
      prenotazioni,
      utenti,
      centri
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as totale, COUNT(CASE WHEN stato = "Verde" THEN 1 END) as verdi, COUNT(CASE WHEN stato = "Arancione" THEN 1 END) as arancioni, COUNT(CASE WHEN stato = "Rosso" THEN 1 END) as rossi FROM Lotti'),
      db.get('SELECT COUNT(*) as totale, COUNT(CASE WHEN stato = "Prenotato" THEN 1 END) as prenotate, COUNT(CASE WHEN stato = "InTransito" THEN 1 END) as in_transito, COUNT(CASE WHEN stato = "Consegnato" THEN 1 END) as consegnate, COUNT(CASE WHEN stato = "Annullato" THEN 1 END) as annullate FROM Prenotazioni'),
      db.get('SELECT COUNT(*) as totale, COUNT(CASE WHEN ruolo = "Operatore" THEN 1 END) as operatori, COUNT(CASE WHEN ruolo = "Amministratore" THEN 1 END) as amministratori, COUNT(CASE WHEN ruolo = "CentroSociale" THEN 1 END) as centri_sociali, COUNT(CASE WHEN ruolo = "CentroRiciclaggio" THEN 1 END) as centri_riciclaggio FROM Utenti'),
      db.get('SELECT COUNT(*) as totale, COUNT(CASE WHEN tipo = "Distribuzione" THEN 1 END) as distribuzione, COUNT(CASE WHEN tipo = "Sociale" THEN 1 END) as sociali, COUNT(CASE WHEN tipo = "Riciclaggio" THEN 1 END) as riciclaggio FROM Centri')
    ]);
    
    res.json({
      lotti: {
        totale: lotti.totale,
        per_stato: {
          verde: lotti.verdi,
          arancione: lotti.arancioni,
          rosso: lotti.rossi
        }
      },
      prenotazioni: {
        totale: prenotazioni.totale,
        per_stato: {
          prenotate: prenotazioni.prenotate,
          in_transito: prenotazioni.in_transito,
          consegnate: prenotazioni.consegnate,
          annullate: prenotazioni.annullate
        }
      },
      utenti: {
        totale: utenti.totale,
        per_ruolo: {
          operatori: utenti.operatori,
          amministratori: utenti.amministratori,
          centri_sociali: utenti.centri_sociali,
          centri_riciclaggio: utenti.centri_riciclaggio
        }
      },
      centri: {
        totale: centri.totale,
        per_tipo: {
          distribuzione: centri.distribuzione,
          sociali: centri.sociali,
          riciclaggio: centri.riciclaggio
        }
      }
    });
  } catch (err) {
    logger.error(`Errore nel recupero dei contatori: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero dei contatori'));
  }
};

/**
 * Ottiene le statistiche di impatto per l'intero sistema
 */
exports.getImpatto = async (req, res, next) => {
  try {
    // Ottieni il totale di CO2 risparmiata e valore economico
    const impatto = await db.get(`
      SELECT 
        SUM(co2_risparmiata_kg) as co2_totale,
        SUM(valore_economico) as valore_totale
      FROM ImpattoCO2
    `);
    
    // Ottieni il totale di cibo salvato
    const lotti = await db.get(`
      SELECT 
        COUNT(*) as lotti_totali,
        SUM(CASE WHEN unita_misura = 'kg' THEN quantita WHEN unita_misura = 'g' THEN quantita / 1000.0 ELSE 0 END) as peso_kg
      FROM Lotti
      WHERE id IN (SELECT lotto_id FROM Prenotazioni WHERE stato = 'Consegnato')
    `);
    
    // Calcola l'acqua e il terreno risparmiati basandoci su stime medie
    const acqua_risparmiata = lotti.peso_kg * 200; // 200 litri di acqua per kg di cibo
    const terreno_risparmiato = lotti.peso_kg * 0.3; // 0.3 m² di terreno per kg di cibo
    
    res.json({
      co2_risparmiata_kg: impatto.co2_totale || 0,
      valore_economico_risparmiato: impatto.valore_totale || 0,
      cibo_salvato_kg: lotti.peso_kg || 0,
      acqua_risparmiata_litri: acqua_risparmiata || 0,
      terreno_risparmiato_mq: terreno_risparmiato || 0,
      lotti_salvati: lotti.lotti_totali || 0
    });
  } catch (err) {
    logger.error(`Errore nel recupero dell'impatto: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero dell\'impatto'));
  }
}; 