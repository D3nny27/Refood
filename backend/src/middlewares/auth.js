const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Funzione per trovare un attore Amministratore esistente nel database
 * Usata per il testing in modalità development
 */
async function trovaUtenteAmministratore() {
  try {
    const query = `
      SELECT id, email, nome, cognome 
      FROM Attori 
      WHERE ruolo = 'Amministratore' 
      LIMIT 1
    `;
    
    const attore = await db.get(query);
    
    if (!attore) {
      logger.error('AUTH: Nessun attore Amministratore trovato nel database per il test');
      return null;
    }
    
    logger.info(`AUTH: Trovato attore Amministratore con ID ${attore.id} per il test`);
    return {
      id: attore.id,
      email: attore.email,
      nome: attore.nome,
      cognome: attore.cognome,
      ruolo: 'Amministratore'
    };
  } catch (error) {
    logger.error(`AUTH: Errore nella ricerca di un attore amministratore: ${error.message}`);
    return null;
  }
}

/**
 * Middleware per verificare il token JWT
 */
const authenticate = async (req, res, next) => {
  try {
    console.log(`AUTH: Inizio verifica autenticazione per la richiesta a ${req.originalUrl}`);
    // Ottiene il token dall'header della richiesta
    const authHeader = req.headers.authorization;
    console.log(`AUTH: Headers di autenticazione ricevuti: ${authHeader ? 'Presenti' : 'Assenti'}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`AUTH: Header di autorizzazione mancante o formato non valido per ${req.originalUrl}`);
      
      // In modalità development, consenti l'accesso alle API delle notifiche anche senza token
      // per facilitare i test durante lo sviluppo
      if (process.env.NODE_ENV === 'development' && 
         (req.originalUrl.includes('/notifiche') || req.originalUrl.includes('/admin-centro'))) {
        console.log(`AUTH: In modalità dev, consentendo accesso senza token per ${req.originalUrl}`);
        
        // Trova automaticamente un attore amministratore esistente
        const attoreTest = await trovaUtenteAmministratore();
        
        if (!attoreTest) {
          return next(new ApiError(500, 'Impossibile trovare un attore di test valido'));
        }
        
        // Imposta l'attore trovato per la richiesta
        req.user = attoreTest;
        
        console.log(`AUTH: Utente di test impostato con ID: ${req.user.id}, Ruolo: ${req.user.ruolo}`);
        return next();
      }
      
      throw new ApiError(401, 'Autenticazione richiesta');
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.log(`AUTH: Token non fornito dopo lo split per ${req.originalUrl}`);
      throw new ApiError(401, 'Token non fornito');
    }
    
    console.log(`AUTH: Token JWT ricevuto per ${req.originalUrl}: ${token.substring(0, 15)}...`);
    
    // Verifica il token
    console.log('AUTH: Verifica del token JWT in corso...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`AUTH: Token JWT decodificato per attore: ${decoded.email || 'sconosciuto'}`);
    
    // Verifica nel database se il token è valido e non revocato
    console.log(`AUTH: Ricerca del token nel database per ${req.originalUrl}...`);
    const sql = `
      SELECT 
        u.id, u.email, u.nome, u.cognome, u.ruolo,
        t.access_token_scadenza, t.revocato
      FROM TokenAutenticazione t
      JOIN Attori u ON t.attore_id = u.id
      WHERE t.access_token = ?
      AND t.access_token_scadenza > datetime('now')
      AND t.revocato = 0
      AND NOT EXISTS (
        SELECT 1 FROM TokenRevocati tr 
        WHERE tr.token_hash = ?
      )
    `;
    
    const jwtId = jwt.decode(token).jti || 'no-jti';
    console.log(`AUTH: JTI estratto dal token: ${jwtId}`);
    
    // Utilizzo del metodo promisified invece della callback
    const row = await db.get(sql, [token, jwtId]);
    
    if (!row) {
      console.log(`AUTH: Token non trovato nel database o revocato per ${req.originalUrl}`);
      throw new ApiError(401, 'Token non valido o revocato');
    }
    
    // Salva le informazioni attore nell'oggetto request
    req.user = {
      id: row.id,
      email: row.email,
      nome: row.nome,
      cognome: row.cognome,
      ruolo: row.ruolo
    };
    
    console.log(`AUTH: Autenticazione riuscita per attore ${row.email} con ruolo ${row.ruolo} per ${req.originalUrl}`);
    console.log('AUTH: Verifica del token JWT completata');
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      console.error(`AUTH: Errore di validazione JWT: ${err.message}`);
      return next(new ApiError(401, 'Token JWT non valido'));
    } else if (err.name === 'TokenExpiredError') {
      console.error(`AUTH: Token JWT scaduto per ${req.originalUrl}`);
      return next(new ApiError(401, 'Token JWT scaduto'));
    }
    
    console.error(`AUTH: Errore generale per ${req.originalUrl}: ${err.message}`);
    next(err);
  }
};

/**
 * Middleware per verificare il ruolo dell'attore
 * @param {Array} roles - Array di ruoli autorizzati
 */
const authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }
  
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Utente non autenticato'));
    }
    
    if (roles.length && !roles.includes(req.user.ruolo)) {
      return next(new ApiError(403, 'Non autorizzato: ruolo non sufficiente'));
    }
    
    next();
  };
};

/**
 * Middleware per verificare l'appartenenza a un tipo utente
 * @param {Function} getResourceTipoUtenteId - Funzione che estrae l'ID del tipo utente dalla richiesta
 */
const belongsToTipoUtente = (getResourceTipoUtenteId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, 'Utente non autenticato'));
      }
      
      // Amministratori hanno accesso a tutto
      if (req.user.ruolo === 'Amministratore') {
        return next();
      }
      
      const resourceTipoUtenteId = getResourceTipoUtenteId(req);
      
      if (!resourceTipoUtenteId) {
        return next(new ApiError(400, 'ID tipo utente non valido'));
      }
      
      // Verifica se l'attore appartiene al tipo utente
      const sql = `
        SELECT 1 FROM AttoriTipoUtente
        WHERE attore_id = ? AND tipo_utente_id = ?
      `;
      
      // Utilizzo del metodo promisified invece della callback
      const row = await db.get(sql, [req.user.id, resourceTipoUtenteId]);
      
      if (!row) {
        return next(new ApiError(403, 'Non autorizzato: non appartieni a questo tipo utente'));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  belongsToTipoUtente
}; 