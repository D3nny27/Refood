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
        co.nome AS centro_origine_nome,
        cr.nome AS centro_ricevente_nome
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      JOIN Utenti co ON l.centro_origine_id = co.id
      JOIN Utenti cr ON p.utente_id = cr.id
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
      query += ' AND (p.utente_id = ? OR l.centro_origine_id = ?)';
      params.push(centro, centro);
    }
    
    // Per attori con ruoli specifici, limita alle prenotazioni dei propri centri
    if (req.user.ruolo !== 'Amministratore') {
      const userCentriQuery = `
        SELECT centro_id FROM UtentiCentri WHERE utente_id = ?
      `;
      
      const userCentri = await db.all(userCentriQuery, [req.user.id]);
      const centriIds = userCentri.map(row => row.centro_id);
      
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
      query += ` AND (p.utente_id IN (${placeholders}) OR l.centro_origine_id IN (${placeholders}))`;
      params.push(...centriIds, ...centriIds);
    }
    
    // Query per conteggio totale
    const countQuery = `SELECT COUNT(*) AS total FROM (${query}) AS filtered`;
    
    // Aggiunge ordinamento e paginazione
    query += ' ORDER BY p.data_creazione DESC LIMIT ? OFFSET ?';
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
      JOIN Utenti co ON l.centro_origine_id = co.id
      JOIN Utenti cr ON p.utente_id = cr.id
      WHERE p.id = ?
    `;
    
    const prenotazione = await db.get(query, [id]);
    
    if (!prenotazione) {
      throw new ApiError(404, 'Prenotazione non trovata');
    }
    
    // Verifica i permessi dell'attore
    if (req.user.ruolo !== 'Amministratore') {
      // Controlla se l'attore appartiene al centro origine o ricevente
      const userCentriQuery = `
        SELECT 1 FROM UtentiCentri 
        WHERE utente_id = ? AND centro_id IN (?, ?)
      `;
      
      const userCanAccess = await db.get(
        userCentriQuery, 
        [req.user.id, prenotazione.centro_origine_id, prenotazione.utente_id]
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
 * Invia notifiche push agli amministratori del centro di origine quando un lotto viene prenotato
 * @param {number} prenotazioneId - ID della prenotazione
 * @param {object} lotto - Dettagli del lotto prenotato
 * @param {object} centro - Dettagli del centro che ha effettuato la prenotazione
 * @param {string|null} data_ritiro - Data prevista per il ritiro (opzionale)
 * @param {string|null} note - Note aggiuntive (opzionale)
 */
async function notificaAmministratoriCentroOrigine(prenotazioneId, lotto, centro, data_ritiro, note) {
  try {
    // Recupera gli attori amministratori e operatori del centro di origine
    const attoriQuery = `
      SELECT 
        a.id, 
        a.nome, 
        a.cognome, 
        a.token_notifiche
      FROM Attori a
      JOIN UtentiCentri uc ON a.id = uc.utente_id
      WHERE uc.centro_id = ? 
      AND (a.ruolo = 'Amministratore' OR a.ruolo = 'Operatore')
      AND a.token_notifiche IS NOT NULL
    `;
    
    const attori = await db.all(attoriQuery, [lotto.centro_origine_id]);
    if (attori.length === 0) {
      console.log(`Nessun amministratore o operatore con token notifiche trovato per il centro ${lotto.centro_origine_id}`);
      return;
    }
    
    // Costruisci il messaggio dettagliato
    const titolo = 'Nuova prenotazione ricevuta';
    const messaggio = `Il lotto "${lotto.prodotto}" (${lotto.quantita} ${lotto.unita_misura}) è stato prenotato dal centro "${centro.nome}". ${data_ritiro ? `Ritiro previsto: ${data_ritiro}` : 'Data ritiro non specificata'}.`;
    
    // Log per debug
    console.log(`Invio notifiche push a ${attori.length} attori per la prenotazione ${prenotazioneId}`);
    
    // Imposta le notifiche nel sistema (usato poi per le notifiche push)
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
      ) VALUES (?, ?, 'Prenotazione', 'Alta', ?, ?, 'Prenotazione', 0, CURRENT_TIMESTAMP)
    `;
    
    for (const attore of attori) {
      if (attore.token_notifiche) {
        try {
          // Inserisci la notifica nel database per questo attore specifico
          await db.run(
            notificaQuery, 
            [
              titolo,
              messaggio,
              attore.id,
              prenotazioneId
            ]
          );
          
          console.log(`Notifica inserita per l'attore ${attore.id} (${attore.nome} ${attore.cognome})`);
          
          // Qui potremmo inviare una notifica push tramite Firebase o altro servizio esterno
          // usando il token_notifiche dell'attore
        } catch (notificaErr) {
          console.error(`Errore durante l'inserimento della notifica per l'attore ${attore.id}:`, notificaErr);
        }
      }
    }
    
    console.log(`Notifiche inviate agli amministratori del centro di origine per la prenotazione ${prenotazioneId}`);
  } catch (error) {
    console.error(`Errore nell'invio delle notifiche agli amministratori del centro: ${error.message}`);
    throw error;
  }
}

/**
 * Crea una nuova prenotazione
 */
const createPrenotazione = async (req, res, next) => {
  try {
    const { lotto_id, centro_ricevente_id, note, data_ritiro } = req.body;
    
    // Verifica che il lotto esista e sia disponibile
    const lottoQuery = `
      SELECT l.*, c.nome AS centro_nome, c.latitudine AS origine_lat, 
             c.longitudine AS origine_lng, c.indirizzo AS origine_indirizzo
      FROM Lotti l
      JOIN Utenti c ON l.centro_origine_id = c.id
      WHERE l.id = ?
    `;
    
    const lotto = await db.get(lottoQuery, [lotto_id]);
    
    if (!lotto) {
      throw new ApiError(404, 'Lotto non trovato');
    }
    
    // Verifica che il lotto non sia già prenotato
    const prenotazioneEsistenteQuery = `
      SELECT 1 FROM Prenotazioni
      WHERE lotto_id = ? AND stato IN ('Prenotato', 'InAttesa', 'Confermato', 'InTransito')
    `;
    
    const prenotazioneEsistente = await db.get(prenotazioneEsistenteQuery, [lotto_id]);
    
    if (prenotazioneEsistente) {
      throw new ApiError(409, 'Questo lotto è già stato prenotato');
    }
    
    // Verifica che il centro ricevente esista
    const centroQuery = `
      SELECT c.*, c.latitudine AS dest_lat, c.longitudine AS dest_lng, 
             c.indirizzo AS dest_indirizzo 
      FROM Utenti c 
      WHERE id = ?
    `;
    const centro = await db.get(centroQuery, [centro_ricevente_id]);
    
    if (!centro) {
      throw new ApiError(404, 'Centro ricevente non trovato');
    }
    
    // Verifica che il centro origine sia diverso dal centro ricevente
    if (lotto.centro_origine_id === centro_ricevente_id) {
      throw new ApiError(400, 'Il centro ricevente non può essere lo stesso del centro origine');
    }
    
    // Calcola la distanza tra i due centri se entrambi hanno coordinate geografiche
    let distanza = null;
    let percorso = null;
    if (lotto.origine_lat && lotto.origine_lng && centro.dest_lat && centro.dest_lng) {
      // Calcolo della distanza approssimativa usando la formula di Haversine
      const R = 6371; // Raggio della Terra in km
      const dLat = (centro.dest_lat - lotto.origine_lat) * Math.PI / 180;
      const dLon = (centro.dest_lng - lotto.origine_lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lotto.origine_lat * Math.PI / 180) * Math.cos(centro.dest_lat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      distanza = R * c; // Distanza in km
      
      // Creiamo un oggetto percorso semplificato con le coordinate di partenza e arrivo
      percorso = {
        origine: {
          lat: lotto.origine_lat,
          lng: lotto.origine_lng,
          indirizzo: lotto.origine_indirizzo
        },
        destinazione: {
          lat: centro.dest_lat,
          lng: centro.dest_lng,
          indirizzo: centro.dest_indirizzo
        },
        distanza_km: distanza.toFixed(2)
      };
    }
    
    // Avvia una transazione per garantire l'integrità dei dati
    await db.exec('BEGIN TRANSACTION');
    
    try {
      // Crea la prenotazione
      const insertQuery = `
        INSERT INTO Prenotazioni (
          lotto_id, centro_ricevente_id, stato, 
          data_creazione, data_ritiro, note
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
      `;
      
      const result = await db.run(
        insertQuery, 
        [lotto_id, centro_ricevente_id, 'Prenotato', data_ritiro || null, note || null]
      );
      
      const prenotazioneId = result.lastID;
      
      if (!prenotazioneId) {
        throw new ApiError(500, 'Errore durante la creazione della prenotazione');
      }
      
      // Se abbiamo calcolato un percorso, registriamo anche informazioni preliminari di trasporto
      if (percorso) {
        const insertTrasportoQuery = `
          INSERT INTO Trasporti (
            prenotazione_id, 
            mezzo,
            distanza_km, 
            emissioni_co2, 
            stato, 
            latitudine_origine,
            longitudine_origine,
            indirizzo_origine,
            latitudine_destinazione,
            longitudine_destinazione,
            indirizzo_destinazione
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        // Calcoliamo una stima approssimativa delle emissioni di CO2 (0.2 kg per km)
        const emissioni = distanza * 0.2;
        
        await db.run(
          insertTrasportoQuery, 
          [
            prenotazioneId,
            'Non specificato', // Valore predefinito per il campo mezzo
            distanza, 
            emissioni, 
            'Pianificato',
            lotto.origine_lat,
            lotto.origine_lng,
            lotto.origine_indirizzo,
            centro.dest_lat,
            centro.dest_lng,
            centro.dest_indirizzo
          ]
        );
      }
      
      // Crea notifica per il centro di origine
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
          'Nuova prenotazione ricevuta',
          'Il lotto "' || ? || '" (' || ? || ' ' || ? || ') è stato prenotato dal centro "' || ? || '". ' || 
          'Data ritiro: ' || COALESCE(?, 'Non specificata') || '. ' || 
          'Note: ' || COALESCE(?, 'Nessuna'), 
          'Prenotazione',
          'Alta',
          u.id,
          ?,
          'Prenotazione',
          0,
          CURRENT_TIMESTAMP
        FROM Utenti u
        JOIN UtentiCentri uc ON u.id = uc.utente_id
        WHERE uc.centro_id = ? 
        AND (u.ruolo = 'Amministratore' OR u.ruolo = 'Operatore')
      `;
      
      await db.run(
        notificaQuery, 
        [
          lotto.prodotto, 
          lotto.quantita,
          lotto.unita_misura,
          centro.nome,
          data_ritiro || 'Non specificata',
          note || 'Nessuna',
          prenotazioneId,
          lotto.centro_origine_id
        ]
      );
      
      // Commit della transazione
      await db.exec('COMMIT');
      
      // Ottieni i dettagli completi della prenotazione appena creata
      const prenotazioneQuery = `
        SELECT 
          p.*,
          l.prodotto, l.quantita, l.unita_misura, l.data_scadenza,
          co.nome AS centro_origine_nome, co.latitudine AS origine_lat, co.longitudine AS origine_lng,
          cr.nome AS centro_ricevente_nome, cr.latitudine AS dest_lat, cr.longitudine AS dest_lng,
          t.distanza_km, t.emissioni_co2, t.stato AS stato_trasporto
        FROM Prenotazioni p
        JOIN Lotti l ON p.lotto_id = l.id
        JOIN Utenti co ON l.centro_origine_id = co.id
        JOIN Utenti cr ON p.utente_id = cr.id
        LEFT JOIN Trasporti t ON p.id = t.prenotazione_id
        WHERE p.id = ?
      `;
      
      const prenotazione = await db.get(prenotazioneQuery, [prenotazioneId]);
      
      res.status(201).json({
        message: 'Prenotazione creata con successo',
        prenotazione: prenotazione,
        percorso: percorso
      });
      
      // Invia notifiche push agli amministratori del centro di origine (asincrono, dopo la risposta)
      try {
        await notificaAmministratoriCentroOrigine(
          prenotazioneId, 
          lotto, 
          centro, 
          data_ritiro, 
          note
        );
      } catch (notifyError) {
        console.error('Errore durante l\'invio delle notifiche push:', notifyError);
        // Non propaga l'errore poiché la prenotazione è stata comunque creata con successo
      }
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
 * Aggiorna lo stato di una prenotazione esistente
 */
const updatePrenotazione = async (req, res, next) => {
  try {
    const prenotazioneId = req.params.id;
    const { stato } = req.body;
    
    // Verifica che la prenotazione esista
    const prenotazione = await db.get(
      `SELECT p.*, l.prodotto, l.centro_origine_id, c.nome as centro_nome
       FROM Prenotazioni p
       JOIN Lotti l ON p.lotto_id = l.id
       JOIN Utenti c ON p.centro_ricevente_id = c.id
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
      `SELECT p.*, l.prodotto, l.centro_origine_id, c.nome as centro_nome
       FROM Prenotazioni p
       JOIN Lotti l ON p.lotto_id = l.id
       JOIN Utenti c ON p.centro_ricevente_id = c.id
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
         FROM Utenti u
         JOIN UtentiCentri uc ON u.id = uc.utente_id
         WHERE uc.centro_id = ?`,
        [prenotazione.centro_origine_id]
      );
      
      // Aggiungi gli operatori ai destinatari
      operatoriOrigine.forEach(op => destinatariNotifica.add(op.id));
    }
    
    // Sempre notifica al centro di destinazione del cambio di stato
    // Ottieni gli operatori del centro di destinazione
    const operatoriDestinazione = await db.all(
      `SELECT u.id
       FROM Utenti u
       JOIN UtentiCentri uc ON u.id = uc.utente_id
       WHERE uc.centro_id = ?`,
      [prenotazione.centro_ricevente_id]
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
    const centroQuery = `SELECT * FROM Utenti WHERE id = ?`;
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
      JOIN Utenti co ON l.centro_origine_id = co.id
      JOIN Utenti cr ON p.utente_id = cr.id
      WHERE (p.utente_id = ? OR l.centro_origine_id = ?)
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
    query += ' ORDER BY p.data_creazione DESC LIMIT ? OFFSET ?';
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
          l.prodotto, l.centro_origine_id,
          cr.nome AS centro_ricevente_nome
        FROM Prenotazioni p
        JOIN Lotti l ON p.lotto_id = l.id
        JOIN Utenti cr ON p.utente_id = cr.id
        WHERE p.id = ?
      `;
      
      const prenotazione = await db.get(prenotazioneQuery, [id]);
      
      if (!prenotazione) {
        throw new ApiError(404, 'Prenotazione non trovata');
      }
      
      // Verifica che l'attore abbia i permessi necessari (deve appartenere al centro origine)
      if (req.user.ruolo !== 'Amministratore') {
        const userCentriQuery = `
          SELECT 1 FROM UtentiCentri 
          WHERE utente_id = ? AND centro_id = ?
        `;
        
        const userCanAccess = await db.get(
          userCentriQuery, 
          [req.user.id, prenotazione.centro_origine_id]
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
        FROM Utenti u
        JOIN UtentiCentri uc ON u.id = uc.utente_id
        WHERE uc.centro_id = ?
      `;
      
      await db.run(
        notificaQuery, 
        [
          prenotazione.prodotto,
          data_ritiro_prevista,
          id,
          prenotazione.utente_id
        ]
      );
      
      // Ottieni i dettagli aggiornati della prenotazione
      const prenotazioneUpdatedQuery = `
        SELECT 
          p.*,
          l.prodotto, l.quantita, l.unita_misura, l.data_scadenza,
          co.nome AS centro_origine_nome,
          cr.nome AS centro_ricevente_nome
        FROM Prenotazioni p
        JOIN Lotti l ON p.lotto_id = l.id
        JOIN Utenti co ON l.centro_origine_id = co.id
        JOIN Utenti cr ON p.utente_id = cr.id
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
          l.prodotto, l.centro_origine_id,
          cr.nome AS centro_ricevente_nome
        FROM Prenotazioni p
        JOIN Lotti l ON p.lotto_id = l.id
        JOIN Utenti cr ON p.utente_id = cr.id
        WHERE p.id = ?
      `;
      
      const prenotazione = await db.get(prenotazioneQuery, [id]);
      
      if (!prenotazione) {
        throw new ApiError(404, 'Prenotazione non trovata');
      }
      
      // Verifica che l'attore abbia i permessi necessari (deve appartenere al centro origine)
      if (req.user.ruolo !== 'Amministratore') {
        const userCentriQuery = `
          SELECT 1 FROM UtentiCentri 
          WHERE utente_id = ? AND centro_id = ?
        `;
        
        const userCanAccess = await db.get(
          userCentriQuery, 
          [req.user.id, prenotazione.centro_origine_id]
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
        FROM Utenti u
        JOIN UtentiCentri uc ON u.id = uc.utente_id
        WHERE uc.centro_id = ?
      `;
      
      await db.run(
        notificaQuery, 
        [
          prenotazione.prodotto,
          motivo || 'Non specificato',
          id,
          prenotazione.utente_id
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
          co.nome AS centro_origine_nome,
          cr.nome AS centro_ricevente_nome
        FROM Prenotazioni p
        JOIN Lotti l ON p.lotto_id = l.id
        JOIN Utenti co ON l.centro_origine_id = co.id
        JOIN Utenti cr ON p.utente_id = cr.id
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
          SELECT id, lotto_id, utente_id, stato, data_creazione
          FROM Prenotazioni
          WHERE lotto_id = ? AND stato IN ('Prenotato', 'InAttesa', 'Confermato', 'InTransito')
          ORDER BY data_creazione DESC
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
  getPrenotazioniByCentro,
  accettaPrenotazione,
  rifiutaPrenotazione,
  cleanupDuplicatePrenotazioni
}; 