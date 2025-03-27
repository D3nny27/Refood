const bcrypt = require('bcrypt');
const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Ottiene il profilo dell'attore corrente
 */
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Ottieni le informazioni dell'attore
    const user = await db.get(
      `SELECT id, email, nome, cognome, ruolo, ultimo_accesso, creato_il 
       FROM Attori 
       WHERE id = ?`,
      [userId]
    );
    
    if (!user) {
      return next(new ApiError(404, 'Utente non trovato'));
    }
    
    // Ottieni i tipi utente associati all'attore
    const tipiUtente = await db.all(
      `SELECT tu.id, tu.tipo, tu.indirizzo, atu.ruolo_specifico, atu.data_inizio
       FROM Tipo_Utente tu
       JOIN AttoriTipoUtente atu ON tu.id = atu.tipo_utente_id
       WHERE atu.attore_id = ?`,
      [userId]
    );
    
    user.tipiUtente = tipiUtente;
    
    res.json(user);
  } catch (err) {
    logger.error(`Errore nel recupero del profilo: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero del profilo'));
  }
};

/**
 * Aggiorna il profilo dell'attore corrente
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { nome, cognome, email, password } = req.body;
    
    // Verifica che l'attore esista
    const existingUser = await db.get('SELECT * FROM Attori WHERE id = ?', [userId]);
    
    if (!existingUser) {
      return next(new ApiError(404, 'Utente non trovato'));
    }
    
    // Verifica che l'email non sia già usata da un altro attore
    if (email && email !== existingUser.email) {
      const emailExists = await db.get('SELECT 1 FROM Attori WHERE email = ? AND id != ?', [email, userId]);
      
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
      `UPDATE Attori SET ${setClause} WHERE id = ?`,
      params
    );
    
    // Recupera i dati aggiornati dell'attore
    const updatedUser = await db.get(
      `SELECT id, email, nome, cognome, ruolo FROM Attori WHERE id = ?`,
      [userId]
    );
    
    // Se la password è stata modificata, revoca tutti i token
    if (password) {
      await db.run(
        `UPDATE TokenAutenticazione SET revocato = 1, revocato_il = CURRENT_TIMESTAMP WHERE attore_id = ? AND revocato = 0`,
        [userId]
      );
      
      logger.info(`Revocati tutti i token per l'attore ${userId} dopo cambio password`);
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
 * Ottiene l'elenco degli attori (solo per admin)
 */
exports.getAllAttori = async (req, res, next) => {
  try {
    const { ruolo, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const currentUserId = req.user.id;
    const isAdmin = req.user.ruolo === 'Amministratore';
    
    // Approccio semplificato - prima verifichiamo se l'attore è realmente un amministratore
    if (!isAdmin) {
      logger.warn(`Utente non amministratore (${currentUserId}) ha tentato di accedere a getAllAttori`);
      return next(new ApiError(403, 'Non autorizzato ad accedere a questa risorsa'));
    }
    
    // Costruiamo le query in modo più semplice
    let queryBase = `
      SELECT DISTINCT u.id, u.email, u.nome, u.cognome, u.ruolo, u.ultimo_accesso, u.creato_il
      FROM Attori u
      LEFT JOIN AttoriTipoUtente uc1 ON u.id = uc1.attore_id
      WHERE 1=1
    `;
    
    let countQueryBase = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM Attori u
      LEFT JOIN AttoriTipoUtente uc1 ON u.id = uc1.attore_id
      WHERE 1=1
    `;
    
    // Prepariamo i parametri base
    const queryParams = [];
    const conditions = [];
    
    // Aggiungiamo la condizione che mostri: 
    // 1. Attori associati ai tipi utente dell'amministratore 
    // 2. Attori creati dall'amministratore
    // 3. L'amministratore stesso
    conditions.push(`
      (
        EXISTS (
          SELECT 1 FROM AttoriTipoUtente uc_admin
          WHERE uc_admin.attore_id = ?
          AND EXISTS (
            SELECT 1 FROM AttoriTipoUtente uc_user
            WHERE uc_user.attore_id = u.id
            AND uc_user.tipo_utente_id = uc_admin.tipo_utente_id
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
    logger.debug(`Esecuzione query attori: ${query} con params: ${JSON.stringify(finalQueryParams)}`);
    const attori = await db.all(query, finalQueryParams);
    logger.debug(`Trovati ${attori.length} attori`);
    
    // Array per memorizzare gli attori finali con i tipi utente
    const attoriWithTipiUtente = [];
    
    // Per ogni attore, recupera i tipi utente associati
    for (const attore of attori) {
      try {
        const tipiUtente = await db.all(
          `SELECT tu.id, tu.tipo, tu.indirizzo
           FROM Tipo_Utente tu
           JOIN AttoriTipoUtente atu ON tu.id = atu.tipo_utente_id
           WHERE atu.attore_id = ?`,
          [attore.id]
        );
        
        attoriWithTipiUtente.push({ ...attore, tipiUtente });
      } catch (err) {
        logger.error(`Errore nel recupero dei tipi utente per l'attore ${attore.id}: ${err.message}`);
        // Aggiungiamo comunque l'attore, ma con un array vuoto di tipi utente
        attoriWithTipiUtente.push({ ...attore, tipiUtente: [] });
      }
    }
    
    // Risposta
    res.json({
      data: attoriWithTipiUtente,
      pagination: {
        total,
        pages,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    logger.error(`Errore nel recupero degli attori: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero degli attori'));
  }
};

/**
 * Ottiene un attore specifico tramite ID (solo per admin)
 */
exports.getAttoreById = async (req, res, next) => {
  try {
    const userId = req.params.id;
    
    // Ottieni le informazioni dell'attore
    const user = await db.get(
      `SELECT id, email, nome, cognome, ruolo, ultimo_accesso, creato_il 
       FROM Attori 
       WHERE id = ?`,
      [userId]
    );
    
    if (!user) {
      return next(new ApiError(404, 'Utente non trovato'));
    }
    
    // Ottieni i tipi utente associati all'attore
    const tipiUtente = await db.all(
      `SELECT tu.id, tu.tipo, tu.indirizzo, atu.ruolo_specifico, atu.data_inizio
       FROM Tipo_Utente tu
       JOIN AttoriTipoUtente atu ON tu.id = atu.tipo_utente_id
       WHERE atu.attore_id = ?`,
      [userId]
    );
    
    user.tipiUtente = tipiUtente;
    
    res.json(user);
  } catch (err) {
    logger.error(`Errore nel recupero dell'attore: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero dell\'attore'));
  }
};

/**
 * Crea un nuovo attore (solo per admin)
 */
exports.createAttore = async (req, res, next) => {
  try {
    const { email, password, nome, cognome, ruolo } = req.body;
    const creatorId = req.user.id; // ID dell'attore che sta creando il nuovo attore
    
    // Verifica che l'email non sia già usata
    const emailExists = await db.get('SELECT 1 FROM Attori WHERE email = ?', [email]);
    
    if (emailExists) {
      return next(new ApiError(400, 'Email già in uso'));
    }
    
    // Verifica che il ruolo sia valido
    const ruoli_validi = ['Operatore', 'Amministratore', 'TipoUtenteSociale', 'TipoUtenteRiciclaggio'];
    if (!ruoli_validi.includes(ruolo)) {
      return next(new ApiError(400, 'Ruolo non valido'));
    }
    
    // Hash della password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Inserisci il nuovo attore
    const result = await db.run(
      `INSERT INTO Attori (email, password, nome, cognome, ruolo, creato_da, creato_il)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [email, hashedPassword, nome, cognome, ruolo, creatorId]
    );
    
    // Recupera l'attore creato
    const newUser = await db.get(
      `SELECT id, email, nome, cognome, ruolo, creato_il 
       FROM Attori 
       WHERE id = ?`,
      [result.lastID]
    );
    
    res.status(201).json({
      message: 'Utente creato con successo',
      user: newUser
    });
  } catch (err) {
    logger.error(`Errore nella creazione dell'attore: ${err.message}`);
    next(new ApiError(500, 'Errore nella creazione dell\'attore'));
  }
};

/**
 * Aggiorna un attore (solo per admin)
 */
exports.updateAttore = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { nome, cognome, email, password, ruolo } = req.body;
    
    // Verifica che l'attore esista
    const existingUser = await db.get('SELECT * FROM Attori WHERE id = ?', [userId]);
    
    if (!existingUser) {
      return next(new ApiError(404, 'Utente non trovato'));
    }
    
    // Verifica che l'email non sia già usata da un altro attore
    if (email && email !== existingUser.email) {
      const emailExists = await db.get('SELECT 1 FROM Attori WHERE email = ? AND id != ?', [email, userId]);
      
      if (emailExists) {
        return next(new ApiError(400, 'Email già in uso'));
      }
    }
    
    // Verifica che il ruolo sia valido
    if (ruolo) {
      const ruoli_validi = ['Operatore', 'Amministratore', 'TipoUtenteSociale', 'TipoUtenteRiciclaggio'];
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
      `UPDATE Attori SET ${setClause} WHERE id = ?`,
      params
    );
    
    // Recupera i dati aggiornati dell'attore
    const updatedUser = await db.get(
      `SELECT id, email, nome, cognome, ruolo FROM Attori WHERE id = ?`,
      [userId]
    );
    
    // Se la password è stata modificata, revoca tutti i token
    if (password) {
      await db.run(
        `UPDATE TokenAutenticazione SET revocato = 1, revocato_il = CURRENT_TIMESTAMP WHERE attore_id = ? AND revocato = 0`,
        [userId]
      );
      
      logger.info(`Revocati tutti i token per l'attore ${userId} dopo modifica password da admin`);
    }
    
    res.json({
      message: 'Utente aggiornato con successo',
      user: updatedUser
    });
  } catch (err) {
    logger.error(`Errore nell'aggiornamento dell'attore: ${err.message}`);
    next(new ApiError(500, 'Errore nell\'aggiornamento dell\'attore'));
  }
};