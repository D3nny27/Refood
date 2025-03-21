const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Ottiene l'elenco delle notifiche per l'utente corrente
 */
exports.getNotifiche = async (req, res, next) => {
  try {
    const { letto, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Costruzione della query base
    let query = `
      SELECT *
      FROM Notifiche
      WHERE destinatario_id = ?
    `;
    
    // Array per i parametri della query
    const params = [req.user.id];
    
    // Aggiunta dei filtri
    if (letto !== undefined) {
      query += ` AND letto = ?`;
      params.push(letto === 'true' || letto === '1' ? 1 : 0);
    }
    
    // Query per contare il totale dei risultati e notifiche non lette
    const countQuery = `SELECT COUNT(*) as total FROM Notifiche WHERE destinatario_id = ?`;
    const countNonLetteQuery = `SELECT COUNT(*) as non_lette FROM Notifiche WHERE destinatario_id = ? AND letto = 0`;
    
    // Aggiunta dell'ordinamento e della paginazione
    query += ` ORDER BY creato_il DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    // Esecuzione delle query
    const [countResult, countNonLette] = await Promise.all([
      db.get(countQuery, [req.user.id]),
      db.get(countNonLetteQuery, [req.user.id])
    ]);
    
    const notifiche = await db.all(query, params);
    
    // Calcolo info di paginazione
    const total = countResult.total;
    const pages = Math.ceil(total / limit);
    
    res.json({
      data: notifiche,
      non_lette: countNonLette.non_lette,
      pagination: {
        total,
        pages,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    logger.error(`Errore nel recupero delle notifiche: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero delle notifiche'));
  }
};

/**
 * Segna una notifica come letta
 */
exports.segnaComeLetta = async (req, res, next) => {
  try {
    const notificaId = req.params.id;
    
    // Verifica che la notifica esista ed appartenga all'utente
    const notifica = await db.get(
      'SELECT * FROM Notifiche WHERE id = ? AND destinatario_id = ?',
      [notificaId, req.user.id]
    );
    
    if (!notifica) {
      return next(new ApiError(404, 'Notifica non trovata'));
    }
    
    // Aggiorna lo stato della notifica
    await db.run(
      'UPDATE Notifiche SET letto = 1 WHERE id = ?',
      [notificaId]
    );
    
    res.json({
      id: parseInt(notificaId),
      letto: true,
      messaggio: 'Notifica segnata come letta'
    });
  } catch (err) {
    logger.error(`Errore nell'aggiornamento della notifica: ${err.message}`);
    next(new ApiError(500, 'Errore nell\'aggiornamento della notifica'));
  }
};

/**
 * Segna tutte le notifiche dell'utente come lette
 */
exports.segnaLeggiTutte = async (req, res, next) => {
  try {
    // Aggiorna tutte le notifiche non lette dell'utente
    const result = await db.run(
      'UPDATE Notifiche SET letto = 1 WHERE destinatario_id = ? AND letto = 0',
      [req.user.id]
    );
    
    res.json({
      notifiche_aggiornate: result.changes,
      messaggio: 'Tutte le notifiche sono state segnate come lette'
    });
  } catch (err) {
    logger.error(`Errore nell'aggiornamento delle notifiche: ${err.message}`);
    next(new ApiError(500, 'Errore nell\'aggiornamento delle notifiche'));
  }
};

/**
 * Invia una notifica agli utenti (utility per altri controllers)
 * @param {Object} options - Opzioni della notifica
 * @param {string} options.tipo - Tipo di notifica
 * @param {string} options.messaggio - Messaggio della notifica
 * @param {number|number[]} options.destinatario_id - ID o array di ID dei destinatari
 * @returns {Promise} - Promise che risolve con le notifiche create
 */
exports.inviaNotifica = async (options) => {
  try {
    const { tipo, messaggio, destinatario_id } = options;
    
    // Converte l'ID in array se è un singolo valore
    const destinatari = Array.isArray(destinatario_id) ? destinatario_id : [destinatario_id];
    
    // Prepara le query per inserimenti multipli
    const placeholders = destinatari.map(() => '(?, ?, ?, ?)').join(', ');
    const params = [];
    
    destinatari.forEach(id => {
      params.push(tipo, messaggio, id, 0);
    });
    
    const query = `
      INSERT INTO Notifiche (tipo, messaggio, destinatario_id, letto)
      VALUES ${placeholders}
    `;
    
    const result = await db.run(query, params);
    
    logger.info(`Inviate ${destinatari.length} notifiche di tipo "${tipo}"`);
    
    return {
      success: true,
      notifiche_create: result.changes
    };
  } catch (err) {
    logger.error(`Errore nell'invio delle notifiche: ${err.message}`);
    throw err;
  }
};

/**
 * Elimina una notifica
 */
exports.eliminaNotifica = async (req, res, next) => {
  try {
    const notificaId = req.params.id;
    
    // Verifica che la notifica esista ed appartenga all'utente
    const notifica = await db.get(
      'SELECT * FROM Notifiche WHERE id = ? AND destinatario_id = ?',
      [notificaId, req.user.id]
    );
    
    if (!notifica) {
      return next(new ApiError(404, 'Notifica non trovata'));
    }
    
    // Elimina la notifica
    await db.run('DELETE FROM Notifiche WHERE id = ?', [notificaId]);
    
    res.json({
      id: parseInt(notificaId),
      messaggio: 'Notifica eliminata con successo'
    });
  } catch (err) {
    logger.error(`Errore nell'eliminazione della notifica: ${err.message}`);
    next(new ApiError(500, 'Errore nell\'eliminazione della notifica'));
  }
}; 