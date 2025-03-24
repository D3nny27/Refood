const db = require('../config/database');
const ApiError = require('../middlewares/errorHandler').ApiError;
const logger = require('../utils/logger');

/**
 * Ottiene l'elenco dei lotti con filtri opzionali
 */
exports.getLotti = async (req, res, next) => {
  try {
    logger.info(`Richiesta GET /lotti ricevuta con query: ${JSON.stringify(req.query)}`);
    const { stato, centro, scadenza_entro, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Verifica se la tabella Categorie esiste
    let hasCategorieTable = false;
    try {
      const tableCheck = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='Categorie'");
      hasCategorieTable = !!tableCheck;
      logger.debug(`Verifica tabella Categorie: ${hasCategorieTable ? 'presente' : 'non presente'}`);
    } catch (tableErr) {
      logger.warn(`Errore nella verifica della tabella Categorie: ${tableErr.message}`);
    }
    
    // Costruzione della query base
    let query = `
      SELECT l.*, c.nome as centro_nome
      ${hasCategorieTable ? ', GROUP_CONCAT(cat.nome) as categorie' : ', NULL as categorie'}
      FROM Lotti l
      LEFT JOIN Centri c ON l.centro_origine_id = c.id
      ${hasCategorieTable ? 'LEFT JOIN LottiCategorie lc ON l.id = lc.lotto_id' : ''}
      ${hasCategorieTable ? 'LEFT JOIN Categorie cat ON lc.categoria_id = cat.id' : ''}
    `;
    
    // Array per i parametri della query
    const params = [];
    
    // Aggiunta dei filtri
    const whereConditions = [];
    
    if (stato) {
      whereConditions.push('l.stato = ?');
      params.push(stato);
    }
    
    if (centro) {
      whereConditions.push('l.centro_origine_id = ?');
      params.push(centro);
    }
    
    if (scadenza_entro) {
      whereConditions.push('l.data_scadenza <= ?');
      params.push(scadenza_entro);
    }
    
    // Aggiunta delle condizioni WHERE se presenti
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Aggiunta del GROUP BY per le categorie
    query += ' GROUP BY l.id';
    
    // Query per contare il totale dei risultati
    const countQuery = `
      SELECT COUNT(DISTINCT l.id) as total
      FROM Lotti l
      LEFT JOIN Centri c ON l.centro_origine_id = c.id
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `;
    
    logger.debug(`Query di conteggio: ${countQuery}`);
    
    // Esecuzione della query di conteggio
    const countResult = await db.get(countQuery, params);
    const total = countResult?.total || 0;
    
    logger.debug(`Totale lotti: ${total}`);
    
    // Aggiunta di paginazione alla query principale
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    logger.debug(`Query principale: ${query}`);
    logger.debug(`Parametri: ${JSON.stringify(params)}`);
    
    // Esecuzione della query principale
    const lotti = await db.all(query, params);
    
    logger.info(`Lotti recuperati: ${lotti.length}`);
    
    // Formatta le categorie da stringa a array
    const formattedLotti = lotti.map(lotto => ({
      ...lotto,
      categorie: lotto.categorie ? lotto.categorie.split(',') : []
    }));
    
    // Calcolo informazioni di paginazione
    const totalPages = Math.ceil(total / limit);
    
    const response = {
      lotti: formattedLotti,
      pagination: {
        total,
        pages: totalPages,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    };
    
    logger.info(`Risposta inviata con ${formattedLotti.length} lotti`);
    res.json(response);
  } catch (err) {
    logger.error(`Errore nel recupero dei lotti: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero dei lotti'));
  }
};

/**
 * Ottiene i dettagli di un singolo lotto per ID
 */
exports.getLottoById = async (req, res, next) => {
  try {
    const lottoId = req.params.id;
    logger.info(`Richiesta GET /lotti/${lottoId} ricevuta`);
    
    // Verifica se la tabella Categorie esiste
    let hasCategorieTable = false;
    try {
      const tableCheck = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='Categorie'");
      hasCategorieTable = !!tableCheck;
      logger.debug(`Verifica tabella Categorie: ${hasCategorieTable ? 'presente' : 'non presente'}`);
    } catch (tableErr) {
      logger.warn(`Errore nella verifica della tabella Categorie: ${tableErr.message}`);
    }
    
    // Query per i dettagli del lotto
    const query = `
      SELECT l.*, c.nome as centro_nome, c.indirizzo, c.latitudine, c.longitudine
      ${hasCategorieTable ? ', GROUP_CONCAT(DISTINCT cat.nome) as categorie' : ', NULL as categorie'}
      FROM Lotti l
      LEFT JOIN Centri c ON l.centro_origine_id = c.id
      ${hasCategorieTable ? 'LEFT JOIN LottiCategorie lc ON l.id = lc.lotto_id' : ''}
      ${hasCategorieTable ? 'LEFT JOIN Categorie cat ON lc.categoria_id = cat.id' : ''}
      WHERE l.id = ?
      GROUP BY l.id
    `;
    
    const lotto = await db.get(query, [lottoId]);
    
    if (!lotto) {
      logger.warn(`Lotto con ID ${lottoId} non trovato`);
      return next(new ApiError(404, 'Lotto non trovato'));
    }
    
    // Formatta le categorie da stringa a array
    lotto.categorie = lotto.categorie ? lotto.categorie.split(',') : [];
    
    // Recupera le prenotazioni attive per questo lotto
    const prenotazioniQuery = `
      SELECT COUNT(*) as count
      FROM Prenotazioni
      WHERE lotto_id = ? AND stato = 'Attiva'
    `;
    
    const prenotazioniResult = await db.get(prenotazioniQuery, [lottoId]);
    lotto.prenotazioni_attive = prenotazioniResult?.count || 0;
    
    logger.info(`Dettagli del lotto ${lottoId} inviati con successo`);
    res.json(lotto);
  } catch (err) {
    logger.error(`Errore nel recupero del lotto: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero del lotto'));
  }
};

/**
 * Crea un nuovo lotto
 */
exports.createLotto = async (req, res, next) => {
  try {
    // Debug request
    logger.info(`Richiesta POST /lotti ricevuta: ${JSON.stringify(req.body)}`);
    logger.info(`Utente richiedente: ${JSON.stringify(req.user)}`);
    
    // Verifica che l'utente sia autenticato e abbia un ID
    if (!req.user || !req.user.id) {
      logger.error('Utente non identificato nella richiesta');
      return next(new ApiError(401, 'Utente non identificato. Impossibile procedere.'));
    }
    
    // Validazione dei dati di input
    const {
      prodotto,
      quantita,
      unita_misura,
      data_scadenza,
      giorni_permanenza = 7,
      centro_origine_id,
      categorie_ids = []
    } = req.body;
    
    if (!prodotto || !quantita || !unita_misura || !data_scadenza || !centro_origine_id) {
      logger.error(`Dati mancanti per la creazione del lotto: ${JSON.stringify(req.body)}`);
      return next(new ApiError(400, 'Dati incompleti per la creazione del lotto'));
    }
    
    // Verifica che il centro esista prima di procedere
    try {
      const centroExists = await db.get('SELECT id FROM Centri WHERE id = ?', [centro_origine_id]);
      if (!centroExists) {
        logger.error(`Il centro con ID ${centro_origine_id} non esiste nel database`);
        return next(new ApiError(400, `Il centro con ID ${centro_origine_id} non esiste. Seleziona un centro valido.`));
      }
      logger.info(`Centro con ID ${centro_origine_id} verificato con successo`);
    } catch (centroError) {
      logger.error(`Errore nella verifica del centro: ${centroError.message}`);
      return next(new ApiError(500, `Errore nella verifica del centro: ${centroError.message}`));
    }
    
    // Avvia transazione
    await db.exec('BEGIN TRANSACTION');
    
    try {      
      // Determina lo stato iniziale in base alla data di scadenza
      const oggi = new Date();
      const dataScadenza = new Date(data_scadenza);
      const giorni = parseInt(giorni_permanenza);
      
      // Calcola la data limite in base ai giorni di permanenza
      const dataLimite = new Date(dataScadenza);
      dataLimite.setDate(dataLimite.getDate() - giorni);
      
      let stato = 'Verde';
      if (dataScadenza <= oggi) {
        stato = 'Rosso';
      } else if (dataLimite <= oggi) {
        stato = 'Arancione';
      }
      
      logger.info(`Stato calcolato per il lotto: ${stato}`);
      
      // Inserimento del lotto
      const insertQuery = `
        INSERT INTO Lotti (
          prodotto, 
          quantita, 
          unita_misura, 
          data_scadenza, 
          giorni_permanenza, 
          centro_origine_id, 
          stato, 
          inserito_da, 
          creato_il
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;
      
      const insertParams = [
        prodotto,
        quantita,
        unita_misura,
        data_scadenza,
        giorni_permanenza,
        centro_origine_id,
        stato,
        req.user.id
      ];
      
      logger.debug(`Query inserimento lotto: ${insertQuery}`);
      logger.debug(`Parametri: ${JSON.stringify(insertParams)}`);
      
      const result = await db.run(insertQuery, insertParams);
      
      const lottoId = result.lastID;
      logger.info(`Lotto inserito con ID: ${lottoId}`);
      
      // Verifica se la tabella LottiCategorie e Categorie esistono
      let hasCategorieTable = false;
      try {
        const tableCheck = await db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='Categorie'");
        const categorieTableCheck = await db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='LottiCategorie'");
        hasCategorieTable = !!tableCheck && !!categorieTableCheck;
      } catch (tableErr) {
        logger.warn(`Errore nella verifica della tabella Categorie: ${tableErr.message}`);
      }
      
      // Inserimento delle categorie se presenti e se le tabelle esistono
      if (hasCategorieTable && categorie_ids && categorie_ids.length > 0) {
        for (const catId of categorie_ids) {
          if (!catId) continue;
          
          // Verifica che la categoria esista
          const categoriaExists = await db.get('SELECT id FROM Categorie WHERE id = ?', [catId]);
          if (!categoriaExists) {
            logger.warn(`La categoria con ID ${catId} non esiste, la ignoro`);
            continue;
          }
          
          const insertCategoriaQuery = `
            INSERT INTO LottiCategorie (lotto_id, categoria_id)
            VALUES (?, ?)
          `;
          await db.run(insertCategoriaQuery, [lottoId, catId]);
        }
        logger.info(`Categorie inserite per il lotto: ${categorie_ids.join(', ')}`);
      } else if (categorie_ids && categorie_ids.length > 0) {
        logger.warn(`Le tabelle Categorie o LottiCategorie non esistono, impossibile associare categorie`);
      }
      
      // Verifica se la tabella LogCambioStato esiste
      let hasLogTable = false;
      try {
        const logTableCheck = await db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='LogCambioStato'");
        hasLogTable = !!logTableCheck;
      } catch (tableErr) {
        logger.warn(`Errore nella verifica della tabella LogCambioStato: ${tableErr.message}`);
      }
      
      // Registra il cambio di stato iniziale se la tabella esiste
      if (hasLogTable) {
        const logQuery = `
          INSERT INTO LogCambioStato (
            lotto_id, 
            stato_precedente, 
            stato_nuovo, 
            cambiato_il,
            cambiato_da
          ) VALUES (?, 'Nuovo', ?, datetime('now'), ?)
        `;
        
        await db.run(logQuery, [lottoId, stato, req.user.id]);
        logger.info(`Log di stato creato per il lotto ${lottoId}`);
      } else {
        logger.warn(`La tabella LogCambioStato non esiste, impossibile registrare il cambio di stato`);
      }
      
      // Crea notifiche per gli amministratori del centro
      try {
        // Ottieni l'informazione sull'utente che ha creato il lotto
        const utente = await db.get(
          'SELECT nome, cognome FROM Utenti WHERE id = ?', 
          [req.user.id]
        );
        
        const nomeOperatore = utente ? `${utente.nome} ${utente.cognome}` : 'Operatore';
        
        const notificaQuery = `
          INSERT INTO Notifiche (
            titolo,
            messaggio,
            tipo,
            priorita,
            destinatario_id,
            origine_id,
            letto,
            centro_id,
            creato_il
          )
          SELECT 
            'Nuovo lotto creato',
            'L''operatore ${nomeOperatore} ha creato il lotto "' || ? || '" con ' || ? || ' ' || ? || ' e scadenza il ' || ?',
            'Alert',
            'Media',
            u.id,
            ?,
            0,
            ?,
            datetime('now')
          FROM Utenti u
          JOIN UtentiCentri uc ON u.id = uc.utente_id
          WHERE uc.centro_id = ? 
            AND u.ruolo = 'Amministratore'
            AND u.id != ? -- Non inviare a se stessi
        `;
        
        const notificaResult = await db.run(
          notificaQuery, 
          [
            prodotto, 
            quantita, 
            unita_misura, 
            data_scadenza, 
            req.user.id, // origine della notifica
            centro_origine_id,
            centro_origine_id,
            req.user.id // non inviare a se stessi
          ]
        );
        
        logger.info(`Notifiche create per gli amministratori del centro ${centro_origine_id} per il nuovo lotto ${lottoId}`);
      } catch (notificaError) {
        logger.error(`Errore nella creazione delle notifiche per il lotto: ${notificaError.message}`);
        // Continuiamo comunque con il commit, non è un errore fatale
      }
      
      // Invia notifiche ai centri beneficiari
      try {
        // Chiamata alla nuova funzione per notificare i centri beneficiari
        await notificaCentriBeneficiari(lottoId, prodotto, centro_origine_id);
        logger.info(`Notifiche inviate ai centri beneficiari per il lotto ${lottoId}`);
      } catch (notificaError) {
        logger.error(`Errore nell'invio di notifiche ai centri beneficiari: ${notificaError.message}`);
        // Continuiamo comunque con il commit, non è un errore fatale
      }
      
      // Commit della transazione
      await db.exec('COMMIT');
      logger.info(`Transazione completata con successo per il lotto ${lottoId}`);
      
      // Recupera il lotto completo
      const nuovoLotto = await db.get('SELECT * FROM Lotti WHERE id = ?', [lottoId]);
      
      if (!nuovoLotto) {
        logger.error(`Il lotto ${lottoId} non è stato trovato dopo l'inserimento`);
        return next(new ApiError(500, 'Errore nel recupero del lotto appena creato'));
      }
      
      logger.info(`Lotto ${lottoId} creato con successo`);
      res.status(201).json({
        message: 'Lotto creato con successo',
        lotto: nuovoLotto
      });
    } catch (error) {
      // Rollback in caso di errore
      await db.exec('ROLLBACK');
      logger.error(`Errore durante la creazione del lotto: ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
      next(new ApiError(500, `Errore nella creazione del lotto: ${error.message}`));
    }
  } catch (err) {
    logger.error(`Errore generale nella creazione del lotto: ${err.message}`);
    logger.error(`Stack trace: ${err.stack}`);
    next(new ApiError(500, 'Errore nella creazione del lotto: ' + err.message));
  }
};

/**
 * Aggiorna un lotto esistente
 */
exports.updateLotto = async (req, res, next) => {
  try {
    logger.info(`Richiesta di aggiornamento lotto ID ${req.params.id} ricevuta`);
    
    // Inizia una transazione esplicita con SQLite
    try {
      await db.exec('BEGIN TRANSACTION');
      logger.info('Transazione iniziata con successo per aggiornamento lotto');
    } catch (transactionError) {
      logger.error(`Errore nell'iniziazione della transazione: ${transactionError.message}`);
      return next(new ApiError(500, `Errore di database nell'avvio della transazione: ${transactionError.message}`));
    }
    
    const lottoId = req.params.id;
    const {
      prodotto,
      quantita,
      unita_misura,
      data_scadenza,
      giorni_permanenza,
      stato,
      categorie_ids
    } = req.body;
    
    // Verifica se il lotto esiste
    const lottoEsistente = await db.get(
      'SELECT * FROM Lotti WHERE id = ?',
      [lottoId]
    );
    
    if (!lottoEsistente) {
      await db.exec('ROLLBACK');
      return next(new ApiError(404, 'Lotto non trovato'));
    }
    
    // Verifica se l'utente appartiene al centro che ha creato il lotto
    // o è un amministratore (l'appartenenza al centro è gestita nel middleware)
    
    // Costruzione SET della query di aggiornamento
    const updates = [];
    const params = [];
    
    if (prodotto !== undefined) {
      updates.push('prodotto = ?');
      params.push(prodotto);
    }
    
    if (quantita !== undefined) {
      updates.push('quantita = ?');
      params.push(quantita);
    }
    
    if (unita_misura !== undefined) {
      updates.push('unita_misura = ?');
      params.push(unita_misura);
    }
    
    if (data_scadenza !== undefined) {
      updates.push('data_scadenza = ?');
      params.push(data_scadenza);
    }
    
    if (giorni_permanenza !== undefined) {
      updates.push('giorni_permanenza = ?');
      params.push(giorni_permanenza);
    }
    
    // Gestione del cambio di stato
    if (stato !== undefined && stato !== lottoEsistente.stato) {
      updates.push('stato = ?');
      params.push(stato);
      
      // Registra il cambio di stato in LogCambioStato (non StatusChangeLog)
      try {
        const logQuery = `
          INSERT INTO LogCambioStato (
            lotto_id, 
            stato_precedente, 
            stato_nuovo, 
            cambiato_il,
            cambiato_da
          ) VALUES (?, ?, ?, datetime('now'), ?)
        `;
        
        await db.run(logQuery, [
          lottoId,
          lottoEsistente.stato,
          stato,
          req.user.id
        ]);
        logger.info(`Cambio di stato registrato con successo: ${lottoEsistente.stato} -> ${stato}`);
      } catch (logError) {
        logger.error(`Errore nella registrazione del cambio di stato: ${logError.message}`);
        await db.exec('ROLLBACK');
        return next(new ApiError(500, `Errore nella registrazione del cambio di stato: ${logError.message}`));
      }
    }
    
    // Aggiornamento del lotto
    if (updates.length > 0) {
      const updateQuery = `
        UPDATE Lotti
        SET ${updates.join(', ')}, aggiornato_il = datetime('now')
        WHERE id = ?
      `;
      
      params.push(lottoId);
      try {
        await db.run(updateQuery, params);
        logger.info(`Lotto ID ${lottoId} aggiornato con successo`);
        
        // Crea notifiche per gli amministratori del centro quando un lotto viene modificato
        try {
          // Prepara la descrizione delle modifiche
          let descrizioneModifiche = 'Modifiche: ';
          if (prodotto !== undefined) descrizioneModifiche += 'nome, ';
          if (quantita !== undefined) descrizioneModifiche += 'quantità, ';
          if (unita_misura !== undefined) descrizioneModifiche += 'unità di misura, ';
          if (data_scadenza !== undefined) descrizioneModifiche += 'data scadenza, ';
          if (stato !== undefined) descrizioneModifiche += 'stato, ';
          // Rimuovi l'ultima virgola e spazio
          descrizioneModifiche = descrizioneModifiche.replace(/, $/, '');
          
          // Ottieni i dettagli aggiornati del lotto
          const lottoAggiornato = await db.get(
            'SELECT prodotto, centro_origine_id FROM Lotti WHERE id = ?',
            [lottoId]
          );
          
          // Ottieni l'informazione sull'utente che ha modificato il lotto
          const utente = await db.get(
            'SELECT nome, cognome FROM Utenti WHERE id = ?', 
            [req.user.id]
          );
          
          const nomeOperatore = utente ? `${utente.nome} ${utente.cognome}` : 'Operatore';
          
          if (lottoAggiornato) {
            const notificaQuery = `
              INSERT INTO Notifiche (
                titolo,
                messaggio,
                tipo,
                priorita,
                destinatario_id,
                origine_id,
                letto,
                centro_id,
                creato_il
              )
              SELECT 
                'Lotto modificato',
                'L''operatore ${nomeOperatore} ha modificato il lotto "' || ? || '". ' || ?,
                'Alert',
                'Media',
                u.id,
                ?,
                0,
                ?,
                datetime('now')
              FROM Utenti u
              JOIN UtentiCentri uc ON u.id = uc.utente_id
              WHERE uc.centro_id = ? 
                AND u.ruolo = 'Amministratore'
                AND u.id != ? -- Non inviare a se stessi
            `;
            
            const notificaResult = await db.run(
              notificaQuery, 
              [
                lottoAggiornato.prodotto,
                descrizioneModifiche,
                req.user.id, // origine della notifica
                lottoAggiornato.centro_origine_id,
                lottoAggiornato.centro_origine_id,
                req.user.id // non inviare a se stessi
              ]
            );
            
            logger.info(`Notifiche create per gli amministratori del centro ${lottoAggiornato.centro_origine_id} per il lotto modificato ${lottoId}`);
          }
        } catch (notificaError) {
          logger.error(`Errore nella creazione delle notifiche per il lotto modificato: ${notificaError.message}`);
          // Continuiamo comunque con il commit, non è un errore fatale
        }
      } catch (updateError) {
        logger.error(`Errore nell'aggiornamento del lotto: ${updateError.message}`);
        await db.exec('ROLLBACK');
        return next(new ApiError(500, `Errore nell'aggiornamento del lotto: ${updateError.message}`));
      }
    }
    
    // Aggiornamento categorie se specificate
    if (categorie_ids !== undefined) {
      try {
        // Rimuovi tutte le categorie esistenti
        await db.run(
          'DELETE FROM LottiCategorie WHERE lotto_id = ?',
          [lottoId]
        );
        
        // Aggiungi le nuove categorie
        if (categorie_ids.length > 0) {
          for (const catId of categorie_ids) {
            await db.run(
              'INSERT INTO LottiCategorie (lotto_id, categoria_id) VALUES (?, ?)',
              [lottoId, catId]
            );
          }
        }
        logger.info(`Categorie aggiornate con successo per il lotto ID ${lottoId}`);
      } catch (categorieError) {
        logger.error(`Errore nell'aggiornamento delle categorie: ${categorieError.message}`);
        await db.exec('ROLLBACK');
        return next(new ApiError(500, `Errore nell'aggiornamento delle categorie: ${categorieError.message}`));
      }
    }
    
    try {
      // Commit della transazione
      await db.exec('COMMIT');
      logger.info(`Transazione completata con successo per l'aggiornamento del lotto ID ${lottoId}`);
    } catch (commitError) {
      logger.error(`Errore durante il commit della transazione: ${commitError.message}`);
      await db.exec('ROLLBACK');
      return next(new ApiError(500, `Errore nel completamento della transazione: ${commitError.message}`));
    }
    
    // Recupera il lotto aggiornato
    try {
      const lottoAggiornato = await db.get(
        'SELECT * FROM Lotti WHERE id = ?',
        [lottoId]
      );
      
      res.json(lottoAggiornato);
    } catch (getError) {
      logger.error(`Errore nel recupero del lotto aggiornato: ${getError.message}`);
      return next(new ApiError(500, `Errore nel recupero del lotto aggiornato: ${getError.message}`));
    }
  } catch (err) {
    // Rollback in caso di errore
    try {
      await db.exec('ROLLBACK');
      logger.error(`Transazione annullata a causa di un errore non gestito`);
    } catch (rollbackError) {
      logger.error(`Errore anche durante il rollback: ${rollbackError.message}`);
    }
    
    logger.error(`Errore generale nell'aggiornamento del lotto: ${err.message}`);
    logger.error(`Stack trace: ${err.stack}`);
    next(new ApiError(500, `Errore nell'aggiornamento del lotto: ${err.message}`));
  }
};

/**
 * Elimina un lotto
 */
exports.deleteLotto = async (req, res, next) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const lottoId = req.params.id;
    
    // Verifica se il lotto esiste
    const [lotto] = await connection.query(
      'SELECT * FROM Lotti WHERE id = ?',
      [lottoId]
    );
    
    if (!lotto) {
      return next(new ApiError(404, 'Lotto non trovato'));
    }
    
    // Verifica se ci sono prenotazioni attive per questo lotto
    const [prenotazioni] = await connection.query(
      'SELECT COUNT(*) as count FROM Prenotazioni WHERE lotto_id = ? AND stato = "Attiva"',
      [lottoId]
    );
    
    if (prenotazioni.count > 0) {
      return next(new ApiError(400, 'Impossibile eliminare un lotto con prenotazioni attive'));
    }
    
    // Elimina tutte le relazioni con le categorie
    await connection.query(
      'DELETE FROM LottiCategorie WHERE lotto_id = ?',
      [lottoId]
    );
    
    // Elimina tutti i log di stato
    await connection.query(
      'DELETE FROM StatusChangeLog WHERE lotto_id = ?',
      [lottoId]
    );
    
    // Elimina tutte le prenotazioni (già verificato che non ci sono attive)
    await connection.query(
      'DELETE FROM Prenotazioni WHERE lotto_id = ?',
      [lottoId]
    );
    
    // Elimina il lotto
    await connection.query(
      'DELETE FROM Lotti WHERE id = ?',
      [lottoId]
    );
    
    await connection.commit();
    
    res.json({ message: 'Lotto eliminato con successo', id: lottoId });
  } catch (err) {
    await connection.rollback();
    logger.error(`Errore nell'eliminazione del lotto: ${err.message}`);
    next(new ApiError(500, 'Errore nell\'eliminazione del lotto'));
  } finally {
    connection.release();
  }
};

/**
 * Ottiene lotti disponibili per prenotazione
 */
exports.getLottiDisponibili = async (req, res, next) => {
  try {
    logger.info(`Richiesta GET /lotti/disponibili ricevuta con query: ${JSON.stringify(req.query)}`);
    const { stato, raggio, lat, lng, centro_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Utente autenticato
    const userId = req.user.id;
    const userRuolo = req.user.ruolo;
    
    logger.debug(`Utente ${userId} con ruolo ${userRuolo} richiede lotti disponibili`);
    
    // Determina il tipo di centro dell'utente (se è associato a un centro)
    let tipoCentroUtente = null;
    let centriUtente = [];
    
    if (userRuolo === 'CentroSociale' || userRuolo === 'CentroRiciclaggio') {
      try {
        // Trova i centri dell'utente e il loro tipo
        const userCentriQuery = `
          SELECT c.id, c.tipo, c.nome 
          FROM Centri c
          JOIN UtentiCentri uc ON c.id = uc.centro_id
          WHERE uc.utente_id = ?
        `;
        
        centriUtente = await db.all(userCentriQuery, [userId]);
        
        if (centriUtente && centriUtente.length > 0) {
          // Prendi il tipo del primo centro come riferimento
          tipoCentroUtente = centriUtente[0].tipo;
          logger.debug(`Utente appartiene a centro di tipo: ${tipoCentroUtente}`);
        }
      } catch (err) {
        logger.error(`Errore nel recupero dei centri dell'utente: ${err.message}`);
      }
    }
    
    // Verifica se la tabella Categorie esiste
    let hasCategorieTable = false;
    try {
      const tableCheck = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='Categorie'");
      hasCategorieTable = !!tableCheck;
      logger.debug(`Verifica tabella Categorie: ${hasCategorieTable ? 'presente' : 'non presente'}`);
    } catch (tableErr) {
      logger.warn(`Errore nella verifica della tabella Categorie: ${tableErr.message}`);
    }
    
    // Query base
    let query = `
      SELECT l.*, c.nome as centro_nome, c.indirizzo,
             c.latitudine, c.longitudine
      ${hasCategorieTable ? ', GROUP_CONCAT(cat.nome) as categorie' : ', NULL as categorie'}
      FROM Lotti l
      LEFT JOIN Centri c ON l.centro_origine_id = c.id
      ${hasCategorieTable ? 'LEFT JOIN LottiCategorie lc ON l.id = lc.lotto_id' : ''}
      ${hasCategorieTable ? 'LEFT JOIN Categorie cat ON lc.categoria_id = cat.id' : ''}
    `;
    
    // Array per i parametri
    const params = [];
    const whereConditions = [];
    
    // Filtro base: lotti che non sono stati prenotati da nessun altro utente
    // Nota: utilizziamo UPPER() per fare un confronto case-insensitive
    whereConditions.push(`
      l.id NOT IN (
        SELECT lotto_id FROM Prenotazioni 
        WHERE UPPER(stato) IN ('PRENOTATO', 'INTRANSITO', 'CONSEGNATO')
      )
    `);
    
    // Non mostrare i lotti del proprio centro
    if (userRuolo !== 'Amministratore') {
      if (centriUtente && centriUtente.length > 0) {
        const centriIds = centriUtente.map(c => c.id);
        whereConditions.push(`l.centro_origine_id NOT IN (${centriIds.join(',')})`);
      }
    }
    
    // Filtra per tipo di centro beneficiario
    if (tipoCentroUtente === 'Sociale' || tipoCentroUtente === 'Riciclaggio') {
      // Prioritizza i lotti più adatti al tipo di centro
      if (tipoCentroUtente === 'Sociale') {
        // I centri sociali hanno priorità sui lotti più freschi (Verde e inizio Arancione)
        whereConditions.push(`l.stato IN ('Verde', 'Arancione')`);
      } else if (tipoCentroUtente === 'Riciclaggio') {
        // I centri di riciclaggio hanno priorità sui lotti in scadenza (Arancione avanzato e Rosso)
        // ma possono vedere anche quelli verdi
        // Non filtriamo per stato, ma cambieremo l'ordinamento per mostrare prima quelli più adatti
      }
    } else {
      // Filtro per stato
      if (stato) {
        whereConditions.push('l.stato = ?');
        params.push(stato);
      } else {
        // Se non specificato, mostra solo verdi e arancioni come default
        whereConditions.push(`l.stato IN ('Verde', 'Arancione')`);
      }
    }
    
    // Filtro per centro specifico
    if (centro_id) {
      whereConditions.push('l.centro_origine_id = ?');
      params.push(centro_id);
    }
    
    // Filtro geografico
    if (lat && lng && raggio) {
      // Calcolo della distanza usando la formula di Haversine
      whereConditions.push(`
        (6371 * acos(
          cos(radians(?)) * 
          cos(radians(c.latitudine)) * 
          cos(radians(c.longitudine) - radians(?)) + 
          sin(radians(?)) * 
          sin(radians(c.latitudine))
        )) <= ?
      `);
      params.push(lat, lng, lat, raggio);
    }
    
    // Aggiunge le condizioni alla query
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Aggiunge il group by e l'ordinamento
    query += ` GROUP BY l.id `;
    
    // Personalizza l'ordinamento in base al tipo di centro
    if (tipoCentroUtente === 'Sociale') {
      // I centri sociali vedono prima i lotti più freschi
      query += ` 
        ORDER BY 
          CASE l.stato 
            WHEN 'Verde' THEN 1 
            WHEN 'Arancione' THEN 2 
            WHEN 'Rosso' THEN 3 
            ELSE 4 
          END,
          l.data_scadenza DESC
      `;
    } else if (tipoCentroUtente === 'Riciclaggio') {
      // I centri di riciclaggio vedono prima i lotti in scadenza
      query += ` 
        ORDER BY 
          CASE l.stato 
            WHEN 'Rosso' THEN 1 
            WHEN 'Arancione' THEN 2 
            WHEN 'Verde' THEN 3 
            ELSE 4 
          END,
          l.data_scadenza ASC
      `;
    } else {
      // Ordinamento standard per altri utenti
      query += ` 
        ORDER BY l.data_scadenza ASC, 
                 CASE l.stato 
                   WHEN 'Verde' THEN 1 
                   WHEN 'Arancione' THEN 2 
                   WHEN 'Rosso' THEN 3 
                   ELSE 4 
                 END
      `;
    }
    
    // Query di conteggio
    const countQuery = `
      SELECT COUNT(DISTINCT l.id) as total
      FROM Lotti l
      LEFT JOIN Centri c ON l.centro_origine_id = c.id
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `;
    
    logger.debug(`Query di conteggio: ${countQuery}`);
    logger.debug(`Parametri: ${JSON.stringify(params)}`);
    
    // Esecuzione della query di conteggio
    const countResult = await db.get(countQuery, params);
    const total = countResult ? countResult.total : 0;
    
    logger.debug(`Totale lotti disponibili: ${total}`);
    
    // Aggiunta della paginazione
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    logger.debug(`Query principale: ${query}`);
    
    // Esecuzione della query principale
    const lotti = await db.all(query, params);
    
    // Formatta le categorie da stringa a array
    const formattedLotti = lotti.map(lotto => ({
      ...lotto,
      categorie: lotto.categorie ? lotto.categorie.split(',') : []
    }));
    
    logger.info(`Lotti disponibili recuperati: ${formattedLotti.length}`);
    
    // Calcolo informazioni di paginazione
    const totalPages = Math.ceil(total / limit);
    
    // Preparazione della risposta
    const response = {
      lotti: formattedLotti,
      pagination: {
        total,
        pages: totalPages,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    };
    
    res.json(response);
  } catch (err) {
    logger.error(`Errore nel recupero dei lotti disponibili: ${err.message}`);
    logger.error(`Stack trace: ${err.stack}`);
    next(new ApiError(500, 'Errore nel recupero dei lotti disponibili'));
  }
};

/**
 * Ottiene informazioni sulla filiera di origine di un lotto
 */
exports.getOriginiLotto = async (req, res, next) => {
  try {
    const lottoId = req.params.id;
    
    // Verifica se il lotto esiste
    const [lotto] = await db.query(
      'SELECT * FROM Lotti WHERE id = ?',
      [lottoId]
    );
    
    if (!lotto) {
      return next(new ApiError(404, 'Lotto non trovato'));
    }
    
    // Ottieni informazioni sul centro di origine
    const [centro] = await db.query(`
      SELECT c.*, 
             cs.descrizione as tipo_descrizione
      FROM Centri c
      JOIN CentriTipi cs ON c.tipo_id = cs.id
      WHERE c.id = ?
    `, [lotto.centro_origine_id]);
    
    if (!centro) {
      return next(new ApiError(404, 'Centro di origine non trovato'));
    }
    
    // Ottieni informazioni sui prodotti e sulla filiera
    // Qui andrebbe integrata una logica per recuperare dati esterni sulla filiera
    // Ad esempio da una blockchain o da un sistema di tracciabilità
    
    // Per ora restituiamo un mock di queste informazioni
    const origini = {
      lotto: {
        id: lotto.id,
        prodotto: lotto.prodotto,
        quantita: lotto.quantita,
        unita_misura: lotto.unita_misura,
        data_scadenza: lotto.data_scadenza
      },
      centro_origine: {
        id: centro.id,
        nome: centro.nome,
        indirizzo: centro.indirizzo,
        tipo: centro.tipo_descrizione
      },
      filiera: {
        provenienza: "Produzione locale",
        metodo_produzione: "Agricoltura convenzionale",
        distanza_percorsa: "25 km",
        certificazioni: ["HACCP"]
      }
    };
    
    res.json(origini);
  } catch (err) {
    logger.error(`Errore nel recupero delle origini del lotto: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero delle origini del lotto'));
  }
};

/**
 * Ottiene informazioni sull'impatto ambientale ed economico di un lotto
 */
exports.getImpattoLotto = async (req, res, next) => {
  try {
    const lottoId = req.params.id;
    
    // Verifica se il lotto esiste
    const [lotto] = await db.query(
      'SELECT l.*, c.nome as centro_nome FROM Lotti l JOIN Centri c ON l.centro_origine_id = c.id WHERE l.id = ?',
      [lottoId]
    );
    
    if (!lotto) {
      return next(new ApiError(404, 'Lotto non trovato'));
    }
    
    // Qui andrebbe integrata una logica per calcolare l'impatto ambientale
    // basata su modelli specifici per prodotto e quantità
    
    // Mock dei dati di impatto
    let impatto = {};
    
    // Calcola impatto in base al tipo di prodotto
    if (lotto.prodotto.toLowerCase().includes('frutta') || lotto.prodotto.toLowerCase().includes('verdura')) {
      // Valori medi per frutta/verdura
      impatto = {
        ambientale: {
          co2_risparmiata: (lotto.quantita * 2.5).toFixed(2), // kg CO2 per kg di prodotto
          acqua_risparmiata: (lotto.quantita * 200).toFixed(2), // litri per kg di prodotto
          terreno_risparmiato: (lotto.quantita * 0.3).toFixed(2), // m² per kg di prodotto
        },
        economico: {
          valore_prodotto: (lotto.quantita * 2).toFixed(2), // € per kg di prodotto
          costi_smaltimento_evitati: (lotto.quantita * 0.15).toFixed(2), // € per kg di prodotto
          beneficio_sociale: "Alto"
        }
      };
    } else if (lotto.prodotto.toLowerCase().includes('pane') || lotto.prodotto.toLowerCase().includes('cereali')) {
      // Valori medi per pane/cereali
      impatto = {
        ambientale: {
          co2_risparmiata: (lotto.quantita * 1.8).toFixed(2),
          acqua_risparmiata: (lotto.quantita * 1300).toFixed(2),
          terreno_risparmiato: (lotto.quantita * 1.1).toFixed(2),
        },
        economico: {
          valore_prodotto: (lotto.quantita * 3).toFixed(2),
          costi_smaltimento_evitati: (lotto.quantita * 0.1).toFixed(2),
          beneficio_sociale: "Medio"
        }
      };
    } else {
      // Valori medi generici
      impatto = {
        ambientale: {
          co2_risparmiata: (lotto.quantita * 2.0).toFixed(2),
          acqua_risparmiata: (lotto.quantita * 500).toFixed(2),
          terreno_risparmiato: (lotto.quantita * 0.5).toFixed(2),
        },
        economico: {
          valore_prodotto: (lotto.quantita * 2.5).toFixed(2),
          costi_smaltimento_evitati: (lotto.quantita * 0.12).toFixed(2),
          beneficio_sociale: "Medio-Alto"
        }
      };
    }
    
    // Aggiungi informazioni sul lotto
    const risultato = {
      lotto: {
        id: lotto.id,
        prodotto: lotto.prodotto,
        quantita: lotto.quantita,
        unita_misura: lotto.unita_misura,
        centro_origine: lotto.centro_nome
      },
      impatto: impatto
    };
    
    res.json(risultato);
  } catch (err) {
    logger.error(`Errore nel calcolo dell'impatto del lotto: ${err.message}`);
    next(new ApiError(500, 'Errore nel calcolo dell\'impatto del lotto'));
  }
};

/**
 * Ottiene l'elenco dei centri disponibili per l'utente corrente
 */
exports.getCentriDisponibili = async (req, res, next) => {
  try {
    logger.info('Richiesta GET /lotti/centri ricevuta');
    
    // Verifica se l'utente è autenticato
    if (!req.user || !req.user.id) {
      logger.error('Utente non identificato nella richiesta');
      return next(new ApiError(401, 'Utente non identificato. Impossibile procedere.'));
    }
    
    const userId = req.user.id;
    const userRuolo = req.user.ruolo;
    
    let query = '';
    let params = [];
    
    // Gli amministratori vedono tutti i centri
    if (userRuolo === 'Amministratore') {
      query = `
        SELECT id, nome, indirizzo, tipo, tipo_id, latitudine, longitudine, telefono, email
        FROM Centri
        ORDER BY nome
      `;
    } else {
      // Gli altri utenti vedono solo i centri a cui sono associati
      query = `
        SELECT c.id, c.nome, c.indirizzo, c.tipo, c.tipo_id, c.latitudine, c.longitudine, c.telefono, c.email
        FROM Centri c
        JOIN UtentiCentri uc ON c.id = uc.centro_id
        WHERE uc.utente_id = ?
        ORDER BY c.nome
      `;
      params = [userId];
    }
    
    // Verifica se la tabella Centri esiste
    try {
      const tableCheck = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='Centri'");
      
      if (!tableCheck) {
        logger.warn('La tabella Centri non esiste nel database');
        return next(new ApiError(500, 'La tabella Centri non esiste nel database'));
      }
    } catch (tableErr) {
      logger.error(`Errore nella verifica della tabella Centri: ${tableErr.message}`);
      return next(new ApiError(500, `Errore nella verifica della tabella Centri: ${tableErr.message}`));
    }
    
    // Esegue la query
    try {
      const centri = await db.all(query, params);
      
      logger.info(`Recuperati ${centri.length} centri per l'utente ${userId}`);
      
      // Se non ci sono centri disponibili
      if (centri.length === 0) {
        if (userRuolo !== 'Amministratore') {
          logger.warn(`L'utente ${userId} non è associato a nessun centro`);
          return res.json({
            message: 'Non sei associato a nessun centro. Contatta l\'amministratore.',
            centri: []
          });
        }
      }
      
      return res.json({
        centri,
        count: centri.length
      });
    } catch (queryErr) {
      logger.error(`Errore nel recupero dei centri: ${queryErr.message}`);
      return next(new ApiError(500, `Errore nel recupero dei centri: ${queryErr.message}`));
    }
  } catch (err) {
    logger.error(`Errore generale nel recupero dei centri: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero dei centri disponibili'));
  }
};

/**
 * Invia notifiche ai centri beneficiari (Centro di Riciclaggio e Centro Sociale) 
 * quando un nuovo lotto è disponibile
 * @param {number} lottoId - ID del lotto creato
 * @param {string} prodotto - Nome del prodotto
 * @param {number} centro_origine_id - ID del centro di origine
 */
async function notificaCentriBeneficiari(lottoId, prodotto, centro_origine_id) {
  try {
    // Ottieni il nome del centro di origine
    const centro = await db.get(
      'SELECT nome FROM Centri WHERE id = ?',
      [centro_origine_id]
    );
    
    const nomeCentro = centro ? centro.nome : 'Centro sconosciuto';
    
    // Invia notifiche agli utenti dei centri beneficiari
    const notificaQuery = `
      INSERT INTO Notifiche (
        titolo,
        messaggio,
        tipo,
        priorita,
        destinatario_id,
        riferimento_id,
        riferimento_tipo,
        origine_id,
        centro_id,
        letto,
        creato_il
      )
      SELECT 
        'Nuovo lotto disponibile',
        'Il centro "${nomeCentro}" ha reso disponibile un nuovo lotto di "${prodotto}" che puoi prenotare',
        'LottoCreato',
        'Media',
        u.id,
        ?,
        'Lotto',
        NULL,
        c.id,
        0,
        datetime('now')
      FROM Utenti u
      JOIN UtentiCentri uc ON u.id = uc.utente_id
      JOIN Centri c ON uc.centro_id = c.id
      WHERE c.tipo IN ('Riciclaggio', 'Sociale')
        AND c.id != ?
    `;
    
    await db.run(
      notificaQuery, 
      [
        lottoId,  // riferimento_id
        centro_origine_id // non inviare al centro di origine
      ]
    );
    
    logger.info(`Notifiche inviate ai centri beneficiari per il lotto ${lottoId}`);
    return true;
  } catch (error) {
    logger.error(`Errore nell'invio delle notifiche ai centri beneficiari: ${error.message}`);
    throw error;
  }
} 