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
    const currentUserId = req.user.id;
    const isAdmin = req.user.ruolo === 'Amministratore';
    
    // Approccio semplificato - prima verifichiamo se l'utente è realmente un amministratore
    if (!isAdmin) {
      logger.warn(`Utente non amministratore (${currentUserId}) ha tentato di accedere a getAllUsers`);
      return next(new ApiError(403, 'Non autorizzato ad accedere a questa risorsa'));
    }
    
    // Costruiamo le query in modo più semplice
    let queryBase = `
      SELECT DISTINCT u.id, u.email, u.nome, u.cognome, u.ruolo, u.ultimo_accesso, u.creato_il
      FROM Utenti u
      LEFT JOIN UtentiCentri uc1 ON u.id = uc1.utente_id
      WHERE 1=1
    `;
    
    let countQueryBase = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM Utenti u
      LEFT JOIN UtentiCentri uc1 ON u.id = uc1.utente_id
      WHERE 1=1
    `;
    
    // Prepariamo i parametri base
    const queryParams = [];
    const conditions = [];
    
    // Aggiungiamo la condizione che mostri: 
    // 1. Utenti associati ai centri dell'amministratore 
    // 2. Utenti creati dall'amministratore
    // 3. L'amministratore stesso
    conditions.push(`
      (
        EXISTS (
          SELECT 1 FROM UtentiCentri uc_admin
          WHERE uc_admin.utente_id = ?
          AND EXISTS (
            SELECT 1 FROM UtentiCentri uc_user
            WHERE uc_user.utente_id = u.id
            AND uc_user.centro_id = uc_admin.centro_id
          )
        )
        OR u.creato_da = ?
        OR u.id = ?
      )
    `);
    queryParams.push(currentUserId, currentUserId, currentUserId);
    
    // Aggiungiamo il filtro per ruolo se presente
    if (ruolo) {
      conditions.push(`u.ruolo = ?`);
      queryParams.push(ruolo);
    }
    
    // Costruiamo la query finale
    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
    const query = `${queryBase} ${whereClause} ORDER BY u.creato_il DESC LIMIT ? OFFSET ?`;
    const countQuery = `${countQueryBase} ${whereClause}`;
    
    // Aggiungiamo i parametri di paginazione per la query principale
    const finalQueryParams = [...queryParams, parseInt(limit), offset];
    
    // Esecuzione query di conteggio
    logger.debug(`Esecuzione query di conteggio: ${countQuery} con params: ${JSON.stringify(queryParams)}`);
    const countResult = await db.get(countQuery, queryParams);
    logger.debug(`Risultato count query: ${JSON.stringify(countResult)}`);
    
    // Se non abbiamo ottenuto un risultato valido dal conteggio, assumiamo 0
    const total = countResult && countResult.total ? parseInt(countResult.total) : 0;
    const pages = Math.ceil(total / limit);
    
    // Esecuzione query principale
    logger.debug(`Esecuzione query utenti: ${query} con params: ${JSON.stringify(finalQueryParams)}`);
    const users = await db.all(query, finalQueryParams);
    logger.debug(`Trovati ${users.length} utenti`);
    
    // Array per memorizzare gli utenti finali con i centri
    const usersWithCentri = [];
    
    // Per ogni utente, recupera i centri associati
    for (const user of users) {
      try {
        const centri = await db.all(
          `SELECT c.id, c.nome, c.tipo
           FROM Centri c
           JOIN UtentiCentri uc ON c.id = uc.centro_id
           WHERE uc.utente_id = ?`,
          [user.id]
        );
        
        usersWithCentri.push({ ...user, centri });
      } catch (err) {
        logger.error(`Errore nel recupero dei centri per l'utente ${user.id}: ${err.message}`);
        // Aggiungiamo comunque l'utente, ma con un array vuoto di centri
        usersWithCentri.push({ ...user, centri: [] });
      }
    }
    
    // Risposta
    res.json({
      data: usersWithCentri,
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
    const creatorId = req.user.id; // ID dell'utente che sta creando il nuovo utente
    
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
      `INSERT INTO Utenti (email, password, nome, cognome, ruolo, creato_da, creato_il)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [email, hashedPassword, nome, cognome, ruolo, creatorId]
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