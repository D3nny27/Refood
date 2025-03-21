const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

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
        co.nome AS centro_origine_nome,
        cr.nome AS centro_ricevente_nome
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      JOIN Centri co ON l.centro_origine_id = co.id
      JOIN Centri cr ON p.centro_ricevente_id = cr.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Filtro per stato
    if (stato) {
      query += ' AND p.stato = ?';
      params.push(stato);
    }
    
    // Filtro per centro
    if (centro) {
      query += ' AND (p.centro_ricevente_id = ? OR l.centro_origine_id = ?)';
      params.push(centro, centro);
    }
    
    // Per utenti con ruoli specifici, limita alle prenotazioni dei propri centri
    if (req.user.ruolo !== 'Amministratore') {
      const userCentriQuery = `
        SELECT centro_id FROM UtentiCentri WHERE utente_id = ?
      `;
      
      const userCentri = await db.all(userCentriQuery, [req.user.id]);
      const centriIds = userCentri.map(row => row.centro_id);
      
      if (centriIds.length === 0) {
        // Se l'utente non è associato a nessun centro, non mostrare niente
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
      query += ` AND (p.centro_ricevente_id IN (${placeholders}) OR l.centro_origine_id IN (${placeholders}))`;
      params.push(...centriIds, ...centriIds);
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
        co.nome AS centro_origine_nome, co.indirizzo AS indirizzo_origine, co.telefono AS telefono_origine,
        cr.nome AS centro_ricevente_nome, cr.indirizzo AS indirizzo_ricevente, cr.telefono AS telefono_ricevente
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      JOIN Centri co ON l.centro_origine_id = co.id
      JOIN Centri cr ON p.centro_ricevente_id = cr.id
      WHERE p.id = ?
    `;
    
    const prenotazione = await db.get(query, [id]);
    
    if (!prenotazione) {
      throw new ApiError(404, 'Prenotazione non trovata');
    }
    
    // Verifica i permessi dell'utente
    if (req.user.ruolo !== 'Amministratore') {
      // Controlla se l'utente appartiene al centro origine o ricevente
      const userCentriQuery = `
        SELECT 1 FROM UtentiCentri 
        WHERE utente_id = ? AND centro_id IN (?, ?)
      `;
      
      const userCanAccess = await db.get(
        userCentriQuery, 
        [req.user.id, prenotazione.centro_origine_id, prenotazione.centro_ricevente_id]
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
 * Crea una nuova prenotazione
 */
const createPrenotazione = async (req, res, next) => {
  try {
    const { lotto_id, centro_ricevente_id, note, data_ritiro } = req.body;
    
    // Verifica che il lotto esista e sia disponibile
    const lottoQuery = `
      SELECT l.*, c.nome AS centro_nome 
      FROM Lotti l
      JOIN Centri c ON l.centro_origine_id = c.id
      WHERE l.id = ?
    `;
    
    const lotto = await db.get(lottoQuery, [lotto_id]);
    
    if (!lotto) {
      throw new ApiError(404, 'Lotto non trovato');
    }
    
    // Verifica che il lotto non sia già prenotato
    const prenotazioneEsistenteQuery = `
      SELECT 1 FROM Prenotazioni
      WHERE lotto_id = ? AND stato IN ('Prenotato', 'InTransito')
    `;
    
    const prenotazioneEsistente = await db.get(prenotazioneEsistenteQuery, [lotto_id]);
    
    if (prenotazioneEsistente) {
      throw new ApiError(409, 'Questo lotto è già stato prenotato');
    }
    
    // Verifica che il centro ricevente esista
    const centroQuery = `SELECT * FROM Centri WHERE id = ?`;
    const centro = await db.get(centroQuery, [centro_ricevente_id]);
    
    if (!centro) {
      throw new ApiError(404, 'Centro ricevente non trovato');
    }
    
    // Verifica che il centro origine sia diverso dal centro ricevente
    if (lotto.centro_origine_id === centro_ricevente_id) {
      throw new ApiError(400, 'Il centro ricevente non può essere lo stesso del centro origine');
    }
    
    // Crea la prenotazione
    const insertQuery = `
      INSERT INTO Prenotazioni (
        lotto_id, centro_ricevente_id, stato, 
        data_prenotazione, data_ritiro, note
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    `;
    
    const result = await db.run(
      insertQuery, 
      [lotto_id, centro_ricevente_id, 'Prenotato', data_ritiro || null, note || null]
    );
    
    if (!result.lastID) {
      throw new ApiError(500, 'Errore durante la creazione della prenotazione');
    }
    
    // Crea notifica per il centro di origine
    const notificaQuery = `
      INSERT INTO Notifiche (
        tipo, messaggio, destinatario_id, creato_il
      )
      SELECT 
        'Prenotazione', 
        'Il lotto "' || ? || '" è stato prenotato dal centro "' || ? || '"', 
        u.id,
        CURRENT_TIMESTAMP
      FROM Utenti u
      JOIN UtentiCentri uc ON u.id = uc.utente_id
      WHERE uc.centro_id = ?
    `;
    
    await db.run(
      notificaQuery, 
      [lotto.prodotto, centro.nome, lotto.centro_origine_id]
    );
    
    // Ottieni i dettagli completi della prenotazione appena creata
    const prenotazioneQuery = `
      SELECT 
        p.*,
        l.prodotto, l.quantita, l.unita_misura, l.data_scadenza,
        co.nome AS centro_origine_nome,
        cr.nome AS centro_ricevente_nome
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      JOIN Centri co ON l.centro_origine_id = co.id
      JOIN Centri cr ON p.centro_ricevente_id = cr.id
      WHERE p.id = ?
    `;
    
    const prenotazione = await db.get(prenotazioneQuery, [result.lastID]);
    
    res.status(201).json(prenotazione);
  } catch (error) {
    next(error);
  }
};

/**
 * Aggiorna lo stato di una prenotazione esistente
 */
const updatePrenotazione = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stato, data_ritiro, data_consegna, note } = req.body;
    
    // Verifica che la prenotazione esista
    const prenotazioneQuery = `
      SELECT 
        p.*,
        l.prodotto, l.centro_origine_id
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      WHERE p.id = ?
    `;
    
    const prenotazione = await db.get(prenotazioneQuery, [id]);
    
    if (!prenotazione) {
      throw new ApiError(404, 'Prenotazione non trovata');
    }
    
    // Verifica che l'utente appartenga al centro origine o ricevente
    if (req.user.ruolo !== 'Amministratore') {
      const userCentriQuery = `
        SELECT 1 FROM UtentiCentri 
        WHERE utente_id = ? AND centro_id IN (?, ?)
      `;
      
      const userCanAccess = await db.get(
        userCentriQuery, 
        [req.user.id, prenotazione.centro_origine_id, prenotazione.centro_ricevente_id]
      );
      
      if (!userCanAccess) {
        throw new ApiError(403, 'Non hai i permessi per modificare questa prenotazione');
      }
    }
    
    // Verifica le transizioni di stato valide
    if (stato) {
      const statoAttuale = prenotazione.stato;
      const transizioniValide = {
        'Prenotato': ['InTransito', 'Annullato'],
        'InTransito': ['Consegnato', 'Annullato'],
        'Consegnato': [],
        'Annullato': []
      };
      
      if (!transizioniValide[statoAttuale].includes(stato) && statoAttuale !== stato) {
        throw new ApiError(400, `Impossibile cambiare lo stato da ${statoAttuale} a ${stato}`);
      }
      
      // Se lo stato cambia a Consegnato, assicurati che ci sia una data di consegna
      if (stato === 'Consegnato' && !data_consegna && !prenotazione.data_consegna) {
        throw new ApiError(400, 'La data di consegna è obbligatoria per lo stato Consegnato');
      }
    }
    
    // Costruisci la query di aggiornamento in base ai campi forniti
    let updateQuery = `UPDATE Prenotazioni SET `;
    const updateFields = [];
    const updateParams = [];
    
    if (stato) {
      updateFields.push('stato = ?');
      updateParams.push(stato);
    }
    
    if (data_ritiro !== undefined) {
      updateFields.push('data_ritiro = ?');
      updateParams.push(data_ritiro);
    }
    
    if (data_consegna !== undefined) {
      updateFields.push('data_consegna = ?');
      updateParams.push(data_consegna);
    }
    
    if (note !== undefined) {
      updateFields.push('note = ?');
      updateParams.push(notes);
    }
    
    // Se non ci sono campi da aggiornare, restituisci un errore
    if (updateFields.length === 0) {
      throw new ApiError(400, 'Nessun dato valido fornito per l\'aggiornamento');
    }
    
    updateQuery += updateFields.join(', ');
    updateQuery += ' WHERE id = ?';
    updateParams.push(id);
    
    // Esegui l'aggiornamento
    await db.run(updateQuery, updateParams);
    
    // Se lo stato è cambiato, crea una notifica
    if (stato && stato !== prenotazione.stato) {
      let destinatariCentroId;
      let messaggio;
      
      if (stato === 'InTransito') {
        destinatariCentroId = prenotazione.centro_ricevente_id;
        messaggio = `Il lotto "${prenotazione.prodotto}" è in transito verso il tuo centro`;
      } else if (stato === 'Consegnato') {
        destinatariCentroId = prenotazione.centro_origine_id;
        messaggio = `Il lotto "${prenotazione.prodotto}" è stato consegnato al centro ricevente`;
      } else if (stato === 'Annullato') {
        // Notifica entrambi i centri
        const notificaQuery = `
          INSERT INTO Notifiche (tipo, messaggio, destinatario_id, creato_il)
          SELECT 'Prenotazione', ?, u.id, CURRENT_TIMESTAMP
          FROM Utenti u
          JOIN UtentiCentri uc ON u.id = uc.utente_id
          WHERE uc.centro_id IN (?, ?)
        `;
        
        await db.run(
          notificaQuery, 
          [
            `La prenotazione per il lotto "${prenotazione.prodotto}" è stata annullata`, 
            prenotazione.centro_origine_id, 
            prenotazione.centro_ricevente_id
          ]
        );
      }
      
      // Invia notifica per stati diversi da Annullato (già gestito sopra)
      if (stato !== 'Annullato' && destinatariCentroId && messaggio) {
        const notificaQuery = `
          INSERT INTO Notifiche (tipo, messaggio, destinatario_id, creato_il)
          SELECT 'Prenotazione', ?, u.id, CURRENT_TIMESTAMP
          FROM Utenti u
          JOIN UtentiCentri uc ON u.id = uc.utente_id
          WHERE uc.centro_id = ?
        `;
        
        await db.run(notificaQuery, [messaggio, destinatariCentroId]);
      }
    }
    
    // Ottieni i dati aggiornati della prenotazione
    const updatedPrenotazione = await db.get(prenotazioneQuery, [id]);
    
    res.json(updatedPrenotazione);
  } catch (error) {
    next(error);
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
        l.centro_origine_id, l.prodotto
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
        FROM Utenti u
        JOIN UtentiCentri uc ON u.id = uc.utente_id
        WHERE uc.centro_id = ?
      `;
      
      await db.run(
        notificaQuery, 
        [
          `Il lotto "${prenotazione.prodotto}" è in transito verso il tuo centro`, 
          prenotazione.centro_ricevente_id
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
        l.prodotto, l.centro_origine_id
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
      [motivo || 'Annullata dall\'utente', motivo || 'Annullata dall\'utente', id]
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
      FROM Utenti u
      JOIN UtentiCentri uc ON u.id = uc.utente_id
      WHERE uc.centro_id IN (?, ?)
    `;
    
    await db.run(
      notificaQuery, 
      [
        `La prenotazione per il lotto "${prenotazione.prodotto}" è stata annullata${motivo ? ': ' + motivo : ''}`, 
        prenotazione.centro_origine_id, 
        prenotazione.centro_ricevente_id
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
const getPrenotazioniByCentro = async (req, res, next) => {
  try {
    const { centro_id } = req.params;
    const { stato, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Verifica che il centro esista
    const centroQuery = `SELECT * FROM Centri WHERE id = ?`;
    const centro = await db.get(centroQuery, [centro_id]);
    
    if (!centro) {
      throw new ApiError(404, 'Centro non trovato');
    }
    
    // Costruisci la query in base ai filtri
    let query = `
      SELECT 
        p.*,
        l.prodotto, l.quantita, l.unita_misura, l.data_scadenza, l.stato AS stato_lotto,
        co.nome AS centro_origine_nome,
        cr.nome AS centro_ricevente_nome
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      JOIN Centri co ON l.centro_origine_id = co.id
      JOIN Centri cr ON p.centro_ricevente_id = cr.id
      WHERE (p.centro_ricevente_id = ? OR l.centro_origine_id = ?)
    `;
    
    const params = [centro_id, centro_id];
    
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

module.exports = {
  getPrenotazioni,
  getPrenotazioneById,
  createPrenotazione,
  updatePrenotazione,
  addTrasporto,
  cancelPrenotazione,
  getPrenotazioniByCentro
}; 