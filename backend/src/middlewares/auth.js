const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');
const db = require('../config/database');

/**
 * Middleware per verificare il token JWT
 */
const authenticate = async (req, res, next) => {
  try {
    console.log('AUTH: Inizio verifica autenticazione');
    // Ottiene il token dall'header della richiesta
    const authHeader = req.headers.authorization;
    console.log(`AUTH: Headers di autenticazione ricevuti: ${authHeader ? 'Presenti' : 'Assenti'}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('AUTH: Header di autorizzazione mancante o formato non valido');
      throw new ApiError(401, 'Autenticazione richiesta');
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.log('AUTH: Token non fornito dopo lo split');
      throw new ApiError(401, 'Token non fornito');
    }
    
    console.log(`AUTH: Token JWT ricevuto: ${token}`);
    
    // Verifica il token
    console.log('AUTH: Verifica del token JWT in corso...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`AUTH: Token JWT decodificato per utente: ${decoded.email || 'sconosciuto'}`);
    
    // Verifica nel database se il token è valido e non revocato
    console.log('AUTH: Ricerca del token nel database...');
    const sql = `
      SELECT 
        u.id, u.email, u.nome, u.cognome, u.ruolo,
        t.access_token_scadenza, t.revocato
      FROM TokenAutenticazione t
      JOIN Utenti u ON t.utente_id = u.id
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
      console.log('AUTH: Token non trovato nel database o revocato');
      throw new ApiError(401, 'Token non valido o revocato');
    }
    
    // Salva le informazioni utente nell'oggetto request
    req.user = {
      id: row.id,
      email: row.email,
      nome: row.nome,
      cognome: row.cognome,
      ruolo: row.ruolo
    };
    
    console.log(`AUTH: Autenticazione riuscita per utente ${row.email} con ruolo ${row.ruolo}`);
    console.log('AUTH: Verifica del token JWT completata');
    next();
  } catch (err) {
    console.error(`AUTH: Errore generale: ${err.message}`);
    next(err);
  }
};

/**
 * Middleware per verificare il ruolo dell'utente
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
 * Middleware per verificare l'appartenenza a un centro
 * @param {Function} getResourceCentroId - Funzione che estrae l'ID del centro dalla richiesta
 */
const belongsToCenter = (getResourceCentroId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, 'Utente non autenticato'));
      }
      
      // Amministratori hanno accesso a tutto
      if (req.user.ruolo === 'Amministratore') {
        return next();
      }
      
      const resourceCentroId = getResourceCentroId(req);
      
      if (!resourceCentroId) {
        return next(new ApiError(400, 'ID centro non valido'));
      }
      
      // Verifica se l'utente appartiene al centro
      const sql = `
        SELECT 1 FROM UtentiCentri
        WHERE utente_id = ? AND centro_id = ?
      `;
      
      // Utilizzo del metodo promisified invece della callback
      const row = await db.get(sql, [req.user.id, resourceCentroId]);
      
      if (!row) {
        return next(new ApiError(403, 'Non autorizzato: non appartieni a questo centro'));
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
  belongsToCenter
}; 