const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const websocket = require('../utils/websocket');
const notificheController = require('./notifiche.controller');

/**
 * Ottiene l'elenco delle prenotazioni con filtri opzionali
 */
const getPrenotazioni = async (req, res, next) => {
  try {
    const { stato, centro, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Costruisci la query in base ai filtri
    let query = `
      SELECT 
        p.*,
        l.prodotto, l.quantita, l.unita_misura, l.data_scadenza,
        cr.tipo AS centro_ricevente_nome
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      JOIN Tipo_Utente cr ON p.tipo_utente_ricevente_id = cr.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Filtro per stato
    if (stato) {
      query += ' AND p.stato = ?';
      params.push(stato);
    }
    
    // Filtro per centro ricevente
    if (centro) {
      query += ' AND p.tipo_utente_ricevente_id = ?';
      params.push(centro);
    }
    
    // Per utenti con ruoli specifici, limita alle prenotazioni dei propri centri
    if (req.user.ruolo !== 'Amministratore') {
      const userTipo_UtenteQuery = `
        SELECT tipo_utente_id FROM AttoriTipoUtente WHERE attore_id = ?
      `;
      
      const userTipo_Utente = await db.all(userTipo_UtenteQuery, [req.user.id]);
      const centriIds = userTipo_Utente.map(row => row.tipo_utente_id);
      
      if (centriIds.length === 0) {
        // Se l'attore non è associato a nessun centro, non mostrare niente
        return res.json({
          data: [],
          pagination: {
            total: 0,
            pages: 0,
            page: parseInt(page),
            limit: parseInt(limit)
          }
        });
      }
      
      const placeholders = centriIds.map(() => '?').join(',');
      query += ` AND p.tipo_utente_ricevente_id IN (${placeholders})`;
      params.push(...centriIds);
    }
    
    // Query per conteggio totale
    const countQuery = `SELECT COUNT(*) AS total FROM (${query}) AS filtered`;
    
    // Aggiunge ordinamento e paginazione
    query += ' ORDER BY p.data_prenotazione DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    // Esegue entrambe le query
    const totalResult = await db.get(countQuery, params.slice(0, params.length - 2));
    const prenotazioni = await db.all(query, params);
    
    // Calcola informazioni di paginazione
    const total = totalResult.total;
    const pages = Math.ceil(total / limit);
    
    res.json({
      data: prenotazioni,
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
 * Ottiene i dettagli di una specifica prenotazione
 */
const getPrenotazioneById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Query principale per dati prenotazione
    const query = `
      SELECT 
        p.*,
        l.prodotto, l.quantita, l.unita_misura, l.data_scadenza, l.stato AS stato_lotto,
        cr.tipo AS centro_ricevente_nome, cr.indirizzo AS indirizzo_ricevente, cr.telefono AS telefono_ricevente,
        a.nome AS creatore_nome, a.cognome AS creatore_cognome
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      JOIN Tipo_Utente cr ON p.tipo_utente_ricevente_id = cr.id
      LEFT JOIN Attori a ON l.inserito_da = a.id
      WHERE p.id = ?
    `;
    
    const prenotazione = await db.get(query, [id]);
    
    if (!prenotazione) {
      throw new ApiError(404, 'Prenotazione non trovata');
    }
    
    // Verifica i permessi dell'attore
    if (req.user.ruolo !== 'Amministratore' && req.user.ruolo !== 'Operatore') {
      // Controlla se l'attore appartiene al centro ricevente
      const userTipo_UtenteQuery = `
        SELECT 1 FROM AttoriTipoUtente 
        WHERE attore_id = ? AND tipo_utente_id = ?
      `;
      
      const userCanAccess = await db.get(
        userTipo_UtenteQuery, 
        [req.user.id, prenotazione.tipo_utente_ricevente_id]
      );
      
      if (!userCanAccess) {
        throw new ApiError(403, 'Non hai i permessi per visualizzare questa prenotazione');
      }
    }
    
    // Query per ottenere informazioni sul trasporto
    const trasportoQuery = `
      SELECT * FROM Trasporti WHERE prenotazione_id = ?
    `;
    
    const trasporto = await db.get(trasportoQuery, [id]);
    
    // Unifica i risultati
    const result = {
      ...prenotazione,
      trasporto: trasporto || null
    };
    
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Invia notifiche push agli amministratori quando un lotto viene prenotato
 * @param {number} prenotazioneId - ID della prenotazione
 * @param {object} lotto - Dettagli del lotto prenotato
 * @param {object} centro - Dettagli del centro che ha effettuato la prenotazione
 * @param {string|null} data_ritiro - Data prevista per il ritiro (opzionale)
 * @param {string|null} note - Note aggiuntive (opzionale)
 */
async function notificaAmministratori(prenotazioneId, lotto, centro, data_ritiro, note) {
  try {
    // Recupera gli utenti amministratori e operatori del sistema centralizzato
    const utentiQuery = `
      SELECT 
        u.id, 
        u.nome, 
        u.cognome, 
        u.token_notifiche
      FROM Attori u
      WHERE (u.ruolo = 'Amministratore' OR u.ruolo = 'Operatore')
      AND u.token_notifiche IS NOT NULL
    `;
    
    const utenti = await db.all(utentiQuery);
    if (utenti.length === 0) {
      console.log('Nessun amministratore o operatore con token notifiche trovato nel sistema');
      return;
    }
    
    // Costruisci il messaggio dettagliato
    const titolo = 'Nuova prenotazione ricevuta';
    const messaggio = `Il lotto "${lotto.prodotto}" (${lotto.quantita} ${lotto.unita_misura}) è stato prenotato dal centro "${centro.tipo}". ${data_ritiro ? `Ritiro previsto: ${data_ritiro}` : 'Data ritiro non specificata'}.`;
    
    // Log per debug
    console.log(`Invio notifiche push a ${utenti.length} utenti per la prenotazione ${prenotazioneId}`);
    
    // Imposta le notifiche nel sistema (usato poi per le notifiche push)
    for (const utente of utenti) {
      try {
        await notificheController.creaNotifica(
          utente.id,
          'Prenotazione',
          titolo,
          messaggio,
          `/prenotazioni/${prenotazioneId}`,
          {
            prenotazioneId,
            lottoId: lotto.id,
            centroId: centro.id
          }
        );
      } catch (err) {
        console.error(`Errore nell'invio della notifica all'utente ${utente.id}: ${err.message}`);
      }
    }
    
    // Usa anche il WebSocket per notifiche real-time
    websocket.notificaNuovaPrenotazione({
      id: prenotazioneId,
      lotto_id: lotto.id,
      lotto_nome: lotto.prodotto,
      centro_id: centro.id,
      centro_nome: centro.tipo,
      data_ritiro: data_ritiro,
      data_prenotazione: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error(`Errore nella notifica amministratori: ${error.message}`);
    return false;
  }
}

/**
 * Crea una nuova prenotazione per un lotto
 */
const createPrenotazione = async (req, res, next) => {
  try {
    console.log("Creazione prenotazione richiesta", req.body);

    // Verifica che lotto_id sia presente e valido
    const { lotto_id, note, data_ritiro } = req.body;
    
    if (!lotto_id) {
      return next(new ApiError(400, 'ID lotto mancante o non valido'));
    }
    
    if (isNaN(Number(lotto_id)) || Number(lotto_id) <= 0) {
      return next(new ApiError(400, 'ID lotto deve essere un numero positivo'));
    }
    
    // Log dell'utente corrente per debug
    console.log('Utente che effettua la prenotazione:', {
      id: req.user.id,
      email: req.user.email,
      ruolo: req.user.ruolo,
      tipo_utente: req.user.tipo_utente
    });

    // Ottiene il tipo_utente_id dell'utente autenticato
    const userTipoUtenteQuery = `
      SELECT tipo_utente_id 
      FROM AttoriTipoUtente 
      WHERE attore_id = ?
    `;
    
    console.log(`Cerco tipo_utente per l'attore ID: ${req.user.id}`);
    const userTipoUtente = await db.get(userTipoUtenteQuery, [req.user.id]);
    
    console.log('Risultato query tipo utente:', userTipoUtente);
    
    if (!userTipoUtente || !userTipoUtente.tipo_utente_id) {
      return next(new ApiError(400, `L'utente con ID ${req.user.id} non è associato a nessun tipo utente`));
    }
    
    const tipo_utente_ricevente_id = userTipoUtente.tipo_utente_id;
    console.log(`Tipo utente trovato: ${tipo_utente_ricevente_id}`);
    
    // Verifica dell'esistenza del lotto
    const lottoQuery = `
      SELECT * FROM Lotti 
      WHERE id = ?
    `;
    
    console.log(`Cerco il lotto con ID: ${lotto_id}`);
    const lotto = await db.get(lottoQuery, [lotto_id]);
    
    if (!lotto) {
      return next(new ApiError(404, `Lotto con ID ${lotto_id} non trovato`));
    }
    
    console.log('Lotto trovato:', { id: lotto.id, prodotto: lotto.prodotto });

    // Verifica che il lotto non sia già prenotato
    const esistePrenotazioneQuery = `
      SELECT 1 FROM Prenotazioni
      WHERE lotto_id = ? AND stato NOT IN ('Annullato', 'Eliminato')
    `;
    
    const esistePrenotazione = await db.get(esistePrenotazioneQuery, [lotto_id]);

    if (esistePrenotazione) {
      return next(new ApiError(400, 'Questo lotto è già stato prenotato'));
    }

    // Manteniamo i log per tracciamento
    console.log(`Stato lotto: ${lotto.stato}, Ruolo utente: ${req.user.ruolo}, Tipo utente: ${req.user.tipo_utente || 'non specificato'}`);
    
    // Creazione della prenotazione
    const dataPrenotazione = new Date().toISOString();
    
    // Validazione della data di ritiro se presente
    let dataRitiroValidata = null;
    if (data_ritiro) {
      try {
        // Verifica che sia una data valida
        const dataRitiroObj = new Date(data_ritiro);
        dataRitiroValidata = dataRitiroObj.toISOString();
      } catch (err) {
        return next(new ApiError(400, 'Data di ritiro non valida. Usa il formato ISO 8601'));
      }
    }
    
    const insertQuery = `
      INSERT INTO Prenotazioni (
        lotto_id,
        tipo_utente_ricevente_id,
        data_prenotazione,
        data_ritiro,
        note,
        stato
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    console.log('Inserimento prenotazione con parametri:', {
      lotto_id,
      tipo_utente_ricevente_id,
      data_prenotazione: dataPrenotazione,
      data_ritiro: dataRitiroValidata,
      note: note || null
    });
    
    const result = await db.run(
      insertQuery, 
      [
        lotto_id,
        tipo_utente_ricevente_id,
        dataPrenotazione,
        dataRitiroValidata,
        note || null,
        'Prenotato'
      ]
    );
    
    const prenotazioneId = result.lastID;
    console.log(`Prenotazione creata con ID: ${prenotazioneId}`);

    // Ottieni il tipo_utente
    const tipoUtenteQuery = `SELECT * FROM Tipo_Utente WHERE id = ?`;
    const tipoUtente = await db.get(tipoUtenteQuery, [tipo_utente_ricevente_id]);
    
    // Invia notifiche push agli amministratori (asincrono, dopo la risposta)
    try {
      await notificaAmministratori(
        prenotazioneId, 
        lotto, 
        tipoUtente, 
        dataRitiroValidata, 
        note
      );
    } catch (notificaErr) {
      console.error(`Errore nell'invio delle notifiche: ${notificaErr.message}`);
      // Continuiamo comunque, la prenotazione è stata creata
    }
    
    // Ottieni i dettagli completi della prenotazione
    const prenotazioneQuery = `
      SELECT 
        p.*,
        l.prodotto, l.quantita, l.unita_misura, l.data_scadenza,
        tu.tipo AS tipo_utente_ricevente_nome
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      JOIN Tipo_Utente tu ON p.tipo_utente_ricevente_id = tu.id
      WHERE p.id = ?
    `;
    
    const prenotazioneAggiornata = await db.get(prenotazioneQuery, [prenotazioneId]);
    
    // Invia la risposta
    res.status(201).json({
      status: 'success',
      message: 'Prenotazione creata con successo',
      data: prenotazioneAggiornata
    });
  } catch (error) {
    console.error('Errore nella creazione della prenotazione:', error);
    next(error);
  }
};

/**
 * Aggiorna lo stato di una prenotazione esistente
 */
const updatePrenotazione = async (req, res, next) => {
  try {
    const prenotazioneId = req.params.id;
    const { stato } = req.body;
    
    // Verifica che la prenotazione esista
    const prenotazione = await db.get(
      `SELECT p.*, l.prodotto, l.tipo_utente_origine_id, c.tipo as centro_nome
       FROM Prenotazioni p
       JOIN Lotti l ON p.lotto_id = l.id
       JOIN Tipo_Utente c ON p.tipo_utente_destinazione_id = c.id
       WHERE p.id = ?`,
      [prenotazioneId]
    );
    
    if (!prenotazione) {
      return next(new ApiError(404, 'Prenotazione non trovata'));
    }
    
    // Verifica che lo stato sia valido
    const statiValidi = ['Attiva', 'Completata', 'Annullata'];
    if (!statiValidi.includes(stato)) {
      return next(new ApiError(400, 'Stato non valido. Stati consentiti: ' + statiValidi.join(', ')));
    }
    
    // Aggiorna lo stato della prenotazione
    await db.run(
      `UPDATE Prenotazioni 
       SET stato = ?, data_modifica = datetime('now') 
       WHERE id = ?`,
      [stato, prenotazioneId]
    );
    
    // Recupera la prenotazione aggiornata
    const prenotazioneAggiornata = await db.get(
      `SELECT p.*, l.prodotto, l.tipo_utente_origine_id, c.tipo as centro_nome
       FROM Prenotazioni p
       JOIN Lotti l ON p.lotto_id = l.id
       JOIN Tipo_Utente c ON p.tipo_utente_destinazione_id = c.id
       WHERE p.id = ?`,
      [prenotazioneId]
    );
    
    // Invia notifica di aggiornamento tramite WebSocket
    websocket.notificaAggiornamentoPrenotazione(prenotazioneAggiornata);
    
    // Prepara i destinatari per le notifiche
    const destinatariNotifica = new Set();
    
    // Se la prenotazione è stata completata o annullata, informa il centro di origine
    if (stato === 'Completata' || stato === 'Annullata') {
      // Ottieni gli operatori del centro di origine
      const operatoriOrigine = await db.all(
        `SELECT u.id
         FROM Attori u
         JOIN AttoriTipoUtente uc ON u.id = uc.attore_id
         WHERE uc.tipo_utente_id = ?`,
        [prenotazione.tipo_utente_origine_id]
      );
      
      // Aggiungi gli operatori ai destinatari
      operatoriOrigine.forEach(op => destinatariNotifica.add(op.id));
    }
    
    // Sempre notifica al centro di destinazione del cambio di stato
    // Ottieni gli operatori del centro di destinazione
    const operatoriDestinazione = await db.all(
      `SELECT u.id
       FROM Attori u
       JOIN AttoriTipoUtente uc ON u.id = uc.attore_id
       WHERE uc.tipo_utente_id = ?`,
      [prenotazione.tipo_utente_destinazione_id]
    );
    
    // Aggiungi gli operatori ai destinatari
    operatoriDestinazione.forEach(op => destinatariNotifica.add(op.id));
    
    // Escludi l'attore che ha effettuato l'aggiornamento
    destinatariNotifica.delete(req.user.id);
    
    // Invia notifiche a tutti i destinatari
    const tipoNotifica = stato === 'Completata' ? 'success' : (stato === 'Annullata' ? 'error' : 'info');
    const titoloNotifica = `Prenotazione ${stato.toLowerCase()}`;
    const messaggioNotifica = `La prenotazione per "${prenotazione.prodotto}" è stata ${stato.toLowerCase()}`;
    
    for (const userId of destinatariNotifica) {
      await notificheController.creaNotifica(
        userId,
        tipoNotifica,
        titoloNotifica,
        messaggioNotifica,
        `/prenotazioni/${prenotazioneId}`,
        {
          prenotazioneId,
          stato,
          statoPrec: prenotazione.stato
        }
      );
    }
    
    res.json({
      status: 'success',
      message: `Prenotazione aggiornata con successo: ${stato}`,
      prenotazione: prenotazioneAggiornata
    });
  } catch (error) {
    logger.error(`Errore nell'aggiornamento della prenotazione: ${error.message}`);
    next(new ApiError(500, 'Errore nell\'aggiornamento della prenotazione'));
  }
};

/**
 * Registra informazioni sul trasporto per una prenotazione
 */
const addTrasporto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      mezzo, 
      distanza_km, 
      emissioni_co2, 
      costo, 
      autista, 
      telefono_autista, 
      orario_partenza, 
      orario_arrivo 
    } = req.body;
    
    // Verifica che la prenotazione esista
    const prenotazioneQuery = `
      SELECT 
        p.*,
        l.tipo_utente_origine_id, l.prodotto
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      WHERE p.id = ?
    `;
    
    const prenotazione = await db.get(prenotazioneQuery, [id]);
    
    if (!prenotazione) {
      throw new ApiError(404, 'Prenotazione non trovata');
    }
    
    // Verifica che la prenotazione sia in uno stato valido per aggiungere il trasporto
    if (!['Prenotato', 'InTransito'].includes(prenotazione.stato)) {
      throw new ApiError(400, `Non è possibile aggiungere informazioni di trasporto per una prenotazione in stato ${prenotazione.stato}`);
    }
    
    // Verifica se esiste già un trasporto per questa prenotazione
    const trasportoEsistenteQuery = `SELECT id FROM Trasporti WHERE prenotazione_id = ?`;
    const trasportoEsistente = await db.get(trasportoEsistenteQuery, [id]);
    
    let result;
    
    if (trasportoEsistente) {
      // Aggiorna il trasporto esistente
      const updateQuery = `
        UPDATE Trasporti SET
          mezzo = ?,
          distanza_km = ?,
          emissioni_co2 = ?,
          costo = ?,
          autista = ?,
          telefono_autista = ?,
          orario_partenza = ?,
          orario_arrivo = ?,
          stato = ?
        WHERE prenotazione_id = ?
      `;
      
      await db.run(
        updateQuery, 
        [
          mezzo,
          distanza_km || null,
          emissioni_co2 || null,
          costo || null,
          autista || null,
          telefono_autista || null,
          orario_partenza || null,
          orario_arrivo || null,
          prenotazione.stato === 'Prenotato' ? 'Pianificato' : 'InCorso',
          id
        ]
      );
      
      result = { id: trasportoEsistente.id, updated: true };
    } else {
      // Crea un nuovo trasporto
      const insertQuery = `
        INSERT INTO Trasporti (
          prenotazione_id, mezzo, distanza_km, emissioni_co2, costo,
          autista, telefono_autista, orario_partenza, orario_arrivo, stato
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      result = await db.run(
        insertQuery, 
        [
          id,
          mezzo,
          distanza_km || null,
          emissioni_co2 || null,
          costo || null,
          autista || null,
          telefono_autista || null,
          orario_partenza || null,
          orario_arrivo || null,
          prenotazione.stato === 'Prenotato' ? 'Pianificato' : 'InCorso'
        ]
      );
    }
    
    // Se la prenotazione è in stato Prenotato, cambiala in InTransito
    if (prenotazione.stato === 'Prenotato') {
      await db.run(
        `UPDATE Prenotazioni SET stato = 'InTransito' WHERE id = ?`,
        [id]
      );
      
      // Crea notifica per il centro ricevente
      const notificaQuery = `
        INSERT INTO Notifiche (tipo, messaggio, destinatario_id, creato_il)
        SELECT 'Prenotazione', ?, u.id, CURRENT_TIMESTAMP
        FROM Attori u
        JOIN AttoriTipoUtente uc ON u.id = uc.attore_id
        WHERE uc.tipo_utente_id = ?
      `;
      
      await db.run(
        notificaQuery, 
        [
          `Il lotto "${prenotazione.prodotto}" è in transito verso il tuo centro`, 
          prenotazione.tipo_utente_ricevente_id
        ]
      );
    }
    
    // Ottieni i dettagli completi del trasporto
    const trasportoQuery = `
      SELECT t.*, p.stato AS stato_prenotazione 
      FROM Trasporti t
      JOIN Prenotazioni p ON t.prenotazione_id = p.id
      WHERE t.prenotazione_id = ?
    `;
    
    const trasporto = await db.get(trasportoQuery, [id]);
    
    res.json(trasporto);
  } catch (error) {
    next(error);
  }
};

/**
 * Annulla una prenotazione
 */
const cancelPrenotazione = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    
    // Verifica che la prenotazione esista
    const prenotazioneQuery = `
      SELECT 
        p.*,
        l.prodotto, l.tipo_utente_origine_id
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      WHERE p.id = ?
    `;
    
    const prenotazione = await db.get(prenotazioneQuery, [id]);
    
    if (!prenotazione) {
      throw new ApiError(404, 'Prenotazione non trovata');
    }
    
    // Verifica che la prenotazione non sia già stata consegnata o annullata
    if (['Consegnato', 'Annullato'].includes(prenotazione.stato)) {
      throw new ApiError(400, `Non è possibile annullare una prenotazione in stato ${prenotazione.stato}`);
    }
    
    // Aggiorna lo stato della prenotazione
    await db.run(
      `UPDATE Prenotazioni SET stato = 'Annullato', note = CASE WHEN note IS NULL THEN ? ELSE note || ' | Annullata: ' || ? END WHERE id = ?`,
      [motivo || 'Annullata dall\'attore', motivo || 'Annullata dall\'attore', id]
    );
    
    // Se esiste un trasporto, aggiorna anche lo stato del trasporto
    await db.run(
      `UPDATE Trasporti SET stato = 'Annullato' WHERE prenotazione_id = ?`,
      [id]
    );
    
    // Notifica entrambi i centri
    const notificaQuery = `
      INSERT INTO Notifiche (tipo, messaggio, destinatario_id, creato_il)
      SELECT 'Prenotazione', ?, u.id, CURRENT_TIMESTAMP
      FROM Attori u
      JOIN AttoriTipoUtente uc ON u.id = uc.attore_id
      WHERE uc.tipo_utente_id IN (?, ?)
    `;
    
    await db.run(
      notificaQuery, 
      [
        `La prenotazione per il lotto "${prenotazione.prodotto}" è stata annullata${motivo ? ': ' + motivo : ''}`, 
        prenotazione.tipo_utente_origine_id, 
        prenotazione.tipo_utente_ricevente_id
      ]
    );
    
    // Ottieni i dati aggiornati della prenotazione
    const updatedPrenotazione = await db.get(prenotazioneQuery, [id]);
    
    res.json(updatedPrenotazione);
  } catch (error) {
    next(error);
  }
};

/**
 * Ottiene le prenotazioni di un centro specifico
 */
const getPrenotazioniByTipoUtente = async (req, res, next) => {
  try {
    const { tipo_utente_id } = req.params;
    const { stato, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Verifica che il centro esista
    const centroQuery = `SELECT * FROM Tipo_Utente WHERE id = ?`;
    const centro = await db.get(centroQuery, [tipo_utente_id]);
    
    if (!centro) {
      throw new ApiError(404, 'TipoUtente non trovato');
    }
    
    // Costruisci la query in base ai filtri
    let query = `
      SELECT 
        p.*,
        l.prodotto, l.quantita, l.unita_misura, l.data_scadenza, l.stato AS stato_lotto,
        co.tipo AS centro_origine_nome,
        cr.tipo AS centro_ricevente_nome
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      JOIN Tipo_Utente co ON l.tipo_utente_origine_id = co.id
      JOIN Tipo_Utente cr ON p.tipo_utente_ricevente_id = cr.id
      WHERE (p.tipo_utente_ricevente_id = ? OR l.tipo_utente_origine_id = ?)
    `;
    
    const params = [tipo_utente_id, tipo_utente_id];
    
    // Filtro per stato
    if (stato) {
      query += ' AND p.stato = ?';
      params.push(stato);
    }
    
    // Query per conteggio totale
    const countQuery = `SELECT COUNT(*) AS total FROM (${query}) AS filtered`;
    
    // Aggiunge ordinamento e paginazione
    query += ' ORDER BY p.data_prenotazione DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    // Esegue entrambe le query
    const totalResult = await db.get(countQuery, params.slice(0, params.length - 2));
    const prenotazioni = await db.all(query, params);
    
    // Calcola informazioni di paginazione
    const total = totalResult.total;
    const pages = Math.ceil(total / limit);
    
    res.json({
      data: prenotazioni,
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
 * Accetta una prenotazione
 */
const accettaPrenotazione = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data_ritiro_prevista } = req.body;
    
    // Avvia una transazione
    await db.exec('BEGIN TRANSACTION');
    
    try {
      // Verifica che la prenotazione esista e sia in uno stato accettabile
      const prenotazioneQuery = `
        SELECT 
          p.*,
          l.prodotto, l.tipo_utente_origine_id,
          cr.tipo AS centro_ricevente_nome
        FROM Prenotazioni p
        JOIN Lotti l ON p.lotto_id = l.id
        JOIN Tipo_Utente cr ON p.tipo_utente_ricevente_id = cr.id
        WHERE p.id = ?
      `;
      
      const prenotazione = await db.get(prenotazioneQuery, [id]);
      
      if (!prenotazione) {
        throw new ApiError(404, 'Prenotazione non trovata');
      }
      
      // Verifica che l'attore abbia i permessi necessari (deve appartenere al centro origine)
      if (req.user.ruolo !== 'Amministratore') {
        const userTipo_UtenteQuery = `
          SELECT 1 FROM AttoriTipoUtente 
          WHERE attore_id = ? AND tipo_utente_id = ?
        `;
        
        const userCanAccess = await db.get(
          userTipo_UtenteQuery, 
          [req.user.id, prenotazione.tipo_utente_origine_id]
        );
        
        if (!userCanAccess) {
          throw new ApiError(403, 'Non hai i permessi per accettare questa prenotazione');
        }
      }
      
      // Verifica che la prenotazione sia in uno stato accettabile
      if (prenotazione.stato !== 'Prenotato' && prenotazione.stato !== 'InAttesa') {
        throw new ApiError(400, `Impossibile accettare la prenotazione nello stato ${prenotazione.stato}`);
      }
      
      // Aggiorna lo stato della prenotazione
      const updateQuery = `
        UPDATE Prenotazioni 
        SET stato = 'Confermato', data_ritiro = ?
        WHERE id = ?
      `;
      
      await db.run(updateQuery, [data_ritiro_prevista, id]);
      
      // Crea una notifica per il centro ricevente
      const notificaQuery = `
        INSERT INTO Notifiche (
          titolo,
          messaggio,
          tipo,
          priorita,
          destinatario_id,
          riferimento_id,
          riferimento_tipo,
          letto,
          creato_il
        )
        SELECT 
          'Prenotazione confermata',
          'La tua prenotazione per il lotto "' || ? || '" è stata confermata. ' || 
          'Data ritiro: ' || COALESCE(?, 'Da stabilire'), 
          'Prenotazione',
          'Alta',
          u.id,
          ?,
          'Prenotazione',
          0,
          CURRENT_TIMESTAMP
        FROM Attori u
        JOIN AttoriTipoUtente uc ON u.id = uc.attore_id
        WHERE uc.tipo_utente_id = ?
      `;
      
      await db.run(
        notificaQuery, 
        [
          prenotazione.prodotto,
          data_ritiro_prevista,
          id,
          prenotazione.tipo_utente_ricevente_id
        ]
      );
      
      // Ottieni i dettagli aggiornati della prenotazione
      const prenotazioneUpdatedQuery = `
        SELECT 
          p.*,
          l.prodotto, l.quantita, l.unita_misura, l.data_scadenza,
          co.tipo AS centro_origine_nome,
          cr.tipo AS centro_ricevente_nome
        FROM Prenotazioni p
        JOIN Lotti l ON p.lotto_id = l.id
        JOIN Tipo_Utente co ON l.tipo_utente_origine_id = co.id
        JOIN Tipo_Utente cr ON p.tipo_utente_ricevente_id = cr.id
        WHERE p.id = ?
      `;
      
      const prenotazioneUpdated = await db.get(prenotazioneUpdatedQuery, [id]);
      
      // Commit della transazione
      await db.exec('COMMIT');
      
      res.json({
        success: true,
        message: 'Prenotazione confermata con successo',
        prenotazione: prenotazioneUpdated
      });
    } catch (error) {
      // In caso di errore, annulla la transazione
      await db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Rifiuta una prenotazione
 */
const rifiutaPrenotazione = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    
    // Avvia una transazione
    await db.exec('BEGIN TRANSACTION');
    
    try {
      // Verifica che la prenotazione esista e sia in uno stato accettabile
      const prenotazioneQuery = `
        SELECT 
          p.*,
          l.prodotto, l.tipo_utente_origine_id,
          cr.tipo AS centro_ricevente_nome
        FROM Prenotazioni p
        JOIN Lotti l ON p.lotto_id = l.id
        JOIN Tipo_Utente cr ON p.tipo_utente_ricevente_id = cr.id
        WHERE p.id = ?
      `;
      
      const prenotazione = await db.get(prenotazioneQuery, [id]);
      
      if (!prenotazione) {
        throw new ApiError(404, 'Prenotazione non trovata');
      }
      
      // Verifica che l'attore abbia i permessi necessari (deve appartenere al centro origine)
      if (req.user.ruolo !== 'Amministratore') {
        const userTipo_UtenteQuery = `
          SELECT 1 FROM AttoriTipoUtente 
          WHERE attore_id = ? AND tipo_utente_id = ?
        `;
        
        const userCanAccess = await db.get(
          userTipo_UtenteQuery, 
          [req.user.id, prenotazione.tipo_utente_origine_id]
        );
        
        if (!userCanAccess) {
          throw new ApiError(403, 'Non hai i permessi per rifiutare questa prenotazione');
        }
      }
      
      // Verifica che la prenotazione sia in uno stato accettabile
      if (prenotazione.stato !== 'Prenotato' && prenotazione.stato !== 'InAttesa') {
        throw new ApiError(400, `Impossibile rifiutare la prenotazione nello stato ${prenotazione.stato}`);
      }
      
      // Aggiorna lo stato della prenotazione
      const updateQuery = `
        UPDATE Prenotazioni 
        SET stato = 'Rifiutato', note = COALESCE(note || '\n', '') || ?
        WHERE id = ?
      `;
      
      const motivoCompleto = `Prenotazione rifiutata. Motivo: ${motivo || 'Non specificato'}`;
      await db.run(updateQuery, [motivoCompleto, id]);
      
      // Crea una notifica per il centro ricevente
      const notificaQuery = `
        INSERT INTO Notifiche (
          titolo,
          messaggio,
          tipo,
          priorita,
          destinatario_id,
          riferimento_id,
          riferimento_tipo,
          letto,
          creato_il
        )
        SELECT 
          'Prenotazione rifiutata',
          'La tua prenotazione per il lotto "' || ? || '" è stata rifiutata. ' || 
          'Motivo: ' || COALESCE(?, 'Non specificato'), 
          'Prenotazione',
          'Alta',
          u.id,
          ?,
          'Prenotazione',
          0,
          CURRENT_TIMESTAMP
        FROM Attori u
        JOIN AttoriTipoUtente uc ON u.id = uc.attore_id
        WHERE uc.tipo_utente_id = ?
      `;
      
      await db.run(
        notificaQuery, 
        [
          prenotazione.prodotto,
          motivo || 'Non specificato',
          id,
          prenotazione.tipo_utente_ricevente_id
        ]
      );
      
      // Sblocca il lotto per renderlo nuovamente disponibile
      const updateLottoQuery = `
        UPDATE Lotti
        SET stato = 'Verde'
        WHERE id = ?
      `;
      
      await db.run(updateLottoQuery, [prenotazione.lotto_id]);
      
      // Ottieni i dettagli aggiornati della prenotazione
      const prenotazioneUpdatedQuery = `
        SELECT 
          p.*,
          l.prodotto, l.quantita, l.unita_misura, l.data_scadenza,
          co.tipo AS centro_origine_nome,
          cr.tipo AS centro_ricevente_nome
        FROM Prenotazioni p
        JOIN Lotti l ON p.lotto_id = l.id
        JOIN Tipo_Utente co ON l.tipo_utente_origine_id = co.id
        JOIN Tipo_Utente cr ON p.tipo_utente_ricevente_id = cr.id
        WHERE p.id = ?
      `;
      
      const prenotazioneUpdated = await db.get(prenotazioneUpdatedQuery, [id]);
      
      // Commit della transazione
      await db.exec('COMMIT');
      
      res.json({
        success: true,
        message: 'Prenotazione rifiutata con successo',
        prenotazione: prenotazioneUpdated
      });
    } catch (error) {
      // In caso di errore, annulla la transazione
      await db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// NUOVO CONTROLLER PER GESTIRE LE PRENOTAZIONI DUPLICATE
/**
 * Ripulisce le prenotazioni duplicate, mantenendo solo la più recente per ciascun lotto
 * Questa API dovrebbe essere chiamata solo dagli amministratori di sistema per correggere
 * il problema delle prenotazioni duplicate
 */
const cleanupDuplicatePrenotazioni = async (req, res, next) => {
  try {
    // Verifica che l'attore sia un amministratore
    if (req.user.ruolo !== 'Amministratore') {
      throw new ApiError(403, 'Questa operazione è riservata agli amministratori');
    }

    // Avvia una transazione per garantire l'integrità dei dati
    await db.exec('BEGIN TRANSACTION');

    try {
      // 1. Trova tutti i lotti con più di una prenotazione attiva
      const duplicatesQuery = `
        SELECT lotto_id, COUNT(*) as count
        FROM Prenotazioni
        WHERE stato IN ('Prenotato', 'InAttesa', 'Confermato', 'InTransito')
        GROUP BY lotto_id
        HAVING COUNT(*) > 1
      `;

      const duplicates = await db.all(duplicatesQuery);
      
      if (duplicates.length === 0) {
        await db.exec('ROLLBACK');
        return res.json({
          success: true,
          message: 'Nessuna prenotazione duplicata trovata',
          lottiProcessati: 0,
          prenotazioniAggiornate: 0
        });
      }

      logger.info(`Trovati ${duplicates.length} lotti con prenotazioni multiple attive`);
      
      let totalUpdated = 0;
      
      // 2. Per ogni lotto con prenotazioni duplicate, mantieni solo la più recente
      for (const dup of duplicates) {
        // Ottieni tutte le prenotazioni attive per questo lotto
        const prenotazioniQuery = `
          SELECT id, lotto_id, tipo_utente_ricevente_id, stato, data_prenotazione
          FROM Prenotazioni
          WHERE lotto_id = ? AND stato IN ('Prenotato', 'InAttesa', 'Confermato', 'InTransito')
          ORDER BY data_prenotazione DESC
        `;
        
        const prenotazioni = await db.all(prenotazioniQuery, [dup.lotto_id]);
        
        // Mantieni la prima (la più recente) e annulla le altre
        if (prenotazioni.length > 1) {
          const idsToUpdate = prenotazioni.slice(1).map(p => p.id);
          
          if (idsToUpdate.length > 0) {
            // Aggiorna lo stato delle prenotazioni più vecchie a "Annullato"
            const updateQuery = `
              UPDATE Prenotazioni
              SET stato = 'Annullato', note = COALESCE(note, '') || '\nAnnullata automaticamente durante la pulizia delle prenotazioni duplicate.'
              WHERE id IN (${idsToUpdate.map(() => '?').join(',')})
            `;
            
            const updateResult = await db.run(updateQuery, idsToUpdate);
            totalUpdated += updateResult.changes;
            
            logger.info(`Lotto ${dup.lotto_id}: ${idsToUpdate.length} prenotazioni duplicate annullate, mantenuta la prenotazione ID ${prenotazioni[0].id}`);
          }
        }
      }
      
      // Commit della transazione
      await db.exec('COMMIT');
      
      return res.json({
        success: true,
        message: `Pulizia completata con successo. ${totalUpdated} prenotazioni duplicate sono state annullate.`,
        lottiProcessati: duplicates.length,
        prenotazioniAggiornate: totalUpdated
      });
    } catch (error) {
      // In caso di errore, annulla la transazione
      await db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPrenotazioni,
  getPrenotazioneById,
  createPrenotazione,
  updatePrenotazione,
  addTrasporto,
  cancelPrenotazione,
  getPrenotazioniByTipoUtente,
  accettaPrenotazione,
  rifiutaPrenotazione,
  cleanupDuplicatePrenotazioni
}; 