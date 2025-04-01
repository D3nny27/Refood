const db = require('../config/database');
const ApiError = require('../middlewares/errorHandler').ApiError;
const logger = require('../utils/logger');
const websocket = require('../utils/websocket');
const notificheController = require('./notifiche.controller');

/**
 * Ottiene l'elenco dei lotti con filtri opzionali
 */
exports.getLotti = async (req, res, next) => {
  try {
    logger.info(`Richiesta GET /lotti ricevuta con query: ${JSON.stringify(req.query)}`);
    const { stato, scadenza_entro, mostraTutti } = req.query;
    
    // Utente autenticato
    const userId = req.user.id;
    const userRuolo = req.user.ruolo;
    const userTipoUtente = req.user.tipo_utente; // Leggiamo direttamente dal token JWT
    
    logger.debug(`Utente ${userId} con ruolo ${userRuolo}, tipo ${userTipoUtente} richiede lotti. mostraTutti=${mostraTutti}`);
    
    // Parametro mostraTutti per sovrascrivere i filtri per tipo utente
    const bypassFiltriTipoUtente = mostraTutti === 'true' || userRuolo === 'Amministratore' || userRuolo === 'Operatore';
    if (bypassFiltriTipoUtente) {
      logger.debug(`Filtri per tipo utente disabilitati - mostrando tutti i lotti (mostraTutti=${mostraTutti}, ruolo=${userRuolo})`);
    } else {
      logger.debug(`Filtri per tipo utente abilitati - mostrando solo i lotti per ${userTipoUtente}`);
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
    
    // Costruzione della query base
    let query = `
      SELECT l.*
      ${hasCategorieTable ? ', GROUP_CONCAT(cat.nome) as categorie' : ', NULL as categorie'}
      FROM Lotti l
      ${hasCategorieTable ? 'LEFT JOIN LottiCategorie lc ON l.id = lc.lotto_id' : ''}
      ${hasCategorieTable ? 'LEFT JOIN Categorie cat ON lc.categoria_id = cat.id' : ''}
    `;
    
    // Array per i parametri della query
    const params = [];
    
    // Aggiunta dei filtri
    const whereConditions = [];
    
    // Filtri standard basati sui parametri di query
    if (stato) {
      whereConditions.push('UPPER(l.stato) = UPPER(?)');
      params.push(stato);
    }
    
    if (scadenza_entro) {
      whereConditions.push('l.data_scadenza <= ?');
      params.push(scadenza_entro);
    }
    
    // Per gli utenti normali, escludi i lotti prenotati
    // Per admin e operatori, mostra tutti i lotti ma aggiungi info prenotazione
    let joinPrenotazioni = '';
    if (userRuolo === 'Amministratore' || userRuolo === 'Operatore') {
      // Per admin e operatori, facciamo un LEFT JOIN con le prenotazioni
      // per includere informazioni sulla prenotazione
      joinPrenotazioni = `
        LEFT JOIN (
          SELECT lotto_id, 'Prenotato' AS stato_prenotazione
          FROM Prenotazioni 
          WHERE UPPER(stato) IN ('PRENOTATO', 'INTRANSITO', 'CONFERMATO', 'PRONTOPERRITIRO')
        ) p ON l.id = p.lotto_id
      `;
      
      // Aggiungiamo il join alla query
      query = query.replace('FROM Lotti l', `FROM Lotti l ${joinPrenotazioni}`);
      
      // Modifichiamo il SELECT per includere stato_prenotazione
      query = query.replace('SELECT l.*', 'SELECT l.*, p.stato_prenotazione');
      
      // Escludiamo sempre i lotti con prenotazioni consegnate, anche per admin e operatori
      whereConditions.push(`
        l.id NOT IN (
          SELECT lotto_id FROM Prenotazioni 
          WHERE UPPER(stato) = 'CONSEGNATO'
        )
      `);
    } else {
      // Per utenti normali, filtra i lotti prenotati o consegnati
      whereConditions.push(`
        l.id NOT IN (
          SELECT lotto_id FROM Prenotazioni 
          WHERE UPPER(stato) IN ('PRENOTATO', 'INTRANSITO', 'CONFERMATO', 'PRONTOPERRITIRO', 'CONSEGNATO')
        )
      `);
    }
    
    // Filtro per ruolo utente e tipo utente (come in getLottiDisponibili)
    if (userRuolo === 'Utente' && !bypassFiltriTipoUtente) {
      const tipoUtenteUpper = userTipoUtente ? userTipoUtente.toUpperCase() : '';
      
      logger.debug(`Tipo utente normalizzato per filtro: "${tipoUtenteUpper}"`);
      
      if (tipoUtenteUpper === 'PRIVATO') {
        // Gli utenti privati vedono solo i lotti verdi
        whereConditions.push(`UPPER(l.stato) = 'VERDE'`);
        logger.debug('Utente privato: filtrando solo lotti verdi');
      } else if (tipoUtenteUpper === 'CANALE SOCIALE') {
        // I canali sociali vedono solo i lotti arancioni
        whereConditions.push(`UPPER(l.stato) = 'ARANCIONE'`);
        logger.debug('Canale sociale: filtrando solo lotti arancioni');
      } else if (tipoUtenteUpper === 'CENTRO RICICLO') {
        // I centri di riciclo vedono solo i lotti rossi
        whereConditions.push(`UPPER(l.stato) = 'ROSSO'`);
        logger.debug('Centro riciclo: filtrando solo lotti rossi');
      } else {
        logger.warn(`Tipo utente non riconosciuto o mancante: "${userTipoUtente}". Nessun lotto verrà mostrato.`);
        whereConditions.push(`1 = 0`); // nessun risultato
      }
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
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `;
    
    logger.debug(`Query di conteggio: ${countQuery}`);
    
    // Esecuzione della query di conteggio
    const countResult = await db.get(countQuery, params);
    const total = countResult?.total || 0;
    
    logger.debug(`Totale lotti: ${total}`);
    
    // Nessuna paginazione - rimuoviamo LIMIT e OFFSET
    logger.debug(`Query principale: ${query}`);
    logger.debug(`Parametri: ${JSON.stringify(params)}`);
    
    // Esecuzione della query principale
    const lotti = await db.all(query, params);
    
    logger.info(`Lotti recuperati: ${lotti.length}`);
    
    // Per admin e operatori, verifichiamo quali lotti sono prenotati
    if (userRuolo === 'Amministratore' || userRuolo === 'Operatore') {
      // Ottieni tutte le prenotazioni attive (escludendo quelle consegnate)
      const prenotazioniQuery = `
        SELECT lotto_id
        FROM Prenotazioni
        WHERE stato IN ('Prenotato', 'InTransito', 'Confermato', 'ProntoPerRitiro')
      `;
      
      const prenotazioni = await db.all(prenotazioniQuery);
      
      if (prenotazioni && prenotazioni.length > 0) {
        // Crea un set di IDs dei lotti prenotati per ricerca veloce
        const lottiPrenotatiIds = new Set(prenotazioni.map(p => p.lotto_id));
        logger.info(`Trovati ${lottiPrenotatiIds.size} lotti con prenotazioni attive`);
        
        // Aggiungi lo stato_prenotazione a ciascun lotto che ha prenotazioni
        lotti.forEach(lotto => {
          if (lottiPrenotatiIds.has(lotto.id)) {
            lotto.stato_prenotazione = 'Prenotato';
            logger.debug(`[FORZATO] Stato prenotazione per lotto ${lotto.id}`);
          }
        });
      }
    }
    
    // Formatta le categorie da stringa a array
    const formattedLotti = lotti.map(lotto => ({
      ...lotto,
      categorie: lotto.categorie ? lotto.categorie.split(',') : []
    }));
    
    const response = {
      lotti: formattedLotti,
      total: total
    };
    
    const filtroMsg = bypassFiltriTipoUtente ? 'tutti i lotti' : `lotti filtrati per tipo utente: ${userTipoUtente}`;
    logger.info(`Risposta inviata con ${formattedLotti.length} lotti (${filtroMsg})`);
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
    
    // Utente autenticato
    const userId = req.user.id;
    const userRuolo = req.user.ruolo;
    const userTipoUtente = req.user.tipo_utente;
    
    logger.debug(`Utente ${userId} con ruolo ${userRuolo}, tipo ${userTipoUtente} richiede dettagli lotto ${lottoId}`);
    
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
    let query;
    
    if (userRuolo === 'Amministratore' || userRuolo === 'Operatore') {
      // Per admin e operatori, includono info prenotazione
      query = `
        SELECT l.*
        ${hasCategorieTable ? ', GROUP_CONCAT(DISTINCT cat.nome) as categorie' : ', NULL as categorie'},
        p.stato_prenotazione
        FROM Lotti l
        ${hasCategorieTable ? 'LEFT JOIN LottiCategorie lc ON l.id = lc.lotto_id' : ''}
        ${hasCategorieTable ? 'LEFT JOIN Categorie cat ON lc.categoria_id = cat.id' : ''}
        LEFT JOIN (
          SELECT lotto_id, 'Prenotato' AS stato_prenotazione
          FROM Prenotazioni 
          WHERE UPPER(stato) IN ('PRENOTATO', 'INTRANSITO', 'CONFERMATO', 'PRONTOPERRITIRO')
        ) p ON l.id = p.lotto_id
        WHERE l.id = ?
        GROUP BY l.id
      `;
    } else {
      // Per utenti normali, filtra i lotti prenotati
      query = `
        SELECT l.*
        ${hasCategorieTable ? ', GROUP_CONCAT(DISTINCT cat.nome) as categorie' : ', NULL as categorie'}
        FROM Lotti l
        ${hasCategorieTable ? 'LEFT JOIN LottiCategorie lc ON l.id = lc.lotto_id' : ''}
        ${hasCategorieTable ? 'LEFT JOIN Categorie cat ON lc.categoria_id = cat.id' : ''}
        WHERE l.id = ?
        AND l.id NOT IN (
          SELECT lotto_id FROM Prenotazioni 
          WHERE UPPER(stato) IN ('PRENOTATO', 'INTRANSITO', 'CONFERMATO', 'PRONTOPERRITIRO', 'CONSEGNATO')
        )
        GROUP BY l.id
      `;
    }
    
    const lotto = await db.get(query, [lottoId]);
    
    if (!lotto) {
      logger.warn(`Lotto con ID ${lottoId} non trovato`);
      return next(new ApiError(404, 'Lotto non trovato'));
    }
    
    // Formatta le categorie da stringa a array
    lotto.categorie = lotto.categorie ? lotto.categorie.split(',') : [];
    
    // Per admin e operatori, verifica esplicitamente se il lotto è prenotato
    if (userRuolo === 'Amministratore' || userRuolo === 'Operatore') {
      // Controlla se ci sono prenotazioni attive per questo lotto
      const prenotazioniAttualiQuery = `
        SELECT COUNT(*) as count 
        FROM Prenotazioni 
        WHERE lotto_id = ? AND stato IN ('Prenotato', 'InTransito')
      `;
      
      const prenotazioniAttuali = await db.get(prenotazioniAttualiQuery, [lottoId]);
      
      if (prenotazioniAttuali && prenotazioniAttuali.count > 0) {
        // Se ci sono prenotazioni, aggiungi manualmente stato_prenotazione
        lotto.stato_prenotazione = 'Prenotato';
        logger.info(`[FORZATO] Stato prenotazione a "Prenotato" per lotto ${lottoId} perché ha ${prenotazioniAttuali.count} prenotazioni attive`);
      }
    }
    
    // Recupera le prenotazioni attive per questo lotto (per compatibilità)
    const prenotazioniQuery = `
      SELECT COUNT(*) as count
      FROM Prenotazioni
      WHERE lotto_id = ? AND stato = 'Attiva'
    `;
    
    const prenotazioniResult = await db.get(prenotazioniQuery, [lottoId]);
    lotto.prenotazioni_attive = prenotazioniResult?.count || 0;
    
    // Log dettagliato per debug
    logger.info(`[DEBUG] Lotto ${lottoId} pronto per risposta con i seguenti dati:`);
    logger.info(`[DEBUG] stato_prenotazione: ${lotto.stato_prenotazione || 'NON PRESENTE'}`);
    logger.info(`[DEBUG] Lotto completo: ${JSON.stringify(lotto)}`);
    
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
    
    // Verifica che l'attore sia autenticato e abbia un ID
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
      categorie_ids = [],
      prezzo = null
    } = req.body;
    
    if (!prodotto || !quantita || !unita_misura || !data_scadenza) {
      logger.error(`Dati mancanti per la creazione del lotto: ${JSON.stringify(req.body)}`);
      return next(new ApiError(400, 'Dati incompleti per la creazione del lotto'));
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
          stato, 
          inserito_da, 
          creato_il,
          prezzo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `;
      
      const insertParams = [
        prodotto,
        quantita,
        unita_misura,
        data_scadenza,
        giorni_permanenza,
        stato,
        req.user.id,
        prezzo
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
      
      // Crea notifiche per gli amministratori
      try {
        // Ottieni l'informazione sull'attore che ha creato il lotto
        const attore = await db.get(
          'SELECT nome, cognome FROM Attori WHERE id = ?', 
          [req.user.id]
        );
        
        const nomeOperatore = attore ? `${attore.nome} ${attore.cognome}` : 'Operatore';
        
        // Creiamo il titolo e il messaggio della notifica
        const titolo = 'Nuovo lotto creato';
        const messaggio = `L'operatore ${nomeOperatore} ha creato il lotto "${prodotto}" con ${quantita} ${unita_misura} e scadenza il ${data_scadenza}`;
        
        // Invia notifiche agli amministratori
        const notificaQuery = `
          INSERT INTO Notifiche (
            titolo,
            messaggio,
            tipo,
            priorita,
            destinatario_id,
            origine_id,
            letto,
            riferimento_id,
            riferimento_tipo,
            creato_il
          )
          SELECT 
            ?,
            ?,
            'Alert',
            'Media',
            u.id,
            ?,
            0,
            ?,
            'Lotto',
            datetime('now')
          FROM Attori u
          WHERE u.ruolo = 'Amministratore'
            AND u.id != ? -- Non inviare a se stessi
        `;
        
        const notificaResult = await db.run(
          notificaQuery, 
          [
            titolo,
            messaggio,
            req.user.id, // origine della notifica
            lottoId, // riferimento_id
            req.user.id // non inviare a se stessi
          ]
        );
        
        logger.info(`Notifiche create per gli amministratori per il nuovo lotto ${lottoId}`);
      } catch (notificaError) {
        logger.error(`Errore nella creazione delle notifiche per il lotto: ${notificaError.message}`);
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
 * Verifica se un attore ha accesso a un lotto
 * @param {object} user - Oggetto attore
 * @param {number} lottoId - ID del lotto
 * @returns {Promise<boolean>} true se l'attore ha accesso, false altrimenti
 */
async function checkLottoAccess(user, lottoId) {
  try {
    // Verifica se il lotto esiste
    const lotto = await db.get('SELECT id FROM Lotti WHERE id = ?', [lottoId]);
    
    if (!lotto) {
      logger.warn(`Lotto con ID ${lottoId} non trovato durante il controllo di accesso`);
      return false;
    }
    
    // Se l'attore è un admin, ha accesso a tutto
    if (user.ruolo === 'Admin' || user.ruolo === 'SuperAdmin' || user.ruolo === 'Amministratore' || user.ruolo === 'Operatore') {
      return true;
    }
    
    // Implementazione semplificata per il sistema centralizzato
    // Gli utenti con ruoli specifici possono vedere i lotti in base allo stato
    // ma gli amministratori e gli operatori possono vedere tutti i lotti
    
    return true; // Accesso consentito per impostazione predefinita
  } catch (error) {
    logger.error(`Errore nel controllo di accesso al lotto: ${error.message}`);
    return false;
  }
}

/**
 * Aggiorna un lotto esistente
 */
exports.updateLotto = async (req, res, next) => {
  try {
    const lottoId = req.params.id;
    
    // Recupera il lotto esistente
    const lotto = await db.get('SELECT * FROM Lotti WHERE id = ?', [lottoId]);
    
    if (!lotto) {
      return next(new ApiError(404, 'Lotto non trovato'));
    }
    
    // Aggiungiamo log dettagliati per debug
    logger.info(`Aggiornamento lotto ${lottoId}, payload completo: ${JSON.stringify(req.body)}`);
    logger.info(`Lotto prima dell'aggiornamento: ${JSON.stringify(lotto)}`);
    
    // Validazione dei dati
    const {
      prodotto,
      quantita,
      unita_misura,
      data_scadenza,
      giorni_permanenza,
      stato,
      categorie_ids,
      prezzo
    } = req.body;
    
    // Costruisci oggetto con i campi da aggiornare
    const updateFields = {};
    if (prodotto !== undefined) updateFields.prodotto = prodotto;
    if (quantita !== undefined) updateFields.quantita = quantita;
    if (unita_misura !== undefined) updateFields.unita_misura = unita_misura;
    if (data_scadenza !== undefined) updateFields.data_scadenza = data_scadenza;
    if (giorni_permanenza !== undefined) updateFields.giorni_permanenza = giorni_permanenza;
    if (stato !== undefined) updateFields.stato = stato;
    if (prezzo !== undefined) {
      updateFields.prezzo = prezzo;
      logger.info(`Campo prezzo presente nel payload: ${prezzo}`);
    } else {
      logger.info(`Campo prezzo non presente nel payload`);
    }
    
    // Log dei campi da aggiornare
    logger.info(`Campi da aggiornare: ${JSON.stringify(updateFields)}`);
    
    // Se non ci sono campi da aggiornare
    if (Object.keys(updateFields).length === 0 && !categorie_ids) {
      return res.status(400).json({
        status: 'error',
        message: 'Nessun campo da aggiornare'
      });
    }
    
    // Ricalcola lo stato se è stata modificata la data di scadenza e non è stato fornito uno stato esplicito
    if (data_scadenza !== undefined && stato === undefined) {
      logger.info(`Ricalcolo dello stato per nuova data di scadenza: ${data_scadenza}`);
      logger.info(`Data di scadenza precedente: ${lotto.data_scadenza}`);
      
      const oggi = new Date();
      logger.info(`Data di scadenza ricevuta: ${data_scadenza}, tipo: ${typeof data_scadenza}`);
      
      // Assicurati che la data di scadenza sia nel formato corretto (YYYY-MM-DD)
      let dataScadenza;
      try {
        dataScadenza = new Date(data_scadenza);
        logger.info(`Data di scadenza convertita: ${dataScadenza.toISOString()}, è valida: ${!isNaN(dataScadenza.getTime())}`);
      } catch (err) {
        logger.error(`Errore nella conversione della data di scadenza: ${err.message}`);
        dataScadenza = new Date(data_scadenza);
      }
      
      if (isNaN(dataScadenza.getTime())) {
        logger.error(`Data di scadenza non valida: ${data_scadenza}`);
        return next(new ApiError(400, 'Data di scadenza non valida'));
      }
      
      // Assicurati che la data di scadenza sia formattata in YYYY-MM-DD per il database
      // Questo è importante perché SQLite salva le date come testo, non come oggetti Date
      const dataScadenzaFormatted = dataScadenza.toISOString().split('T')[0];
      logger.info(`Data di scadenza formattata per DB: ${dataScadenzaFormatted}`);
      
      // Aggiorna il campo data_scadenza con il valore formattato
      updateFields.data_scadenza = dataScadenzaFormatted;
      
      const giorni = updateFields.giorni_permanenza !== undefined ? 
                     parseInt(updateFields.giorni_permanenza) : 
                     parseInt(lotto.giorni_permanenza);
      
      // Calcola la data limite in base ai giorni di permanenza
      const dataLimite = new Date(dataScadenza);
      dataLimite.setDate(dataLimite.getDate() - giorni);
      
      logger.info(`Data odierna: ${oggi.toISOString()}`);
      logger.info(`Data di scadenza: ${dataScadenza.toISOString()}`);
      logger.info(`Data limite: ${dataLimite.toISOString()}`);
      logger.info(`Giorni di permanenza: ${giorni}`);
      
      // Determina il nuovo stato
      let nuovoStato;
      if (dataScadenza <= oggi) {
        nuovoStato = 'Rosso';
      } else if (dataLimite <= oggi) {
        nuovoStato = 'Arancione';
      } else {
        nuovoStato = 'Verde';
      }
      
      updateFields.stato = nuovoStato;
      logger.info(`Stato del lotto ricalcolato dopo modifica della data di scadenza: ${updateFields.stato}`);
    }
    
    // Avvia transazione
    await db.exec('BEGIN TRANSACTION');
    
    try {
      // Aggiorna i campi del lotto
      if (Object.keys(updateFields).length > 0) {
        const setClauses = Object.keys(updateFields).map(field => `${field} = ?`).join(', ');
        const values = Object.values(updateFields);
        
        logger.info(`Aggiornamento lotto ${lottoId} con i seguenti campi: ${JSON.stringify(updateFields)}`);
        logger.info(`Query di aggiornamento: UPDATE Lotti SET ${setClauses} WHERE id = ?`);
        logger.info(`Parametri: ${[...values, lottoId].join(', ')}`);
        
        try {
          const result = await db.run(
            `UPDATE Lotti SET ${setClauses} WHERE id = ?`,
            [...values, lottoId]
          );
          
          logger.info(`Aggiornamento completato, righe modificate: ${result.changes}`);
          
          // Verifica esplicita se la data è stata aggiornata nel database
          if (updateFields.data_scadenza) {
            const lottoAggiornato = await db.get('SELECT data_scadenza FROM Lotti WHERE id = ?', [lottoId]);
            logger.info(`Verifica dell'aggiornamento della data: data precedente=${lotto.data_scadenza}, nuova data=${lottoAggiornato.data_scadenza}`);
          }
          
          // Verifica esplicita se il prezzo è stato aggiornato nel database
          if (updateFields.prezzo !== undefined) {
            const lottoAggiornato = await db.get('SELECT prezzo FROM Lotti WHERE id = ?', [lottoId]);
            logger.info(`Verifica dell'aggiornamento del prezzo: prezzo precedente=${lotto.prezzo}, nuovo prezzo=${lottoAggiornato.prezzo}`);
          }
        } catch (dbError) {
          logger.error(`Errore nell'aggiornamento del lotto nel DB: ${dbError.message}`);
          throw dbError;
        }
        
        // Notifica gli amministratori della modifica del lotto
        try {
          // Ottieni dettagli del lotto aggiornato
          const dettaglioLotto = await db.get(
            `SELECT l.*, u.nome AS operatore_nome, u.cognome AS operatore_cognome 
             FROM Lotti l
             LEFT JOIN Attori u ON l.inserito_da = u.id
             WHERE l.id = ?`,
            [lottoId]
          );
          
          if (dettaglioLotto) {
            const nomeOperatore = `${req.user.nome || ''} ${req.user.cognome || ''}`.trim() || 'Operatore';
            const tipoModifica = Object.keys(updateFields).join(', ');
            
            // Prepara messaggio di notifica
            const titolo = 'Lotto aggiornato';
            const messaggio = `L'operatore ${nomeOperatore} ha modificato il lotto "${dettaglioLotto.prodotto}" (${tipoModifica})`;
            
            // Inserisci nella tabella Notifiche
            const notificaQuery = `
              INSERT INTO Notifiche (
                titolo,
                messaggio,
                tipo,
                priorita,
                destinatario_id,
                origine_id,
                letto,
                riferimento_id,
                riferimento_tipo,
                creato_il
              )
              SELECT 
                ?,
                ?,
                'Alert',
                'Media',
                u.id,
                ?,
                0,
                ?,
                'Lotto',
                datetime('now')
              FROM Attori u
              WHERE u.ruolo = 'Amministratore'
                AND u.id != ? -- Non inviare a se stessi
            `;
            
            await db.run(
              notificaQuery, 
              [
                titolo,
                messaggio,
                req.user.id, // origine della notifica
                lottoId, // riferimento_id
                req.user.id // non inviare a se stessi
              ]
            );
            
            logger.info(`Notifiche create per gli amministratori per la modifica del lotto ${lottoId}`);
          }
        } catch (notificaError) {
          logger.error(`Errore nella creazione delle notifiche per la modifica del lotto: ${notificaError.message}`);
          // Continuiamo comunque, non è un errore fatale
        }
        
        // Aggiungi log di cambio stato se lo stato è cambiato
        if (updateFields.stato && updateFields.stato !== lotto.stato) {
          const dataOra = new Date().toISOString();
          await db.run(
            `INSERT INTO LogCambioStato (lotto_id, stato_precedente, stato_nuovo, cambiato_il, cambiato_da) 
             VALUES (?, ?, ?, datetime('now'), ?)`,
            [lottoId, lotto.stato, updateFields.stato, req.user.id]
          );
          
          // Notifica gli utenti interessati del cambio di stato
          await notificaAttoriCambioStato(lottoId, lotto.stato, updateFields.stato);
        }
      }
      
      // Aggiorna le categorie se fornite
      if (categorie_ids && Array.isArray(categorie_ids)) {
        try {
          // Verifica prima se la tabella Categorie esiste
          const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='Categorie'"
          );
          
          if (!tableExists) {
            logger.warn("La tabella 'Categorie' non esiste nel database, creazione saltata");
          } else {
            // Rimuovi le vecchie associazioni
            await db.run('DELETE FROM LottiCategorie WHERE lotto_id = ?', [lottoId]);
            
            // Aggiungi le nuove associazioni
            for (const categoriaId of categorie_ids) {
              await db.run(
                'INSERT INTO LottiCategorie (lotto_id, categoria_id) VALUES (?, ?)',
                [lottoId, categoriaId]
              );
            }
          }
        } catch (categorieError) {
          logger.error(`Errore nell'aggiornamento delle categorie: ${categorieError.message}`);
          // Continuiamo comunque, non è un errore fatale
        }
      }
      
      await db.exec('COMMIT');
      
      // Recupera il lotto aggiornato
      const lottoAggiornato = await db.get(
        `SELECT l.* FROM Lotti l WHERE l.id = ?`,
        [lottoId]
      );
      
      logger.info(`Lotto dopo aggiornamento: ${JSON.stringify(lottoAggiornato)}`);
      
      if (!lottoAggiornato) {
        logger.error(`Impossibile recuperare il lotto ${lottoId} dopo l'aggiornamento`);
        return next(new ApiError(500, 'Errore nel recupero del lotto aggiornato'));
      }
      
      // Recupera le categorie del lotto (con gestione errore)
      let categorie = [];
      try {
        // Verifica prima se la tabella Categorie esiste
        const tableExists = await db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='Categorie'"
        );
        
        if (tableExists) {
          categorie = await db.all(
            `SELECT c.id, c.nome
             FROM Categorie c
             JOIN LottiCategorie lc ON c.id = lc.categoria_id
             WHERE lc.lotto_id = ?`,
            [lottoId]
          );
        } else {
          logger.warn("La tabella 'Categorie' non esiste nel database, recupero saltato");
        }
      } catch (categorieError) {
        logger.error(`Errore nel recupero delle categorie: ${categorieError.message}`);
        categorie = []; // Assicuriamoci che sia un array vuoto in caso di errore
      }
      
      lottoAggiornato.categorie = categorie.map(c => c.nome || '');
      
      // Invia notifica di aggiornamento tramite WebSocket
      websocket.notificaAggiornamentoLotto(lottoAggiornato);
      
      res.json({
        status: 'success',
        message: 'Lotto aggiornato con successo',
        lotto: lottoAggiornato
      });
      
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error(`Errore nell'aggiornamento del lotto: ${error.message}`);
    next(new ApiError(500, 'Errore nell\'aggiornamento del lotto'));
  }
};

/**
 * Notifica gli utenti interessati del cambio di stato di un lotto
 * @param {number} lottoId - ID del lotto
 * @param {string} statoPrecedente - Stato precedente
 * @param {string} statoNuovo - Nuovo stato
 */
async function notificaAttoriCambioStato(lottoId, statoPrecedente, statoNuovo) {
  try {
    // Ottieni dettagli del lotto
    const lotto = await db.get(
      `SELECT prodotto, quantita, unita_misura FROM Lotti WHERE id = ?`,
      [lottoId]
    );
    
    if (!lotto) return;
    
    // Ottieni utenti interessati (amministratori e operatori)
    const utenti = await db.all(`
      SELECT DISTINCT u.id
      FROM Attori u
      WHERE u.ruolo IN ('Operatore', 'Amministratore')
    `);
    
    if (!utenti || utenti.length === 0) return;
    
    // Prepara il messaggio di notifica
    let tipo = 'CambioStato'; // Utilizza un valore consentito dal vincolo CHECK
    let titolo = `Aggiornamento stato lotto`;
    let messaggio = `Il lotto "${lotto.prodotto}" (${lotto.quantita} ${lotto.unita_misura}) è passato dallo stato ${statoPrecedente} allo stato ${statoNuovo}`;
    
    // Personalizza il titolo in base allo stato
    if (statoNuovo === 'Arancione') {
      titolo = `Lotto in scadenza`;
    } else if (statoNuovo === 'Rosso') {
      titolo = `Lotto scaduto`;
    }
    
    // Dati extra per il frontend
    const datiExtra = {
      lottoId,
      statoPrecedente,
      statoNuovo
    };
    
    // Invia notifiche a tutti gli utenti interessati
    const userIds = utenti.map(u => u.id);
    for (const userId of userIds) {
      await notificheController.creaNotifica(
        userId,
        tipo,
        titolo,
        messaggio,
        `/lotti/${lottoId}`,
        datiExtra
      );
    }
    
    // Ottieni prenotazioni attive per il lotto
    const prenotazioni = await db.all(`
      SELECT p.id, p.tipo_utente_ricevente_id
      FROM Prenotazioni p
      WHERE p.lotto_id = ? AND p.stato = 'Attiva'
    `, [lottoId]);
    
    // Notifica gli utenti con prenotazioni attive
    for (const prenotazione of prenotazioni) {
      // Invia notifiche a tutti gli utenti
      await notificheController.creaNotifica(
        null, // Invierà a tutti gli utenti
        'Prenotazione', // Utilizza un valore consentito dal vincolo CHECK
        `Aggiornamento prenotazione`,
        `Un lotto prenotato "${lotto.prodotto}" è passato allo stato ${statoNuovo}`,
        `/prenotazioni/${prenotazione.id}`,
        {
          ...datiExtra,
          prenotazioneId: prenotazione.id
        }
      );
    }
    
  } catch (error) {
    logger.error(`Errore nell'invio delle notifiche di cambio stato: ${error.message}`);
  }
}

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
    const { stato, raggio, lat, lng, mostraTutti } = req.query;
    
    // Utente autenticato
    const userId = req.user.id;
    const userRuolo = req.user.ruolo;
    const userTipoUtente = req.user.tipo_utente; // Leggiamo direttamente dal token JWT
    
    logger.debug(`Utente ${userId} con ruolo ${userRuolo}, tipo ${userTipoUtente} richiede lotti disponibili. mostraTutti=${mostraTutti}`);
    
    // Parametro mostraTutti per sovrascrivere i filtri per tipo utente
    const bypassFiltriTipoUtente = mostraTutti === 'true' || userRuolo === 'Amministratore' || userRuolo === 'Operatore';
    if (bypassFiltriTipoUtente) {
      logger.debug(`Filtri per tipo utente disabilitati - mostrando tutti i lotti disponibili (mostraTutti=${mostraTutti}, ruolo=${userRuolo})`);
    } else {
      logger.debug(`Filtri per tipo utente abilitati - mostrando solo i lotti per ${userTipoUtente}`);
    }
    
    // Usa direttamente il tipo utente dal token JWT, non facciamo più una query addizionale
    let tipoUtente = userTipoUtente;
    
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
      SELECT l.*
      ${hasCategorieTable ? ', GROUP_CONCAT(cat.nome) as categorie' : ', NULL as categorie'}
      FROM Lotti l
      ${hasCategorieTable ? 'LEFT JOIN LottiCategorie lc ON l.id = lc.lotto_id' : ''}
      ${hasCategorieTable ? 'LEFT JOIN Categorie cat ON lc.categoria_id = cat.id' : ''}
    `;
    
    // Array per i parametri
    const params = [];
    const whereConditions = [];
    
    // Per gli utenti normali, escludi i lotti prenotati
    // Per admin e operatori, mostra tutti i lotti ma aggiungi info prenotazione
    if (userRuolo === 'Amministratore' || userRuolo === 'Operatore') {
      // Per admin e operatori, facciamo un LEFT JOIN con le prenotazioni
      // per includere informazioni sulla prenotazione
      const joinPrenotazioni = `
        LEFT JOIN (
          SELECT lotto_id, 'Prenotato' AS stato_prenotazione
          FROM Prenotazioni 
          WHERE UPPER(stato) IN ('PRENOTATO', 'INTRANSITO', 'CONFERMATO', 'PRONTOPERRITIRO')
        ) p ON l.id = p.lotto_id
      `;
      
      // Aggiungiamo il join alla query
      query = query.replace('FROM Lotti l', `FROM Lotti l ${joinPrenotazioni}`);
      
      // Modifichiamo il SELECT per includere stato_prenotazione
      query = query.replace('SELECT l.*', 'SELECT l.*, p.stato_prenotazione');
      
      // Escludiamo sempre i lotti con prenotazioni consegnate, anche per admin e operatori
      whereConditions.push(`
        l.id NOT IN (
          SELECT lotto_id FROM Prenotazioni 
          WHERE UPPER(stato) = 'CONSEGNATO'
        )
      `);
    } else {
      // Per utenti normali, filtra i lotti prenotati o consegnati
      whereConditions.push(`
        l.id NOT IN (
          SELECT lotto_id FROM Prenotazioni 
          WHERE UPPER(stato) IN ('PRENOTATO', 'INTRANSITO', 'CONFERMATO', 'PRONTOPERRITIRO', 'CONSEGNATO')
        )
      `);
    }
    
    // Filtro per ruolo utente e tipo utente
    if (userRuolo === 'Utente' && !bypassFiltriTipoUtente) {
      const tipoUtenteUpper = tipoUtente ? tipoUtente.toUpperCase() : '';
      
      logger.debug(`Tipo utente normalizzato per filtro: "${tipoUtenteUpper}"`);
      
      if (tipoUtenteUpper === 'PRIVATO') {
        // Gli utenti privati vedono solo i lotti verdi
        whereConditions.push(`UPPER(l.stato) = 'VERDE'`);
        logger.debug('Utente privato: filtrando solo lotti verdi');
      } else if (tipoUtenteUpper === 'CANALE SOCIALE') {
        // I canali sociali vedono solo i lotti arancioni
        whereConditions.push(`UPPER(l.stato) = 'ARANCIONE'`);
        logger.debug('Canale sociale: filtrando solo lotti arancioni');
      } else if (tipoUtenteUpper === 'CENTRO RICICLO') {
        // I centri di riciclo vedono solo i lotti rossi
        whereConditions.push(`UPPER(l.stato) = 'ROSSO'`);
        logger.debug('Centro riciclo: filtrando solo lotti rossi');
      } else {
        logger.warn(`Tipo utente non riconosciuto o mancante: "${tipoUtente}". Nessun lotto verrà mostrato.`);
        whereConditions.push(`1 = 0`); // nessun risultato
      }
    }
    
    // Aggiunge le condizioni alla query
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Aggiunge il group by e l'ordinamento
    query += ` GROUP BY l.id `;
    
    // Personalizza l'ordinamento in base al ruolo
    if (userRuolo === 'Amministratore' || userRuolo === 'Operatore') {
      // Ordinamento standard per amministratori e operatori
      query += ` 
        ORDER BY l.data_scadenza ASC, 
                 CASE UPPER(l.stato) 
                   WHEN 'VERDE' THEN 1 
                   WHEN 'ARANCIONE' THEN 2 
                   WHEN 'ROSSO' THEN 3 
                   ELSE 4 
                 END
      `;
    } else {
      // Per gli altri utenti, ordinamento per data di scadenza
      query += ` ORDER BY l.data_scadenza ASC`;
    }
    
    // Query di conteggio
    const countQuery = `
      SELECT COUNT(DISTINCT l.id) as total
      FROM Lotti l
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `;
    
    logger.debug(`Query di conteggio: ${countQuery}`);
    logger.debug(`Parametri: ${JSON.stringify(params)}`);
    
    // Esecuzione della query di conteggio
    const countResult = await db.get(countQuery, params);
    const total = countResult?.total || 0;
    
    logger.debug(`Totale lotti disponibili: ${total}`);
    
    // Rimuoviamo la paginazione per visualizzare tutti i lotti
    logger.debug(`Query principale: ${query}`);
    
    // Esecuzione della query principale
    const lotti = await db.all(query, params);
    
    logger.info(`Lotti disponibili recuperati: ${lotti.length}`);
    
    // Per admin e operatori, verifichiamo quali lotti sono prenotati
    if (userRuolo === 'Amministratore' || userRuolo === 'Operatore') {
      // Ottieni tutte le prenotazioni attive (escludendo quelle consegnate)
      const prenotazioniQuery = `
        SELECT lotto_id
        FROM Prenotazioni
        WHERE stato IN ('Prenotato', 'InTransito', 'Confermato', 'ProntoPerRitiro')
      `;
      
      const prenotazioni = await db.all(prenotazioniQuery);
      
      if (prenotazioni && prenotazioni.length > 0) {
        // Crea un set di IDs dei lotti prenotati per ricerca veloce
        const lottiPrenotatiIds = new Set(prenotazioni.map(p => p.lotto_id));
        logger.info(`Trovati ${lottiPrenotatiIds.size} lotti con prenotazioni attive`);
        
        // Aggiungi lo stato_prenotazione a ciascun lotto che ha prenotazioni
        lotti.forEach(lotto => {
          if (lottiPrenotatiIds.has(lotto.id)) {
            lotto.stato_prenotazione = 'Prenotato';
            logger.debug(`[FORZATO] Stato prenotazione per lotto ${lotto.id}`);
          }
        });
      }
    }
    
    // Formatta le categorie da stringa a array
    const formattedLotti = lotti.map(lotto => ({
      ...lotto,
      categorie: lotto.categorie ? lotto.categorie.split(',') : []
    }));
    
    const response = {
      lotti: formattedLotti,
      total: total
    };
    
    res.json(response);
  } catch (err) {
    logger.error(`Errore nel recupero dei lotti disponibili: ${err.message}`);
    logger.error(err.stack);
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
    const lotto = await db.get('SELECT * FROM Lotti WHERE id = ?', [lottoId]);
    
    if (!lotto) {
      return next(new ApiError(404, 'Lotto non trovato'));
    }
    
    // Nel sistema centralizzato, non abbiamo più il concetto di "centro di origine"
    // Quindi forniamo informazioni sul sistema nel suo complesso
    
    // Per ora restituiamo un mock di queste informazioni
    const origini = {
      lotto: {
        id: lotto.id,
        prodotto: lotto.prodotto,
        quantita: lotto.quantita,
        unita_misura: lotto.unita_misura,
        data_scadenza: lotto.data_scadenza
      },
      sistema: {
        nome: "ReFood - Sistema Centralizzato",
        descrizione: "Piattaforma centralizzata per la gestione del recupero alimentare"
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
    const lotto = await db.get('SELECT * FROM Lotti WHERE id = ?', [lottoId]);
    
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
        unita_misura: lotto.unita_misura
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
 * DEPRECATA: Non più necessaria con la nuova logica centralizzata
 * Questa funzione inviava notifiche ai centri beneficiari quando un nuovo lotto era disponibile
 */
// async function notificaTipo_UtenteBeneficiari(lottoId, prodotto, tipo_utente_origine_id) {
//   // Funzione rimossa perché non più necessaria nel sistema centralizzato
// } 