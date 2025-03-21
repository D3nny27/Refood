const bcrypt = require('bcrypt');
const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Ottiene il profilo dell'utente corrente
 */
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Ottieni le informazioni dell'utente
    const user = await db.get(
      `SELECT id, email, nome, cognome, ruolo, ultimo_accesso, creato_il 
       FROM Utenti 
       WHERE id = ?`,
      [userId]
    );
    
    if (!user) {
      return next(new ApiError(404, 'Utente non trovato'));
    }
    
    // Ottieni i centri associati all'utente
    const centri = await db.all(
      `SELECT c.id, c.nome, c.tipo, uc.ruolo_specifico, uc.data_inizio
       FROM Centri c
       JOIN UtentiCentri uc ON c.id = uc.centro_id
       WHERE uc.utente_id = ?`,
      [userId]
    );
    
    user.centri = centri;
    
    res.json(user);
  } catch (err) {
    logger.error(`Errore nel recupero del profilo: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero del profilo'));
  }
};

/**
 * Aggiorna il profilo dell'utente corrente
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { nome, cognome, email, password } = req.body;
    
    // Verifica che l'utente esista
    const existingUser = await db.get('SELECT * FROM Utenti WHERE id = ?', [userId]);
    
    if (!existingUser) {
      return next(new ApiError(404, 'Utente non trovato'));
    }
    
    // Verifica che l'email non sia già usata da un altro utente
    if (email && email !== existingUser.email) {
      const emailExists = await db.get('SELECT 1 FROM Utenti WHERE email = ? AND id != ?', [email, userId]);
      
      if (emailExists) {
        return next(new ApiError(400, 'Email già in uso'));
      }
    }
    
    // Prepara i dati da aggiornare
    const updates = {};
    const params = [];
    
    if (nome) {
      updates.nome = nome;
      params.push(nome);
    }
    
    if (cognome) {
      updates.cognome = cognome;
      params.push(cognome);
    }
    
    if (email) {
      updates.email = email;
      params.push(email);
    }
    
    if (password) {
      // Hash della password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      updates.password = hashedPassword;
      params.push(hashedPassword);
    }
    
    // Se non ci sono aggiornamenti, return
    if (Object.keys(updates).length === 0) {
      return res.json({
        message: 'Nessun dato da aggiornare',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          nome: existingUser.nome,
          cognome: existingUser.cognome,
          ruolo: existingUser.ruolo
        }
      });
    }
    
    // Costruisci la query di aggiornamento
    const setClause = Object.keys(updates).map(field => `${field} = ?`).join(', ');
    params.push(userId);
    
    await db.run(
      `UPDATE Utenti SET ${setClause} WHERE id = ?`,
      params
    );
    
    // Recupera i dati aggiornati dell'utente
    const updatedUser = await db.get(
      `SELECT id, email, nome, cognome, ruolo FROM Utenti WHERE id = ?`,
      [userId]
    );
    
    // Se la password è stata modificata, revoca tutti i token
    if (password) {
      await db.run(
        `UPDATE TokenAutenticazione SET revocato = 1, revocato_il = CURRENT_TIMESTAMP WHERE utente_id = ? AND revocato = 0`,
        [userId]
      );
      
      logger.info(`Revocati tutti i token per l'utente ${userId} dopo cambio password`);
    }
    
    res.json({
      message: 'Profilo aggiornato con successo',
      user: updatedUser
    });
  } catch (err) {
    logger.error(`Errore nell'aggiornamento del profilo: ${err.message}`);
    next(new ApiError(500, 'Errore nell\'aggiornamento del profilo'));
  }
};

/**
 * Ottiene l'elenco degli utenti (solo per admin)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { ruolo, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Costruzione della query base
    let query = `
      SELECT id, email, nome, cognome, ruolo, ultimo_accesso, creato_il
      FROM Utenti
    `;
    
    // Array per i parametri della query
    const params = [];
    
    // Aggiunta dei filtri
    if (ruolo) {
      query += ` WHERE ruolo = ?`;
      params.push(ruolo);
    }
    
    // Query per contare il totale dei risultati
    const countQuery = `SELECT COUNT(*) as total FROM Utenti ${ruolo ? 'WHERE ruolo = ?' : ''}`;
    
    // Aggiunta dell'ordinamento e della paginazione
    query += ` ORDER BY creato_il DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    // Esecuzione delle query
    const countResult = await db.get(countQuery, ruolo ? [ruolo] : []);
    const users = await db.all(query, params);
    
    // Calcolo info di paginazione
    const total = countResult.total;
    const pages = Math.ceil(total / limit);
    
    res.json({
      data: users,
      pagination: {
        total,
        pages,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    logger.error(`Errore nel recupero degli utenti: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero degli utenti'));
  }
};

/**
 * Ottiene un utente specifico tramite ID (solo per admin)
 */
exports.getUserById = async (req, res, next) => {
  try {
    const userId = req.params.id;
    
    // Ottieni le informazioni dell'utente
    const user = await db.get(
      `SELECT id, email, nome, cognome, ruolo, ultimo_accesso, creato_il 
       FROM Utenti 
       WHERE id = ?`,
      [userId]
    );
    
    if (!user) {
      return next(new ApiError(404, 'Utente non trovato'));
    }
    
    // Ottieni i centri associati all'utente
    const centri = await db.all(
      `SELECT c.id, c.nome, c.tipo, uc.ruolo_specifico, uc.data_inizio
       FROM Centri c
       JOIN UtentiCentri uc ON c.id = uc.centro_id
       WHERE uc.utente_id = ?`,
      [userId]
    );
    
    user.centri = centri;
    
    res.json(user);
  } catch (err) {
    logger.error(`Errore nel recupero dell'utente: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero dell\'utente'));
  }
};

/**
 * Crea un nuovo utente (solo per admin)
 */
exports.createUser = async (req, res, next) => {
  try {
    const { email, password, nome, cognome, ruolo } = req.body;
    
    // Verifica che l'email non sia già usata
    const emailExists = await db.get('SELECT 1 FROM Utenti WHERE email = ?', [email]);
    
    if (emailExists) {
      return next(new ApiError(400, 'Email già in uso'));
    }
    
    // Verifica che il ruolo sia valido
    const ruoli_validi = ['Operatore', 'Amministratore', 'CentroSociale', 'CentroRiciclaggio'];
    if (!ruoli_validi.includes(ruolo)) {
      return next(new ApiError(400, 'Ruolo non valido'));
    }
    
    // Hash della password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Inserisci il nuovo utente
    const result = await db.run(
      `INSERT INTO Utenti (email, password, nome, cognome, ruolo, creato_il)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [email, hashedPassword, nome, cognome, ruolo]
    );
    
    // Recupera l'utente creato
    const newUser = await db.get(
      `SELECT id, email, nome, cognome, ruolo, creato_il 
       FROM Utenti 
       WHERE id = ?`,
      [result.lastID]
    );
    
    res.status(201).json({
      message: 'Utente creato con successo',
      user: newUser
    });
  } catch (err) {
    logger.error(`Errore nella creazione dell'utente: ${err.message}`);
    next(new ApiError(500, 'Errore nella creazione dell\'utente'));
  }
};

/**
 * Aggiorna un utente (solo per admin)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { nome, cognome, email, password, ruolo } = req.body;
    
    // Verifica che l'utente esista
    const existingUser = await db.get('SELECT * FROM Utenti WHERE id = ?', [userId]);
    
    if (!existingUser) {
      return next(new ApiError(404, 'Utente non trovato'));
    }
    
    // Verifica che l'email non sia già usata da un altro utente
    if (email && email !== existingUser.email) {
      const emailExists = await db.get('SELECT 1 FROM Utenti WHERE email = ? AND id != ?', [email, userId]);
      
      if (emailExists) {
        return next(new ApiError(400, 'Email già in uso'));
      }
    }
    
    // Verifica che il ruolo sia valido
    if (ruolo) {
      const ruoli_validi = ['Operatore', 'Amministratore', 'CentroSociale', 'CentroRiciclaggio'];
      if (!ruoli_validi.includes(ruolo)) {
        return next(new ApiError(400, 'Ruolo non valido'));
      }
    }
    
    // Prepara i dati da aggiornare
    const updates = {};
    const params = [];
    
    if (nome) {
      updates.nome = nome;
      params.push(nome);
    }
    
    if (cognome) {
      updates.cognome = cognome;
      params.push(cognome);
    }
    
    if (email) {
      updates.email = email;
      params.push(email);
    }
    
    if (ruolo) {
      updates.ruolo = ruolo;
      params.push(ruolo);
    }
    
    if (password) {
      // Hash della password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      updates.password = hashedPassword;
      params.push(hashedPassword);
    }
    
    // Se non ci sono aggiornamenti, return
    if (Object.keys(updates).length === 0) {
      return res.json({
        message: 'Nessun dato da aggiornare',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          nome: existingUser.nome,
          cognome: existingUser.cognome,
          ruolo: existingUser.ruolo
        }
      });
    }
    
    // Costruisci la query di aggiornamento
    const setClause = Object.keys(updates).map(field => `${field} = ?`).join(', ');
    params.push(userId);
    
    await db.run(
      `UPDATE Utenti SET ${setClause} WHERE id = ?`,
      params
    );
    
    // Recupera i dati aggiornati dell'utente
    const updatedUser = await db.get(
      `SELECT id, email, nome, cognome, ruolo FROM Utenti WHERE id = ?`,
      [userId]
    );
    
    // Se la password è stata modificata, revoca tutti i token
    if (password) {
      await db.run(
        `UPDATE TokenAutenticazione SET revocato = 1, revocato_il = CURRENT_TIMESTAMP WHERE utente_id = ? AND revocato = 0`,
        [userId]
      );
      
      logger.info(`Revocati tutti i token per l'utente ${userId} dopo modifica password da admin`);
    }
    
    res.json({
      message: 'Utente aggiornato con successo',
      user: updatedUser
    });
  } catch (err) {
    logger.error(`Errore nell'aggiornamento dell'utente: ${err.message}`);
    next(new ApiError(500, 'Errore nell\'aggiornamento dell\'utente'));
  }
}; 