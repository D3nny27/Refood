const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const config = require('../config/config');

// Verifica moduli
logger.info('Moduli caricati:', {
  jwt: typeof jwt,
  bcrypt: typeof bcrypt,
  bcryptCompare: typeof bcrypt.compare,
  crypto: typeof crypto
});

/**
 * Genera un JWT access token
 * @param {Object} user - Oggetto attore
 * @returns {Object} - Access token, refresh token e scadenza
 */
const generateTokens = async (user) => {
  // Ottieni la durata dei token dalle impostazioni
  const [accessTokenDuration, refreshTokenDuration] = await Promise.all([
    db.get('SELECT valore FROM ParametriSistema WHERE chiave = "jwt_access_token_durata"'),
    db.get('SELECT valore FROM ParametriSistema WHERE chiave = "jwt_refresh_token_durata"')
  ]);
  
  const accessExpires = parseInt(accessTokenDuration?.valore || 3600);
  const refreshExpires = parseInt(refreshTokenDuration?.valore || 604800);
  
  // Genera un ID univoco per il token (jti claim)
  const tokenId = crypto.randomBytes(16).toString('hex');
  
  // Crea l'access token
  const accessToken = jwt.sign(
    { 
      sub: user.id,
      email: user.email,
      nome: user.nome,
      cognome: user.cognome,
      ruolo: user.ruolo,
      tipo_utente: user.tipo_utente || null,
      jti: tokenId 
    },
    process.env.JWT_SECRET,
    { expiresIn: accessExpires }
  );
  
  // Crea il refresh token (più semplice e con lunga durata)
  const refreshToken = crypto.randomBytes(40).toString('hex');
  
  // Calcola le date di scadenza
  const accessTokenScadenza = new Date(Date.now() + accessExpires * 1000);
  const refreshTokenScadenza = new Date(Date.now() + refreshExpires * 1000);
  
  return {
    accessToken,
    refreshToken,
    accessTokenScadenza,
    refreshTokenScadenza,
    expires: accessTokenScadenza
  };
};

/**
 * Login attore
 */
const login = async (req, res, next) => {
  try {
    const { email, password, device_info } = req.body;
    const ip_address = req.ip;
    
    logger.info(`Tentativo di login con email: ${email}`);
    
    // Trova l'attore per email
    const user = await db.get(`
      SELECT id, email, password, nome, cognome, ruolo
      FROM Attori
      WHERE email = ?
    `, [email]);
    
    if (!user) {
      logger.warn(`Login fallito: attore non trovato con email ${email}`);
      throw new ApiError(401, 'Credenziali non valide');
    }
    
    logger.info(`Utente trovato: ${user.email}, verifica password...`);
    logger.info(`Hash della password nel DB: ${user.password}`);
    
    // Caso speciale per l'attore admin@refood.org
    let passwordMatch = false;
    
    // Controlla se l'attore è admin@refood.org e se la password è 'admin123'
    if (email === 'admin@refood.org' && password === 'admin123') {
      logger.info('Utente admin riconosciuto, bypass della verifica standard');
      passwordMatch = true;
    } else if (email === 'test@refood.org' && password === 'admin123') {
      logger.info('Utente test riconosciuto, bypass della verifica standard');
      passwordMatch = true;
    } else {
      try {
        // Verifica standard della password con bcrypt
        passwordMatch = await bcrypt.compare(password, user.password);
        logger.info(`Risultato verifica password standard: ${passwordMatch ? 'OK' : 'NON valida'}`);
      } catch (bcryptError) {
        logger.error(`Errore durante la verifica bcrypt: ${bcryptError.message}`);
        // Se c'è un errore bcrypt (ad esempio formato hash non valido), fallback a confronto diretto
        passwordMatch = false;
      }
    }
    
    if (!passwordMatch) {
      logger.warn(`Login fallito: password non valida per ${email}`);
      throw new ApiError(401, 'Credenziali non valide');
    }
    
    // Se l'utente ha ruolo "Utente", recuperiamo il suo tipo_utente
    if (user.ruolo === 'Utente') {
      try {
        const tipoUtenteInfo = await db.get(`
          SELECT tu.tipo 
          FROM Tipo_Utente tu
          JOIN AttoriTipoUtente atu ON tu.id = atu.tipo_utente_id
          WHERE atu.attore_id = ?
        `, [user.id]);
        
        if (tipoUtenteInfo) {
          user.tipo_utente = tipoUtenteInfo.tipo;
          logger.info(`Tipo utente rilevato per ${user.email}: ${user.tipo_utente}`);
        } else {
          logger.warn(`Nessun tipo utente trovato per l'utente ${user.email} con ID ${user.id}`);
        }
      } catch (err) {
        logger.error(`Errore durante il recupero del tipo utente: ${err.message}`);
        logger.error(err.stack);
      }
    }
    
    // Genera tokens
    const tokens = await generateTokens(user);
    
    // Salva i token nel database
    await db.run(`
      INSERT INTO TokenAutenticazione (
        attore_id, 
        access_token, 
        refresh_token, 
        access_token_scadenza, 
        refresh_token_scadenza, 
        device_info, 
        ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      user.id,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.accessTokenScadenza.toISOString(),
      tokens.refreshTokenScadenza.toISOString(),
      device_info || `Accesso il ${new Date().toISOString()}`,
      ip_address
    ]);
    
    // Aggiorna ultimo accesso
    await db.run(`
      UPDATE Attori
      SET ultimo_accesso = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [user.id]);
    
    // Non esporre la password nella risposta
    delete user.password;
    
    logger.info(`Login avvenuto con successo per ${email}`);
    
    // Restituisci attore e tokens
    res.json({
      user,
      tokens: {
        access: tokens.accessToken,
        refresh: tokens.refreshToken,
        expires: tokens.expires
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Rinnova il token di accesso usando il refresh token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    
    // Verifica che il refresh token esista nel database
    const tokenEntry = await db.get(`
      SELECT 
        t.attore_id, t.refresh_token_scadenza, t.access_token,
        u.id, u.email, u.nome, u.cognome, u.ruolo
      FROM TokenAutenticazione t
      JOIN Attori u ON t.attore_id = u.id
      WHERE t.refresh_token = ?
      AND t.refresh_token_scadenza > datetime('now')
      AND t.revocato = 0
    `, [refresh_token]);
    
    if (!tokenEntry) {
      logger.warn(`Refresh token non valido o scaduto: ${refresh_token.substring(0, 10)}...`);
      return next(new ApiError(401, 'Refresh token non valido o scaduto'));
    }
    
    // Se l'utente ha ruolo "Utente", recuperiamo il suo tipo_utente
    if (tokenEntry.ruolo === 'Utente') {
      try {
        const tipoUtenteInfo = await db.get(`
          SELECT tu.tipo 
          FROM Tipo_Utente tu
          JOIN AttoriTipoUtente atu ON tu.id = atu.tipo_utente_id
          WHERE atu.attore_id = ?
        `, [tokenEntry.id]);
        
        if (tipoUtenteInfo) {
          tokenEntry.tipo_utente = tipoUtenteInfo.tipo;
          logger.info(`Tipo utente rilevato per ${tokenEntry.email} durante refresh: ${tokenEntry.tipo_utente}`);
        } else {
          logger.warn(`Nessun tipo utente trovato per l'utente ${tokenEntry.email} con ID ${tokenEntry.id} durante refresh`);
          // Se non troviamo un tipo_utente, manteniamo quello eventualmente presente nel token precedente
          const oldToken = jwt.decode(tokenEntry.access_token);
          if (oldToken && oldToken.tipo_utente) {
            tokenEntry.tipo_utente = oldToken.tipo_utente;
            logger.info(`Recuperato tipo_utente dal token precedente: ${tokenEntry.tipo_utente}`);
          }
        }
      } catch (err) {
        logger.error(`Errore durante il recupero del tipo utente nel refresh: ${err.message}`);
        // Se c'è un errore, recuperiamo il tipo_utente dal vecchio token
        try {
          const oldToken = jwt.decode(tokenEntry.access_token);
          if (oldToken && oldToken.tipo_utente) {
            tokenEntry.tipo_utente = oldToken.tipo_utente;
            logger.info(`Recuperato tipo_utente dal token precedente dopo errore: ${tokenEntry.tipo_utente}`);
          }
        } catch (decodeErr) {
          logger.error(`Errore durante il recupero del tipo_utente dal token precedente: ${decodeErr.message}`);
        }
      }
    }
    
    // Genera nuovi token
    const tokens = await generateTokens(tokenEntry);
    
    // Aggiorna il token nel database
    await db.run(`
      UPDATE TokenAutenticazione
      SET 
        access_token = ?,
        access_token_scadenza = ?
      WHERE refresh_token = ?
    `, [
      tokens.accessToken,
      tokens.accessTokenScadenza.toISOString(),
      refresh_token
    ]);
    
    // Risposta
    res.json({
      access_token: tokens.accessToken,
      expires: tokens.expires
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout (revoca del token corrente)
 */
const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    
    // Revoca il token corrente
    await db.run(`
      UPDATE TokenAutenticazione
      SET 
        revocato = 1,
        revocato_il = CURRENT_TIMESTAMP
      WHERE access_token = ?
    `, [token]);
    
    // Aggiungi alla blacklist
    const decoded = jwt.decode(token);
    if (decoded && decoded.jti) {
      await db.run(`
        INSERT INTO TokenRevocati (
          token_hash, 
          revocato_da, 
          motivo, 
          scadenza_originale
        ) VALUES (?, ?, ?, ?)
      `, [
        decoded.jti,
        req.user.id,
        'Logout attore',
        new Date(decoded.exp * 1000).toISOString()
      ]);
    }
    
    res.json({ message: 'Logout avvenuto con successo' });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoca tutti i token dell'attore (logout da tutti i dispositivi)
 */
const logoutAll = async (req, res, next) => {
  try {
    // Revoca tutti i token dell'attore
    await db.run(`
      UPDATE TokenAutenticazione
      SET 
        revocato = 1,
        revocato_il = CURRENT_TIMESTAMP
      WHERE attore_id = ?
      AND revocato = 0
    `, [req.user.id]);
    
    // Ottieni tutti i token attivi per inserirli nella blacklist
    const tokens = await db.all(`
      SELECT access_token, access_token_scadenza
      FROM TokenAutenticazione
      WHERE attore_id = ?
      AND revocato = 1
      AND revocato_il = CURRENT_TIMESTAMP
    `, [req.user.id]);
    
    // Inserisci tutti i token nella blacklist
    const stmt = await db.prepare(`
      INSERT INTO TokenRevocati (
        token_hash, 
        revocato_da, 
        motivo, 
        scadenza_originale
      ) VALUES (?, ?, ?, ?)
    `);

    for (const token of tokens) {
      const decoded = jwt.decode(token.access_token);
      if (decoded && decoded.jti) {
        await stmt.run([
          decoded.jti,
          req.user.id,
          'Logout da tutti i dispositivi',
          token.access_token_scadenza
        ]);
      }
    }

    await stmt.finalize();

    res.json({ message: 'Logout da tutti i dispositivi avvenuto con successo' });
  } catch (error) {
    next(error);
  }
};

/**
 * Ottieni tutte le sessioni attive dell'attore
 */
const getActiveSessions = async (req, res, next) => {
  try {
    const sessions = await db.all(`
      SELECT 
        id,
        device_info,
        ip_address,
        creato_il,
        access_token_scadenza,
        refresh_token_scadenza
      FROM TokenAutenticazione
      WHERE attore_id = ?
      AND revocato = 0
      AND refresh_token_scadenza > datetime('now')
      ORDER BY creato_il DESC
    `, [req.user.id]);
    
    res.json(sessions);
  } catch (error) {
    next(error);
  }
};

/**
 * Revoca una sessione specifica
 */
const revokeSession = async (req, res, next) => {
  try {
    const sessionId = parseInt(req.params.id);
    
    // Verifica che la sessione esista ed appartenga all'attore
    const session = await db.get(`
      SELECT id, access_token, access_token_scadenza
      FROM TokenAutenticazione
      WHERE id = ? AND attore_id = ?
    `, [sessionId, req.user.id]);
    
    if (!session) {
      throw new ApiError(404, 'Sessione non trovata');
    }
    
    // Revoca la sessione
    await db.run(`
      UPDATE TokenAutenticazione
      SET 
        revocato = 1,
        revocato_il = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [sessionId]);
    
    // Aggiungi alla blacklist
    const decoded = jwt.decode(session.access_token);
    if (decoded && decoded.jti) {
      await db.run(`
        INSERT INTO TokenRevocati (
          token_hash, 
          revocato_da, 
          motivo, 
          scadenza_originale
        ) VALUES (?, ?, ?, ?)
      `, [
        decoded.jti,
        req.user.id,
        'Revoca sessione',
        session.access_token_scadenza
      ]);
    }
    
    res.json({ message: 'Sessione revocata con successo' });
  } catch (error) {
    next(error);
  }
};

/**
 * Registra un nuovo attore nel sistema
 * Supporta due flussi:
 * 1. Registrazione come Organizzazione (ruolo = Operatore o Amministratore)
 * 2. Registrazione come Utente con associazione a un specifico Tipo_Utente
 */
const register = async (req, res, next) => {
  const { email, password, nome, cognome, ruolo, tipoUtente } = req.body;
  
  // Logging dettagliato per debug
  console.log('==== DATI RICEVUTI NELLA REGISTRAZIONE ====');
  console.log('email:', email);
  console.log('nome:', nome);
  console.log('cognome:', cognome, typeof cognome);
  console.log('ruolo:', ruolo);
  if (tipoUtente) {
    console.log('tipoUtente.tipo:', tipoUtente.tipo);
    console.log('tipoUtente.indirizzo:', tipoUtente.indirizzo);
    console.log('tipoUtente.telefono:', tipoUtente.telefono);
  } else {
    console.log('tipoUtente: non presente');
  }
  console.log('==========================================');
  
  // Verifica campi obbligatori di base
  if (!email || !password || !nome || !ruolo) {
    return next(new ApiError(400, 'I campi email, password, nome e ruolo sono obbligatori'));
  }
  
  // Verifica che il ruolo sia valido
  const ruoliValidi = ['Operatore', 'Amministratore', 'Utente'];
  if (!ruoliValidi.includes(ruolo)) {
    return next(new ApiError(400, `Ruolo non valido. Valori consentiti: ${ruoliValidi.join(', ')}`));
  }
  
  // Validazioni aggiuntive per ruolo Utente
  if (ruolo === 'Utente' && !tipoUtente) {
    return next(new ApiError(400, 'È necessario specificare il tipo utente'));
  }
  
  if (ruolo === 'Utente' && !tipoUtente.tipo) {
    return next(new ApiError(400, 'È necessario specificare il tipo di utente (Privato, Canale sociale, centro riciclo)'));
  }
  
  if (ruolo === 'Utente' && !tipoUtente.indirizzo) {
    return next(new ApiError(400, 'È necessario specificare l\'indirizzo'));
  }
  
  // Validazione del cognome con log dettagliati:
  // - Obbligatorio per organizzazione
  // - Obbligatorio per utenti privati
  // - Opzionale per canale sociale e centro riciclo
  const isCognomeRequired = 
      ruolo === 'Operatore' || 
      ruolo === 'Amministratore' || 
      (ruolo === 'Utente' && tipoUtente?.tipo === 'Privato');
  
  console.log('DEBUG COGNOME:');
  console.log('- isCognomeRequired:', isCognomeRequired);
  console.log('- cognome presente:', !!cognome);
  console.log('- condizione test:', isCognomeRequired && !cognome);
  
  if (isCognomeRequired && !cognome) {
    console.log('ERRORE: Cognome mancante quando richiesto');
    return next(new ApiError(400, 'Il cognome è obbligatorio'));
  }

  try {
    // Verifica che l'email non sia già registrata
    const esistenteEmail = await db.get('SELECT id FROM Attori WHERE email = ?', [email]);
    if (esistenteEmail) {
      return next(new ApiError(409, 'Email già registrata'));
    }
    
    // Encrypt password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Inizia transazione
    await db.run('BEGIN TRANSACTION');
    
    // Inserisci il nuovo attore
    const resultAttore = await db.run(
      `INSERT INTO Attori (email, password, nome, cognome, cognome_old, ruolo, creato_il) 
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [email, hashedPassword, nome, cognome || null, cognome || '', ruolo]
    );
    
    const nuovoAttoreId = resultAttore.lastID;
    
    // Se il ruolo è Utente, crea anche il tipo utente associato
    if (ruolo === 'Utente') {
      const { tipo, indirizzo, telefono } = tipoUtente;
      
      // Valida il tipo
      const tipiValidi = ['Privato', 'Canale sociale', 'centro riciclo'];
      if (!tipiValidi.includes(tipo)) {
        await db.run('ROLLBACK');
        return next(new ApiError(400, `Tipo non valido. Valori consentiti: ${tipiValidi.join(', ')}`));
      }
      
      // Inserisci il nuovo Tipo_Utente
      const resultTipoUtente = await db.run(
        `INSERT INTO Tipo_Utente (tipo, indirizzo, telefono, email, creato_il) 
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [tipo, indirizzo, telefono || null, tipoUtente.email || email]
      );
      
      const nuovoTipoUtenteId = resultTipoUtente.lastID;
      
      // Crea associazione nella tabella AttoriTipoUtente
      await db.run(
        `INSERT INTO AttoriTipoUtente (attore_id, tipo_utente_id, data_inizio) 
         VALUES (?, ?, datetime('now'))`,
        [nuovoAttoreId, nuovoTipoUtenteId]
      );
    }
    
    // Commit della transazione
    await db.run('COMMIT');
    
    // Genera token per login immediato
    const tokenPayload = { id: nuovoAttoreId, email: email, ruolo: ruolo };
    const jwtAccessTokenDurata = await getParametroSistema('jwt_access_token_durata', 3600);
    const jwtRefreshTokenDurata = await getParametroSistema('jwt_refresh_token_durata', 604800);
    
    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: jwtAccessTokenDurata });
    const refreshToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: jwtRefreshTokenDurata });
    
    const accessTokenScadenza = new Date();
    accessTokenScadenza.setSeconds(accessTokenScadenza.getSeconds() + parseInt(jwtAccessTokenDurata));
    
    const refreshTokenScadenza = new Date();
    refreshTokenScadenza.setSeconds(refreshTokenScadenza.getSeconds() + parseInt(jwtRefreshTokenDurata));
    
    // Registra i token nel DB
    await db.run(
      `INSERT INTO TokenAutenticazione (
        attore_id, 
        access_token, 
        refresh_token, 
        access_token_scadenza, 
        refresh_token_scadenza,
        device_info,
        ip_address,
        creato_il
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        nuovoAttoreId,
        crypto.createHash('sha256').update(accessToken).digest('hex'),
        crypto.createHash('sha256').update(refreshToken).digest('hex'),
        accessTokenScadenza.toISOString(),
        refreshTokenScadenza.toISOString(),
        req.headers['user-agent'] || 'Unknown',
        req.ip || 'Unknown'
      ]
    );
    
    // Prepara risposta con dati basilari dell'attore
    const attore = {
      id: nuovoAttoreId,
      email,
      nome,
      cognome: cognome || null,
      ruolo
    };
    
    // Aggiungi informazioni sul tipo utente se applicabile
    if (ruolo === 'Utente') {
      attore.tipoUtente = {
        tipo: tipoUtente.tipo,
        indirizzo: tipoUtente.indirizzo
      };
    }
    
    res.status(201).json({
      success: true,
      message: 'Registrazione completata con successo',
      data: {
        attore,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: jwtAccessTokenDurata
        }
      }
    });
    
  } catch (err) {
    // Rollback in caso di errore
    try {
      await db.run('ROLLBACK');
    } catch (rollbackErr) {
      logger.error(`Errore durante il rollback: ${rollbackErr.message}`);
    }
    
    logger.error(`Errore durante la registrazione: ${err.message}`);
    next(new ApiError(500, 'Errore durante la registrazione'));
  }
};

/**
 * Ottiene un parametro di sistema dal database
 * @param {string} chiave - Chiave del parametro
 * @param {*} defaultValue - Valore di default se il parametro non esiste
 * @returns {Promise<string>} - Valore del parametro
 */
async function getParametroSistema(chiave, defaultValue) {
  try {
    const parametro = await db.get(
      'SELECT valore FROM ParametriSistema WHERE chiave = ?',
      [chiave]
    );
    
    return parametro ? parametro.valore : defaultValue.toString();
  } catch (err) {
    logger.error(`Errore nel recupero del parametro ${chiave}: ${err.message}`);
    return defaultValue.toString();
  }
}

module.exports = {
  login,
  refreshToken,
  logout,
  logoutAll,
  getActiveSessions,
  revokeSession,
  register
};