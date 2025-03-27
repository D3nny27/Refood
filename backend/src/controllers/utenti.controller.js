const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Ottiene l'elenco degli utenti (ex centri) con filtri opzionali
 */
const getUtenti = async (req, res, next) => {
  try {
    const { tipo, nome, raggio, lat, lng, page = 1, limit = 20, associatiA } = req.query;
    const offset = (page - 1) * limit;
    
    // Filtra in base al ruolo dell'attore
    const isAdmin = req.user.ruolo === 'Amministratore';
    
    // Costruisci la query di base
    let query = `
      SELECT u.*, ct.descrizione as tipo_descrizione
      FROM Utenti u
      LEFT JOIN CentriTipi ct ON u.tipo_id = ct.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Se è specificato un ID attore per le associazioni
    if (associatiA) {
      query = `
        SELECT u.*, ct.descrizione as tipo_descrizione
        FROM Utenti u
        LEFT JOIN CentriTipi ct ON u.tipo_id = ct.id
        JOIN UtentiCentri uc ON u.id = uc.centro_id
        WHERE uc.utente_id = ?
      `;
      params.push(parseInt(associatiA));
    }
    // Se è un amministratore, filtra per gli utenti di sua competenza
    else if (isAdmin) {
      // Modifichiamo la query per ottenere solo gli utenti associati all'amministratore
      query = `
        SELECT u.*, ct.descrizione as tipo_descrizione
        FROM Utenti u
        LEFT JOIN CentriTipi ct ON u.tipo_id = ct.id
        WHERE 1=1
        AND (
          EXISTS (
            SELECT 1 FROM UtentiCentri uc
            WHERE uc.utente_id = ? AND uc.centro_id = u.id
          )
          OR NOT EXISTS (
            SELECT 1 FROM UtentiCentri uc2
            WHERE uc2.centro_id = u.id
          )
        )
      `;
      
      params.push(req.user.id);
    }
    
    // Applicazione dei filtri
    if (tipo) {
      query += ' AND u.tipo LIKE ?';
      params.push(`%${tipo}%`);
    }
    
    if (nome) {
      query += ' AND u.nome LIKE ?';
      params.push(`%${nome}%`);
    }
    
    // Calcolo della distanza se sono fornite coordinate
    if (raggio && lat && lng) {
      // Aggiungi calcolo della distanza usando formula di Haversine
      // Preserviamo la condizione di filtro dell'amministratore
      let baseQuery = isAdmin && !associatiA ? 
        `
          SELECT u.*, ct.descrizione as tipo_descrizione
          FROM Utenti u
          LEFT JOIN CentriTipi ct ON u.tipo_id = ct.id
          WHERE 1=1
          AND (
            EXISTS (
              SELECT 1 FROM UtentiCentri uc
              WHERE uc.utente_id = ? AND uc.centro_id = u.id
            )
            OR NOT EXISTS (
              SELECT 1 FROM UtentiCentri uc2
              WHERE uc2.centro_id = u.id
            )
          )
        ` : 
        associatiA ? 
        `
          SELECT u.*, ct.descrizione as tipo_descrizione
          FROM Utenti u
          LEFT JOIN CentriTipi ct ON u.tipo_id = ct.id
          JOIN UtentiCentri uc ON u.id = uc.centro_id
          WHERE uc.utente_id = ?
        ` :
        `
          SELECT u.*, ct.descrizione as tipo_descrizione
          FROM Utenti u
          LEFT JOIN CentriTipi ct ON u.tipo_id = ct.id
          WHERE 1=1
        `;
      
      query = `
        ${baseQuery},
        (
          6371 * acos(
            cos(radians(?)) * 
            cos(radians(u.latitudine)) * 
            cos(radians(u.longitudine) - radians(?)) + 
            sin(radians(?)) * 
            sin(radians(u.latitudine))
          )
        ) AS distanza
      `;
      
      if (isAdmin && !associatiA) {
        params.push(req.user.id);
      } else if (associatiA) {
        params.push(parseInt(associatiA));
      }
      
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(lat));
      
      // Filtra per raggio
      query += ` AND (
        6371 * acos(
          cos(radians(?)) * 
          cos(radians(u.latitudine)) * 
          cos(radians(u.longitudine) - radians(?)) + 
          sin(radians(?)) * 
          sin(radians(u.latitudine))
        )
      ) <= ?`;
      
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(lat), parseFloat(raggio));
    }
    
    // Query per conteggio totale
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    
    // Aggiungi ordinamento e paginazione
    if (raggio && lat && lng) {
      query += ' ORDER BY distanza ASC';
    } else {
      query += ' ORDER BY u.nome ASC';
    }
    
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    // Esegui entrambe le query
    const totalResult = await db.get(countQuery, params.slice(0, params.length - 2));
    const utenti = await db.all(query, params);
    
    // Calcola paginazione
    const total = totalResult.total;
    const pages = Math.ceil(total / limit);
    
    res.json({
      data: utenti,
      pagination: {
        total,
        pages,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ottiene i dettagli di un singolo utente (ex centro)
 */
const getUtenteById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.ruolo === 'Amministratore';
    
    // Se è un amministratore, verificare che abbia accesso a questo utente
    if (isAdmin) {
      const accessQuery = `
        SELECT 1 FROM UtentiCentri 
        WHERE utente_id = ? AND centro_id = ?
      `;
      
      // Verifica se ci sono associazioni per questo utente
      const existsQuery = `
        SELECT 1 FROM UtentiCentri 
        WHERE centro_id = ?
      `;
      
      const hasAccess = await db.get(accessQuery, [req.user.id, id]);
      const existsAssociations = await db.get(existsQuery, [id]);
      
      // Se esistono associazioni ma l'admin non ha accesso, blocca
      if (existsAssociations && !hasAccess) {
        throw new ApiError(403, 'Non hai accesso a questo utente');
      }
    }
    
    // Ottieni informazioni dettagliate sull'utente
    const query = `
      SELECT u.*, ct.descrizione as tipo_descrizione, ct.icona as tipo_icona, ct.colore as tipo_colore
      FROM Utenti u
      LEFT JOIN CentriTipi ct ON u.tipo_id = ct.id
      WHERE u.id = ?
    `;
    
    const utente = await db.get(query, [id]);
    
    if (!utente) {
      throw new ApiError(404, 'Utente non trovato');
    }
    
    // Ottieni il conteggio degli operatori associati
    const operatoriQuery = `
      SELECT COUNT(*) as count
      FROM UtentiCentri uc
      JOIN Attori a ON uc.utente_id = a.id
      WHERE uc.centro_id = ? AND a.ruolo IN ('Operatore', 'Amministratore')
    `;
    
    const operatoriCount = await db.get(operatoriQuery, [id]);
    utente.operatori_assegnati = operatoriCount.count;
    
    // Ottieni Statistiche Di Base
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT l.id) as num_lotti,
        COUNT(DISTINCT p.id) as num_prenotazioni_ricevute,
        (
          SELECT COUNT(*) 
          FROM Prenotazioni p2
          JOIN Lotti l2 ON p2.lotto_id = l2.id
          WHERE l2.centro_origine_id = ?
        ) as num_prenotazioni_effettuate
      FROM Lotti l
      LEFT JOIN Prenotazioni p ON l.id = p.lotto_id
      WHERE l.centro_origine_id = ?
    `;
    
    const stats = await db.get(statsQuery, [id, id]);
    utente.statistiche = stats;
    
    res.json(utente);
  } catch (error) {
    next(error);
  }
};

/**
 * Crea un nuovo utente
 */
const createUtente = async (req, res, next) => {
  try {
    const { 
      nome, 
      tipo_id, 
      indirizzo, 
      telefono, 
      email, 
      latitudine, 
      longitudine,
      tipo 
    } = req.body;
    
    let tipoUtente = null;
    // Verifica che il tipo di utente esista, solo se è stato fornito
    if (tipo_id) {
      // Verifica che tipo_id sia un numero intero
      if (!Number.isInteger(Number(tipo_id))) {
        throw new ApiError(400, 'Tipo ID deve essere un numero intero');
      }

      const tipoQuery = `SELECT * FROM CentriTipi WHERE id = ?`;
      tipoUtente = await db.get(tipoQuery, [tipo_id]);
      
      if (!tipoUtente) {
        throw new ApiError(400, 'Tipo di utente non valido');
      }
    }
    
    // Verifica che non esista già un utente con lo stesso nome
    const utenteEsistenteQuery = `SELECT id FROM Utenti WHERE nome = ?`;
    const utenteEsistente = await db.get(utenteEsistenteQuery, [nome]);
    
    if (utenteEsistente) {
      throw new ApiError(409, 'Esiste già un utente con questo nome');
    }
    
    // Se non è stato fornito un tipo ma solo tipo_id, ottieni il tipo dalla tabella CentriTipi
    const tipoValue = tipo || (tipoUtente ? tipoUtente.descrizione : null);
    
    // Verifica che sia presente almeno un campo tipo
    if (!tipoValue && !tipo_id) {
      throw new ApiError(400, 'È necessario specificare un tipo per l\'utente');
    }
    
    // Inserisci il nuovo utente
    const insertQuery = `
      INSERT INTO Utenti (
        nome, tipo, indirizzo, telefono, email,
        latitudine, longitudine, tipo_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await db.run(
      insertQuery, 
      [
        nome,
        tipoValue,
        indirizzo,
        telefono || null,
        email || null,
        latitudine || null,
        longitudine || null,
        tipo_id || null  // Usa null se tipo_id non è stato fornito
      ]
    );
    
    if (!result.lastID) {
      throw new ApiError(500, 'Errore durante la creazione dell\'utente');
    }
    
    // Associa automaticamente l'amministratore che ha creato l'utente
    if (req.user && req.user.ruolo === 'Amministratore') {
      logger.info(`Associazione automatica dell'amministratore ID ${req.user.id} all'utente ID ${result.lastID}`);
      
      // Verifica che l'amministratore non sia già associato all'utente (per sicurezza)
      const associazioneEsistenteQuery = `
        SELECT 1 FROM UtentiCentri
        WHERE utente_id = ? AND centro_id = ?
      `;
      
      const associazioneEsistente = await db.get(associazioneEsistenteQuery, [req.user.id, result.lastID]);
      
      if (!associazioneEsistente) {
        // Crea l'associazione
        const insertAssociazioneQuery = `
          INSERT INTO UtentiCentri (
            utente_id, centro_id, ruolo_specifico
          ) VALUES (?, ?, ?)
        `;
        
        await db.run(insertAssociazioneQuery, [req.user.id, result.lastID, 'SuperAdmin']);
        logger.info(`Amministratore ID ${req.user.id} associato con successo all'utente ID ${result.lastID}`);
      }
    }
    
    // Recupera l'utente appena creato - senza join per essere sicuri di ottenerlo
    const utente = await db.get(
      'SELECT * FROM Utenti WHERE id = ?',
      [result.lastID]
    );
    
    res.status(201).json(utente);
  } catch (error) {
    next(error);
  }
};

/**
 * Aggiorna un utente esistente
 */
const updateUtente = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      nome, 
      tipo_id, 
      indirizzo, 
      telefono, 
      email, 
      latitudine, 
      longitudine, 
      descrizione, 
      orari_apertura 
    } = req.body;
    
    // Verifica che l'utente esista
    const utenteQuery = `SELECT * FROM Utenti WHERE id = ?`;
    const utente = await db.get(utenteQuery, [id]);
    
    if (!utente) {
      throw new ApiError(404, 'Utente non trovato');
    }
    
    // Se è fornito un tipo_id, verifica che esista
    if (tipo_id) {
      const tipoQuery = `SELECT * FROM CentriTipi WHERE id = ?`;
      const tipo = await db.get(tipoQuery, [tipo_id]);
      
      if (!tipo) {
        throw new ApiError(400, 'Tipo di utente non valido');
      }
    }
    
    // Se è fornito un nome, verifica che non sia già usato da un altro utente
    if (nome && nome !== utente.nome) {
      const utenteEsistenteQuery = `SELECT id FROM Utenti WHERE nome = ? AND id != ?`;
      const utenteEsistente = await db.get(utenteEsistenteQuery, [nome, id]);
      
      if (utenteEsistente) {
        throw new ApiError(409, 'Esiste già un utente con questo nome');
      }
    }
    
    // Costruisci la query di aggiornamento
    let updateQuery = `UPDATE Utenti SET `;
    const updateFields = [];
    const updateParams = [];
    
    if (nome !== undefined) {
      updateFields.push('nome = ?');
      updateParams.push(nome);
    }
    
    if (tipo_id !== undefined) {
      updateFields.push('tipo_id = ?');
      updateParams.push(tipo_id);
    }
    
    if (indirizzo !== undefined) {
      updateFields.push('indirizzo = ?');
      updateParams.push(indirizzo);
    }
    
    if (telefono !== undefined) {
      updateFields.push('telefono = ?');
      updateParams.push(telefono);
    }
    
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateParams.push(email);
    }
    
    if (latitudine !== undefined) {
      updateFields.push('latitudine = ?');
      updateParams.push(latitudine);
    }
    
    if (longitudine !== undefined) {
      updateFields.push('longitudine = ?');
      updateParams.push(longitudine);
    }
    
    if (descrizione !== undefined) {
      updateFields.push('descrizione = ?');
      updateParams.push(descrizione);
    }
    
    if (orari_apertura !== undefined) {
      updateFields.push('orari_apertura = ?');
      updateParams.push(orari_apertura);
    }
    
    // Se non ci sono campi da aggiornare
    if (updateFields.length === 0) {
      throw new ApiError(400, 'Nessun dato valido fornito per l\'aggiornamento');
    }
    
    updateQuery += updateFields.join(', ');
    updateQuery += ' WHERE id = ?';
    updateParams.push(id);
    
    // Esegui l'aggiornamento
    await db.run(updateQuery, updateParams);
    
    // Recupera l'utente aggiornato
    const utenteAggiornato = await db.get(
      'SELECT u.*, ct.descrizione as tipo_descrizione FROM Utenti u LEFT JOIN CentriTipi ct ON u.tipo_id = ct.id WHERE u.id = ?',
      [id]
    );
    
    res.json(utenteAggiornato);
  } catch (error) {
    next(error);
  }
};

/**
 * Elimina un utente
 */
const deleteUtente = async (req, res, next) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    // Verifica che l'utente esista
    const utenteQuery = `SELECT * FROM Utenti WHERE id = ?`;
    const utente = await connection.query(utenteQuery, [id]);
    
    if (!utente[0]) {
      throw new ApiError(404, 'Utente non trovato');
    }
    
    // Verifica che non ci siano lotti attivi associati a questo utente
    const lottiQuery = `
      SELECT COUNT(*) as count FROM Lotti 
      WHERE centro_origine_id = ? 
      AND stato IN ('Verde', 'Arancione')
    `;
    
    const lottiResult = await connection.query(lottiQuery, [id]);
    
    if (lottiResult[0].count > 0) {
      throw new ApiError(400, 'Impossibile eliminare l\'utente: ci sono lotti attivi associati');
    }
    
    // Verifica che non ci siano prenotazioni attive associate a questo utente
    const prenotazioniQuery = `
      SELECT COUNT(*) as count FROM Prenotazioni 
      WHERE centro_ricevente_id = ? 
      AND stato IN ('Prenotato', 'InTransito')
    `;
    
    const prenotazioniResult = await connection.query(prenotazioniQuery, [id]);
    
    if (prenotazioniResult[0].count > 0) {
      throw new ApiError(400, 'Impossibile eliminare l\'utente: ci sono prenotazioni attive associate');
    }
    
    // Elimina tutte le associazioni utente-centro
    await connection.query(
      'DELETE FROM UtentiCentri WHERE utente_id = ?',
      [id]
    );
    
    // Archivia i lotti associati all'utente invece di eliminarli
    // Prima copia nella tabella archivio
    await connection.query(`
      INSERT INTO LottiArchivio 
      SELECT *, NOW() as data_archiviazione 
      FROM Lotti 
      WHERE centro_origine_id = ?
    `, [id]);
    
    // Poi elimina dalla tabella attiva
    await connection.query(
      'DELETE FROM Lotti WHERE centro_origine_id = ?',
      [id]
    );
    
    // Archivia le prenotazioni associate all'utente
    await connection.query(`
      INSERT INTO PrenotazioniArchivio 
      SELECT *, NOW() as data_archiviazione 
      FROM Prenotazioni 
      WHERE centro_ricevente_id = ?
    `, [id]);
    
    // Elimina dalla tabella attiva
    await connection.query(
      'DELETE FROM Prenotazioni WHERE centro_ricevente_id = ?',
      [id]
    );
    
    // Elimina l'utente
    await connection.query(
      'DELETE FROM Utenti WHERE id = ?',
      [id]
    );
    
    await connection.commit();
    
    res.json({
      message: 'Utente eliminato con successo',
      id: parseInt(id)
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * Ottiene tutti i tipi di utente
 */
const getUtentiTipi = async (req, res, next) => {
  try {
    const query = `SELECT * FROM CentriTipi ORDER BY descrizione`;
    const tipi = await db.all(query);
    
    res.json(tipi);
  } catch (error) {
    next(error);
  }
};

/**
 * Ottiene gli utenti associati a un utente
 */
const getUtenteAttori = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.ruolo === 'Amministratore';
    
    // Verifica che l'utente esista
    const utenteQuery = `SELECT * FROM Utenti WHERE id = ?`;
    const utente = await db.get(utenteQuery, [id]);
    
    if (!utente) {
      throw new ApiError(404, 'Utente non trovato');
    }
    
    // Se è un amministratore, verificare che abbia accesso a questo utente
    if (isAdmin) {
      const accessQuery = `
        SELECT 1 FROM UtentiCentri 
        WHERE utente_id = ? AND centro_id = ?
      `;
      
      // Verifica se ci sono associazioni per questo utente
      const existsQuery = `
        SELECT 1 FROM UtentiCentri 
        WHERE centro_id = ?
      `;
      
      const hasAccess = await db.get(accessQuery, [req.user.id, id]);
      const existsAssociations = await db.get(existsQuery, [id]);
      
      // Se ci sono associazioni ma l'amministratore non ha accesso, blocca la richiesta
      if (existsAssociations && !hasAccess) {
        throw new ApiError(403, 'Non hai accesso a questo utente');
      }
    }
    
    // Ottieni gli utenti associati
    const attoriQuery = `
      SELECT u.id, u.nome, u.cognome, u.email, u.ruolo
      FROM Utenti u
      JOIN UtentiCentri uc ON u.id = uc.utente_id
      WHERE uc.centro_id = ?
      ORDER BY u.cognome, u.nome
    `;
    
    const attori = await db.all(attoriQuery, [id]);
    
    res.json(attori);
  } catch (error) {
    next(error);
  }
};

/**
 * Associa un utente a un utente
 */
const associaAttore = async (req, res, next) => {
  try {
    const { id, utente_id } = req.params;
    
    // Verifica che l'utente esista
    const centroQuery = `SELECT * FROM Utenti WHERE id = ?`;
    const centroRecord = await db.get(centroQuery, [id]);
    
    if (!centroRecord) {
      throw new ApiError(404, 'Utente non trovato');
    }
    
    // Verifica che l'utente esista
    const utenteQuery = `SELECT * FROM Utenti WHERE id = ?`;
    const utente = await db.get(utenteQuery, [utente_id]);
    
    if (!utente) {
      throw new ApiError(404, 'Utente non trovato');
    }
    
    // Verifica che l'utente non sia già associato all'utente
    const associazioneQuery = `
      SELECT 1 FROM UtentiCentri
      WHERE utente_id = ? AND centro_id = ?
    `;
    
    const associazioneEsistente = await db.get(associazioneQuery, [utente_id, id]);
    
    if (associazioneEsistente) {
      throw new ApiError(409, 'Utente già associato a questo utente');
    }
    
    // Crea l'associazione
    const insertQuery = `
      INSERT INTO UtentiCentri (
        utente_id, centro_id
      ) VALUES (?, ?)
    `;
    
    await db.run(insertQuery, [utente_id, id]);
    
    res.status(201).json({
      message: 'Utente associato all\'utente con successo',
      utente_id: parseInt(utente_id),
      centro_id: parseInt(id)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Rimuove un utente da un utente
 */
const rimuoviAttore = async (req, res, next) => {
  try {
    const { id, utente_id } = req.params;
    
    // Verifica che l'utente esista
    const centroQuery = `SELECT * FROM Utenti WHERE id = ?`;
    const centroRecord = await db.get(centroQuery, [id]);
    
    if (!centroRecord) {
      throw new ApiError(404, 'Utente non trovato');
    }
    
    // Verifica che l'utente esista
    const utenteQuery = `SELECT * FROM Utenti WHERE id = ?`;
    const utente = await db.get(utenteQuery, [utente_id]);
    
    if (!utente) {
      throw new ApiError(404, 'Utente non trovato');
    }
    
    // Verifica che l'utente sia effettivamente associato all'utente
    const associazioneQuery = `
      SELECT 1 FROM UtentiCentri
      WHERE utente_id = ? AND centro_id = ?
    `;
    
    const associazioneEsistente = await db.get(associazioneQuery, [utente_id, id]);
    
    if (!associazioneEsistente) {
      throw new ApiError(400, 'Utente non associato a questo utente');
    }
    
    // Elimina l'associazione
    const deleteQuery = `
      DELETE FROM UtentiCentri
      WHERE utente_id = ? AND centro_id = ?
    `;
    
    await db.run(deleteQuery, [utente_id, id]);
    
    res.json({
      message: 'Utente rimosso dall\'utente con successo',
      utente_id: parseInt(utente_id),
      centro_id: parseInt(id)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ottiene le statistiche di un utente in un periodo specifico
 */
const getUtenteStatistiche = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { inizio, fine } = req.query;
    
    // Verifica che l'utente esista
    const centroQuery = `SELECT * FROM Utenti WHERE id = ?`;
    const centroRecord = await db.get(centroQuery, [id]);
    
    if (!centroRecord) {
      throw new ApiError(404, 'Utente non trovato');
    }
    
    // Predisponi le condizioni di data
    let dataCondition = '';
    const params = [id];
    
    if (inizio && fine) {
      dataCondition = ' AND data_creazione BETWEEN ? AND ?';
      params.push(inizio, fine);
    } else if (inizio) {
      dataCondition = ' AND data_creazione >= ?';
      params.push(inizio);
    } else if (fine) {
      dataCondition = ' AND data_creazione <= ?';
      params.push(fine);
    }
    
    // Statistiche lotti creati
    const lottiQuery = `
      SELECT 
        COUNT(*) as totale,
        COUNT(CASE WHEN stato = 'Verde' THEN 1 END) as verdi,
        COUNT(CASE WHEN stato = 'Arancione' THEN 1 END) as arancioni,
        COUNT(CASE WHEN stato = 'Rosso' THEN 1 END) as rossi,
        SUM(quantita) as quantita_totale
      FROM Lotti
      WHERE centro_origine_id = ?${dataCondition}
    `;
    
    // Statistiche prenotazioni
    const prenotazioniRicevuteQuery = `
      SELECT 
        COUNT(*) as totale,
        COUNT(CASE WHEN stato = 'Prenotato' THEN 1 END) as attive,
        COUNT(CASE WHEN stato = 'InTransito' THEN 1 END) as in_transito,
        COUNT(CASE WHEN stato = 'Consegnato' THEN 1 END) as completate,
        COUNT(CASE WHEN stato = 'Annullato' THEN 1 END) as annullate
      FROM Prenotazioni
      WHERE centro_ricevente_id = ?${dataCondition}
    `;
    
    // Statistiche per lotti ricevuti
    const lottiRicevutiQuery = `
      SELECT 
        COUNT(*) as totale,
        SUM(l.quantita) as quantita_totale
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      WHERE p.centro_ricevente_id = ?
      AND p.stato = 'Consegnato'${dataCondition}
    `;
    
    // Calcolo impatto ambientale ed economico
    const impattoQuery = `
      SELECT 
        SUM(ic.co2_risparmiata) as co2_risparmiata,
        SUM(ic.acqua_risparmiata) as acqua_risparmiata,
        SUM(ic.valore_economico) as valore_economico
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      JOIN ImpattoCO2 ic ON l.id = ic.lotto_id
      WHERE (p.centro_ricevente_id = ? OR l.centro_origine_id = ?)
      AND p.stato = 'Consegnato'${dataCondition}
    `;
    
    // Esegui tutte le query in parallelo
    const [
      lottiStats, 
      prenotazioniStats, 
      lottiRicevutiStats, 
      impattoStats
    ] = await Promise.all([
      db.get(lottiQuery, params),
      db.get(prenotazioniRicevuteQuery, params),
      db.get(lottiRicevutiQuery, params),
      db.get(impattoQuery, [...params, id]) // Aggiungi id una seconda volta per OR nella query
    ]);
    
    // Top 5 prodotti più ceduti
    const topProdottiQuery = `
      SELECT 
        l.prodotto,
        SUM(l.quantita) as quantita_totale,
        COUNT(*) as occorrenze
      FROM Lotti l
      WHERE l.centro_origine_id = ?${dataCondition}
      GROUP BY l.prodotto
      ORDER BY quantita_totale DESC
      LIMIT 5
    `;
    
    const topProdotti = await db.all(topProdottiQuery, params);
    
    // Statistiche di andamento temporale (ultimi 6 mesi)
    const andamentoQuery = `
      SELECT 
        strftime('%Y-%m', data_creazione) as mese,
        COUNT(*) as lotti_creati,
        SUM(quantita) as quantita_ceduta
      FROM Lotti
      WHERE centro_origine_id = ?
      AND data_creazione >= date('now', '-6 month')
      GROUP BY mese
      ORDER BY mese
    `;
    
    const andamento = await db.all(andamentoQuery, [id]);
    
    // Prepara risposta
    const statistiche = {
      utente: {
        id: centroRecord.id,
        nome: centroRecord.nome,
        tipo: centroRecord.tipo_id
      },
      periodo: {
        inizio: inizio || 'inizio',
        fine: fine || 'oggi'
      },
      lotti_creati: lottiStats,
      lotti_ricevuti: lottiRicevutiStats,
      prenotazioni: prenotazioniStats,
      impatto_ambientale: impattoStats,
      top_prodotti: topProdotti,
      andamento_mensile: andamento
    };
    
    res.json(statistiche);
  } catch (error) {
    next(error);
  }
};

/**
 * Associa più operatori e/o amministratori a un utente in una singola operazione
 */
const associaOperatori = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { operatori_ids = [], amministratori_ids = [] } = req.body;
    const isAdmin = req.user.ruolo === 'Amministratore';
    
    // Verifica che l'utente esista
    const centroQuery = `SELECT * FROM Utenti WHERE id = ?`;
    const centroRecord = await db.get(centroQuery, [id]);
    
    if (!centroRecord) {
      throw new ApiError(404, 'Utente non trovato');
    }
    
    // Verifica che l'amministratore abbia i permessi necessari (deve essere SuperAdmin del utente)
    const permessiQuery = `
      SELECT ruolo_specifico 
      FROM UtentiCentri 
      WHERE utente_id = ? AND centro_id = ?
    `;
    
    const permessi = await db.get(permessiQuery, [req.user.id, id]);
    const isSuperAdmin = permessi && permessi.ruolo_specifico === 'SuperAdmin';
    
    // Solo il SuperAdmin può aggiungere altri amministratori
    if (amministratori_ids.length > 0 && !isSuperAdmin) {
      throw new ApiError(403, 'Solo il SuperAdmin del utente può aggiungere altri amministratori');
    }
    
    // Se è un amministratore, verificare che abbia accesso a questo utente
    if (isAdmin && !isSuperAdmin) {
      const accessQuery = `
        SELECT 1 FROM UtentiCentri 
        WHERE utente_id = ? AND centro_id = ?
      `;
      
      // Verifica se ci sono associazioni per questo utente
      const existsQuery = `
        SELECT 1 FROM UtentiCentri 
        WHERE centro_id = ?
      `;
      
      const hasAccess = await db.get(accessQuery, [req.user.id, id]);
      const existsAssociations = await db.get(existsQuery, [id]);
      
      // Se ci sono associazioni ma l'amministratore non ha accesso, blocca la richiesta
      if (existsAssociations && !hasAccess) {
        throw new ApiError(403, 'Non hai accesso a questo utente');
      }
    }
    
    // Ottieni le associazioni esistenti, divise per ruolo specifico
    const associazioniQuery = `
      SELECT uc.utente_id, u.ruolo, uc.ruolo_specifico
      FROM UtentiCentri uc
      JOIN Utenti u ON uc.utente_id = u.id
      WHERE uc.centro_id = ?
    `;
    
    const associazioni = await db.all(associazioniQuery, [id]);
    const superAdmin = associazioni
      .filter(a => a.ruolo_specifico === 'SuperAdmin')
      .map(a => a.utente_id);
    
    logger.info(`Utente ${id}: trovato ${superAdmin.length} SuperAdmin e ${associazioni.length - superAdmin.length} altre associazioni`);
    
    // Rimuovi solo le associazioni degli operatori e amministratori normali, preservando il SuperAdmin
    const deleteOperatoriQuery = `
      DELETE FROM UtentiCentri
      WHERE centro_id = ? AND utente_id IN (
        SELECT uc.utente_id
        FROM UtentiCentri uc
        JOIN Utenti u ON uc.utente_id = u.id
        WHERE uc.centro_id = ? AND u.ruolo = 'Operatore'
      )
    `;
    
    const deleteAmministratoriQuery = `
      DELETE FROM UtentiCentri
      WHERE centro_id = ? AND utente_id IN (
        SELECT uc.utente_id
        FROM UtentiCentri uc
        JOIN Utenti u ON uc.utente_id = u.id
        WHERE uc.centro_id = ? AND u.ruolo = 'Amministratore' AND uc.ruolo_specifico IS NULL
      )
    `;
    
    // Esegui le query di eliminazione solo se l'utente è SuperAdmin
    if (isSuperAdmin) {
      await db.run(deleteOperatoriQuery, [id, id]);
      await db.run(deleteAmministratoriQuery, [id, id]);
    } else {
      // Se non è SuperAdmin, può gestire solo gli operatori
      await db.run(deleteOperatoriQuery, [id, id]);
    }
    
    // Verifica che tutti gli utenti esistano e associali all'utente
    const operatoriPromises = operatori_ids.map(async (utente_id) => {
      const utenteQuery = `SELECT * FROM Utenti WHERE id = ? AND ruolo = 'Operatore'`;
      const utente = await db.get(utenteQuery, [utente_id]);
      
      if (!utente) {
        logger.warn(`Utente ID ${utente_id} non trovato o non è un operatore, salto associazione`);
        return null;
      }
      
      // Crea la nuova associazione per l'operatore
      const insertQuery = `
        INSERT OR IGNORE INTO UtentiCentri (utente_id, centro_id)
        VALUES (?, ?)
      `;
      
      await db.run(insertQuery, [utente_id, id]);
      return utente_id;
    });
    
    // Se l'utente è SuperAdmin, può aggiungere anche amministratori
    let amministratoriPromises = [];
    if (isSuperAdmin && amministratori_ids.length > 0) {
      amministratoriPromises = amministratori_ids.map(async (utente_id) => {
        const utenteQuery = `SELECT * FROM Utenti WHERE id = ? AND ruolo = 'Amministratore'`;
        const utente = await db.get(utenteQuery, [utente_id]);
        
        if (!utente) {
          logger.warn(`Utente ID ${utente_id} non trovato o non è un amministratore, salto associazione`);
          return null;
        }
        
        // Non permettere di modificare il ruolo di SuperAdmin
        if (superAdmin.includes(Number(utente_id))) {
          logger.warn(`Utente ID ${utente_id} è già SuperAdmin, salto modifica`);
          return utente_id;
        }
        
        // Crea la nuova associazione per l'amministratore (senza ruolo_specifico)
        const insertQuery = `
          INSERT OR IGNORE INTO UtentiCentri (utente_id, centro_id)
          VALUES (?, ?)
        `;
        
        await db.run(insertQuery, [utente_id, id]);
        return utente_id;
      });
    }
    
    // Attendi il completamento di tutte le associazioni
    const operatoriAssociati = (await Promise.all(operatoriPromises)).filter(Boolean);
    const amministratoriAssociati = (await Promise.all(amministratoriPromises)).filter(Boolean);
    
    res.json({
      message: 'Utenti associati all\'utente con successo',
      utente_id: parseInt(id),
      operatori_ids: operatoriAssociati.map(id => parseInt(id)),
      amministratori_ids: amministratoriAssociati.map(id => parseInt(id)),
      failed_ids: []
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUtenti,
  getUtenteById,
  createUtente,
  updateUtente,
  deleteUtente,
  getUtentiTipi,
  getUtenteAttori,
  associaAttore,
  rimuoviAttore,
  getUtenteStatistiche,
  associaOperatori
};