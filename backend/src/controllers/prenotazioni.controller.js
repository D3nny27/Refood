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
    
    // Query principale per dati prenotazione, includendo informazioni utente
    const query = `
      SELECT 
        p.*,
        l.prodotto, l.quantita, l.unita_misura, l.data_scadenza, l.stato AS stato_lotto,
        cr.tipo AS centro_ricevente_nome, cr.indirizzo AS indirizzo_ricevente, cr.telefono AS telefono_ricevente,
        a.nome AS creatore_nome, a.cognome AS creatore_cognome,
        u.id AS utente_id, u.nome AS utente_nome, u.cognome AS utente_cognome,
        u.email AS utente_email, u.ruolo AS utente_ruolo
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      JOIN Tipo_Utente cr ON p.tipo_utente_ricevente_id = cr.id
      LEFT JOIN Attori a ON l.inserito_da = a.id
      LEFT JOIN Attori u ON p.attore_id = u.id
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
    
    // Crea un oggetto utente se abbiamo i dati dell'utente
    const utente = prenotazione.utente_id ? {
      id: prenotazione.utente_id,
      nome: prenotazione.utente_nome,
      cognome: prenotazione.utente_cognome,
      email: prenotazione.utente_email,
      ruolo: prenotazione.utente_ruolo
    } : null;
    
    // Unifica i risultati
    const result = {
      ...prenotazione,
      utente,
      trasporto: trasporto || null
    };
    
    // Rimuovi i campi ridondanti dell'utente che ora sono nell'oggetto dedicato
    if (utente) {
      delete result.utente_id;
      delete result.utente_nome;
      delete result.utente_cognome;
      delete result.utente_email;
      delete result.utente_ruolo;
    }
    
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
    console.log('=== INIZIO PROCESSO DI NOTIFICA ===');
    console.log(`Prenotazione ID: ${prenotazioneId}`);
    console.log(`Lotto: ${JSON.stringify(lotto)}`);
    console.log(`Centro: ${JSON.stringify(centro)}`);
    console.log(`Data ritiro: ${data_ritiro}`);
    
    // Prepara data formattata per la notifica
    const dataRitiroFormatted = data_ritiro ? new Date(data_ritiro).toLocaleDateString('it-IT') : 'non specificata';
    
    // Prepara il titolo della notifica
    const titolo = `Nuova prenotazione: ${lotto.prodotto} (${lotto.quantita} ${lotto.unita_misura})`;
    
    // Prepara il contenuto della notifica
    const contenuto = `Il centro "${centro.tipo}" ha prenotato ${lotto.quantita} ${lotto.unita_misura} di ${lotto.prodotto}. 
    Data di ritiro prevista: ${dataRitiroFormatted}.
    ${note ? `Note: ${note}` : ''}`;
    
    // Cerca amministratori e operatori per inviare notifiche
    console.log('Esecuzione query per trovare amministratori...');
    
    // MODIFICA: Rimuovo completamente il riferimento a token_notifiche
    const query = `
      SELECT 
        u.id, 
        u.nome, 
        u.cognome
      FROM Attori u
      WHERE (u.ruolo = 'Amministratore' OR u.ruolo = 'Operatore')
    `;
    
    const utenti = await db.all(query);
    
    // Se non ci sono utenti, registriamo e usciamo
    if (!utenti || utenti.length === 0) {
      console.log('❌ Nessun amministratore trovato per le notifiche');
      return;
    }
    
    console.log(`✅ Trovati ${utenti.length} utenti per le notifiche`);
    
    // Crea notifiche per ogni utente
    const notifichePendenti = utenti.map(async (utente) => {
      try {
        // Verifico che il controller delle notifiche sia accessibile
        if (!notificheController || typeof notificheController.creaNotifica !== 'function') {
          console.error('❌ Controller notifiche non disponibile o metodo creaNotifica mancante');
          return false;
        }
        
        const notificaCreata = await notificheController.creaNotifica(
          utente.id,
          'Prenotazione',
          titolo,
          contenuto,
          `/prenotazioni/${prenotazioneId}`,
          { prenotazioneId, lottoId: lotto.id }
        );
        
        if (notificaCreata) {
          console.log(`✅ Notifica creata per ${utente.nome} ${utente.cognome || ''} (ID: ${utente.id})`);
          return true;
        } else {
          console.error(`❌ Impossibile creare notifica per utente ID: ${utente.id}`);
          return false;
        }
      } catch (errNotifica) {
        console.error(`❌ Errore durante la creazione notifica per utente ${utente.id}:`);
        console.error(errNotifica);
        return false;
      }
    });
    
    const risultatiNotifiche = await Promise.allSettled(notifichePendenti);
    const notificheInviate = risultatiNotifiche.filter(r => r.status === 'fulfilled' && r.value === true).length;
    
    console.log(`✅ Inviate ${notificheInviate} notifiche su ${utenti.length} utenti`);
    
    // Invia notifica tramite WebSocket se disponibile
    try {
      console.log('Tentativo di inviare notifica tramite WebSocket...');
      
      // Importo esplicitamente il modulo websocket
      const webSocketService = require('../utils/websocket');
      
      if (webSocketService && typeof webSocketService.notificaNuovaPrenotazione === 'function') {
        await webSocketService.notificaNuovaPrenotazione(prenotazioneId);
        console.log('✅ Notifica WebSocket inviata');
      } else {
        console.log('⚠️ Servizio WebSocket non disponibile o metodo mancante');
        console.log(`WebSocket Service: ${typeof webSocketService}`);
        if (webSocketService) {
          console.log(`Metodi disponibili: ${Object.keys(webSocketService).join(', ')}`);
        }
      }
    } catch (wsError) {
      console.error('❌ Errore durante l\'invio della notifica WebSocket:');
      console.error(wsError);
    }
    
    console.log('=== FINE PROCESSO DI NOTIFICA ===');
    
  } catch (error) {
    console.error(`❌ Errore generale nella notifica amministratori: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
  }
}

/**
 * Crea una nuova prenotazione per un lotto
 */
const createPrenotazione = async (req, res, next) => {
  try {
    // Aggiungo log dettagliati per debug
    console.log(`🔍 DEBUG PRENOTAZIONE - Utente: ${JSON.stringify({
      id: req.user.id,
      ruolo: req.user.ruolo,
      tipo_utente: req.user.tipo_utente
    })}`);
    console.log(`🔍 DEBUG PRENOTAZIONE - Body request: ${JSON.stringify(req.body)}`);
    
    const { lotto_id, data_ritiro, note, tipo_pagamento } = req.body;
    const utente_id = req.user.id;
    
    // PROBLEMA IDENTIFICATO: req.user.centro_id è undefined
    // SOLUZIONE: Recuperiamo il tipo_utente_id direttamente dalla tabella AttoriTipoUtente
    console.log(`⭐ CREAZIONE PRENOTAZIONE - Dati ricevuti: lotto_id=${lotto_id}, utente_id=${utente_id}`);
    
    // Ottieni il tipo_utente_id dalla tabella AttoriTipoUtente
    let centro_id = null;
    
    try {
      console.log(`🔍 Recupero il tipo_utente_id per l'utente ${utente_id}...`);
      
      const tipoUtenteQuery = `
        SELECT tipo_utente_id FROM AttoriTipoUtente 
        WHERE attore_id = ?
      `;
      
      const tipoUtenteResult = await db.get(tipoUtenteQuery, [utente_id]);
      
      if (tipoUtenteResult && tipoUtenteResult.tipo_utente_id) {
        centro_id = tipoUtenteResult.tipo_utente_id;
        console.log(`✅ Tipo_utente_id recuperato: ${centro_id}`);
      } else {
        console.error(`❌ Nessun tipo_utente_id trovato per l'utente ${utente_id}`);
      }
    } catch (error) {
      console.error(`❌ Errore durante il recupero del tipo_utente_id: ${error.message}`);
    }
    
    if (!lotto_id) {
      console.error('ID lotto mancante nella richiesta di prenotazione');
      return res.status(400).json({
        status: 'error',
        message: 'L\'ID del lotto è obbligatorio'
      });
    }
    
    if (!centro_id) {
      console.error(`ID centro non trovato per l'utente ${utente_id}`);
      return res.status(400).json({
        status: 'error',
        message: 'Non è stato possibile identificare il tuo centro. Impossibile procedere con la prenotazione.',
        details: 'Contatta l\'amministratore del sistema.'
      });
    }
    
    try {
      // IMPORTANTE: rimuoviamo qualsiasi limite implicito al numero di prenotazioni
      console.log(`✅ Il sistema consente prenotazioni multiple, verifico solo lo stato individuale del lotto ${lotto_id}`);
      
      // Verifica l'esistenza del lotto
      console.log(`Verifica esistenza del lotto ${lotto_id}...`);
      const lotto = await db.get(
        'SELECT id, stato, prodotto, quantita, unita_misura, data_scadenza, inserito_da FROM Lotti WHERE id = ?',
        [lotto_id]
      );
      
      if (!lotto) {
        console.error(`Lotto ID ${lotto_id} non trovato nel database`);
        return res.status(404).json({
          status: 'error',
          message: 'Lotto non trovato'
        });
      }
      
      console.log(`Lotto ID ${lotto_id} trovato: ${JSON.stringify(lotto)}`);
      
      // Sistema centralizzato: non verifichiamo più il centro di origine
      // Verifichiamo solo che il lotto non sia già prenotato
      if (lotto.stato !== 'Verde' && lotto.stato !== 'Arancione') {
        console.error(`Il lotto ${lotto_id} non è disponibile per la prenotazione, stato attuale: ${lotto.stato}`);
        return res.status(400).json({
          status: 'error',
          message: `Il lotto non è disponibile per la prenotazione (stato: ${lotto.stato})`
        });
      }
      
      // Debug speciale per lotto 4 (Pere)
      if (lotto_id == 4) {
        console.log(`⚠️ DEBUG SPECIALE: Lotto 4 (Pere) ID=${lotto.id}, Stato=${lotto.stato}, Centro richiedente=${centro_id}`);
        
        // Verifichiamo se il lotto è effettivamente disponibile controllando il suo stato
        if (lotto.stato === 'Prenotato') {
          console.log(`⚠️ PROBLEMA IDENTIFICATO: Il lotto 4 (Pere) ha stato="Prenotato" nel DB ma non dovrebbe essere prenotabile!`);
          return res.status(400).json({
            status: 'error',
            message: 'Questo lotto risulta già prenotato e non è disponibile'
          });
        }
      }

      // Verifica se esiste già una prenotazione per questo lotto specifico
      console.log(`Verifica prenotazioni esistenti per il lotto ${lotto_id}...`);

      const esistePrenotazioneQuery = `
        SELECT id, lotto_id, tipo_utente_ricevente_id, stato 
        FROM Prenotazioni
        WHERE lotto_id = ? AND stato NOT IN ('Annullato', 'Eliminato')
      `;

      console.log(`Esecuzione query: ${esistePrenotazioneQuery.replace(/\n/g, ' ')} con lotto_id=${lotto_id}`);

      const prenotazioniEsistenti = await db.all(esistePrenotazioneQuery, [lotto_id]);

      console.log(`Risultato verifica prenotazioni per lotto_id=${lotto_id}: ${prenotazioniEsistenti.length} prenotazioni trovate`);

      if (prenotazioniEsistenti.length > 0) {
        console.log(`Dettagli prenotazioni trovate per lotto_id=${lotto_id}:`);
        prenotazioniEsistenti.forEach((p, i) => {
          console.log(`[${i+1}] Prenotazione ID=${p.id}, Lotto_ID=${p.lotto_id}, Centro=${p.tipo_utente_ricevente_id}, Stato=${p.stato}`);
          // Verifica di sicurezza che il lotto_id corrisponda esattamente
          if (p.lotto_id !== parseInt(lotto_id)) {
            console.error(`⚠️ ATTENZIONE: ID lotto non corrispondente nella prenotazione ${p.id}: ${p.lotto_id} vs ${lotto_id}`);
          }
        });
        
        // Se ci sono prenotazioni esistenti, il lotto non è disponibile
        console.error(`Il lotto ${lotto_id} risulta già prenotato. Dettagli: ${JSON.stringify(prenotazioniEsistenti)}`);
        return res.status(400).json({
          status: 'error',
          message: 'Il lotto risulta già prenotato',
          prenotazioni: prenotazioniEsistenti.map(p => ({ id: p.id, stato: p.stato }))
        });
      } else {
        // Se siamo qui, non ci sono prenotazioni esistenti, ma facciamo un'ultima verifica sullo stato del lotto
        console.log(`Verifica aggiuntiva dello stato attuale del lotto ${lotto_id}...`);
        const lottoStatusQuery = `SELECT stato FROM Lotti WHERE id = ?`;
        const lottoStatus = await db.get(lottoStatusQuery, [lotto_id]);
        
        console.log(`Stato attuale del lotto ${lotto_id}: ${lottoStatus ? lottoStatus.stato : 'Sconosciuto'}`);
        
        // Se il lotto è marcato come Prenotato ma non ci sono prenotazioni, correggiamo lo stato
        if (lottoStatus && lottoStatus.stato === 'Prenotato') {
          console.log(`⚠️ Lotto ${lotto_id} marcato come "Prenotato" ma nessuna prenotazione trovata. Correggo lo stato...`);
          await db.run('UPDATE Lotti SET stato = ? WHERE id = ?', ['Verde', lotto_id]);
          console.log(`✅ Stato del lotto ${lotto_id} corretto a "Verde"`);
        }
      }

      console.log(`Nessuna prenotazione esistente per il lotto ${lotto_id}, procedo con la creazione`);
      
      // Crea la prenotazione con i dati ricevuti
      let query = `
        INSERT INTO Prenotazioni (
          lotto_id, 
          tipo_utente_ricevente_id, 
          stato,
          data_ritiro,
          note,
          tipo_pagamento
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      let params = [
        lotto_id, 
        centro_id, 
        'Prenotato',  // Lo stato iniziale è "Prenotato"
        data_ritiro || null,
        note || null,
        tipo_pagamento || null
      ];
      
      console.log(`Creazione nuova prenotazione con parametri: ${JSON.stringify(params)}`);
      
      const result = await db.run(query, params);
      
      if (!result || !result.lastID) {
        console.error('Errore nella creazione della prenotazione, nessun ID restituito');
        return res.status(500).json({
          status: 'error',
          message: 'Errore interno durante la creazione della prenotazione'
        });
      }
      
      const prenotazioneId = result.lastID;
      console.log(`Prenotazione creata con ID: ${prenotazioneId}`);
      
      // Ottieni i dettagli completi della prenotazione appena creata
      const prenotazione = await db.get(
        `SELECT 
          p.id, p.lotto_id, p.tipo_utente_ricevente_id, p.stato, 
          p.data_prenotazione, p.data_ritiro, p.note, p.tipo_pagamento,
          l.prodotto, l.quantita, l.unita_misura, l.data_scadenza
         FROM Prenotazioni p
         JOIN Lotti l ON p.lotto_id = l.id
         WHERE p.id = ?`,
        [prenotazioneId]
      );
      
      // Nel sistema centralizzato, non abbiamo più bisogno di recuperare info sul centro origine
      // Aggiungiamo il campo tipo_utente_origine_id come null per mantenere compatibilità
      prenotazione.tipo_utente_origine_id = null;
      
      if (!prenotazione) {
        console.error(`Prenotazione creata (ID: ${prenotazioneId}) ma impossibile recuperare i dettagli`);
        return res.status(500).json({
          status: 'error',
          message: 'Prenotazione creata ma impossibile recuperare i dettagli'
        });
      }
      
      console.log(`Dettagli prenotazione creata: ${JSON.stringify(prenotazione)}`);
      
      // Aggiorna lo stato del lotto (opzionale, a seconda della logica di business)
      try {
        await db.run(
          'UPDATE Lotti SET stato = ? WHERE id = ?',
          ['Prenotato', lotto_id]
        );
        console.log(`Stato del lotto ${lotto_id} aggiornato a "Prenotato"`);
      } catch (updateError) {
        console.error(`Errore nell'aggiornamento dello stato del lotto:`, updateError);
        // Non blocchiamo la risposta per questo errore
      }
      
      // Chiama la funzione per notificare gli amministratori dopo aver creato la prenotazione
      try {
        await notificaAmministratori(prenotazioneId, lotto, centro_id, data_ritiro, note);
        console.log(`Notifiche inviate per la prenotazione ${prenotazioneId}`);
      } catch (notifyError) {
        console.error(`Errore nell'invio delle notifiche:`, notifyError);
        // Non blocchiamo la risposta per questo errore
      }
      
      // Aggiungi dettagli al log per future verifiche
      console.log(`✅ Prenotazione ${prenotazioneId} completata con successo per lotto ${lotto_id} da centro ${centro_id}`);
      
      return res.status(201).json({
        status: 'success',
        message: 'Prenotazione creata con successo',
        data: prenotazione
      });
      
    } catch (error) {
      console.error('Errore durante la creazione della prenotazione:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Errore interno del server durante la creazione della prenotazione',
        error: error.message
      });
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
      [prenotazione.tipo_utente_ricevente_id]
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

/**
 * Segna una prenotazione come pronta per il ritiro
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const segnaComeProntoPerRitiro = async (req, res, next) => {
  try {
    const prenotazioneId = parseInt(req.params.id);
    const { note } = req.body;
    
    // Recupera la prenotazione corrente
    const prenotazione = await db.get('SELECT * FROM Prenotazioni WHERE id = ?', [prenotazioneId]);
    
    if (!prenotazione) {
      return res.status(404).json({
        status: 'error',
        message: 'Prenotazione non trovata'
      });
    }
    
    // Verifica che lo stato attuale sia "Confermato"
    if (prenotazione.stato !== 'Confermato') {
      return res.status(400).json({
        status: 'error',
        message: `Impossibile segnare come pronta per il ritiro una prenotazione nello stato ${prenotazione.stato}`
      });
    }
    
    // Prepara il nuovo stato e la transizione
    const nuovoStato = 'ProntoPerRitiro';
    const timestamp = new Date().toISOString();
    
    // Costruisci o aggiorna l'array delle transizioni
    let transizioni = [];
    if (prenotazione.transizioni_stato) {
      try {
        transizioni = JSON.parse(prenotazione.transizioni_stato);
      } catch (e) {
        console.error('Errore nel parsing delle transizioni di stato:', e);
      }
    }
    
    // Aggiungi la nuova transizione
    transizioni.push({
      da: prenotazione.stato,
      a: nuovoStato,
      timestamp,
      utente_id: req.user.id,
      note: note || null
    });
    
    // Aggiorna la prenotazione
    await db.run(
      `UPDATE Prenotazioni 
       SET stato = ?, 
           updated_at = ?, 
           note = CASE WHEN ? IS NOT NULL THEN ? ELSE note END,
           transizioni_stato = ?
       WHERE id = ?`,
      [
        nuovoStato,
        timestamp,
        note,
        note,
        JSON.stringify(transizioni),
        prenotazioneId
      ]
    );
    
    // Recupera la prenotazione aggiornata per la risposta
    const prenotazioneAggiornata = await db.get('SELECT * FROM Prenotazioni WHERE id = ?', [prenotazioneId]);
    
    // Genera notifiche
    await generaNotificheProntoPerRitiro(prenotazioneId, prenotazioneAggiornata, note || '');
    
    return res.status(200).json({
      status: 'success',
      message: 'Prenotazione segnata come pronta per il ritiro',
      data: prenotazioneAggiornata
    });
  } catch (err) {
    console.error('Errore durante l\'aggiornamento della prenotazione a pronta per ritiro:', err);
    next(err);
  }
};

/**
 * Genera notifiche per la transizione a "Pronto per Ritiro"
 * @param {number} id - ID della prenotazione
 * @param {Object} prenotazione - Oggetto prenotazione
 * @param {string} note - Note aggiuntive
 */
async function generaNotificheProntoPerRitiro(id, prenotazione, note) {
  try {
    // Recupera informazioni sul lotto
    const lotto = await db.get('SELECT * FROM Lotti WHERE id = ?', [prenotazione.lotto_id]);
    if (!lotto) {
      console.error(`Lotto non trovato per la prenotazione ${id}`);
      return;
    }
    
    // Recupera informazioni sui centri
    const centroOrigine = await db.get('SELECT * FROM Tipo_Utente WHERE id = ?', [lotto.tipo_utente_origine_id]);
    const centroRicevente = await db.get('SELECT * FROM Tipo_Utente WHERE id = ?', [prenotazione.tipo_utente_ricevente_id]);
    
    if (!centroOrigine || !centroRicevente) {
      console.error(`Informazioni centro mancanti per la prenotazione ${id}`);
      return;
    }
    
    // Crea una notifica per il centro ricevente
    if (centroRicevente.attore_id) {
      await db.run(
        `INSERT INTO Notifiche (tipo, utente_id, titolo, descrizione, data_creazione, letto, azione_richiesta, riferimento_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'prenotazione_pronta',
          centroRicevente.attore_id,
          'Prenotazione pronta per il ritiro',
          `Il lotto "${lotto.prodotto}" è ora pronto per essere ritirato da ${centroOrigine.tipo}. ${note ? `Note: ${note}` : ''}`,
          new Date().toISOString(),
          0,
          'visualizza_prenotazione',
          id
        ]
      );
      
      console.log(`Notifica "pronto per ritiro" creata per centro ricevente ${centroRicevente.tipo}`);
    } else {
      console.warn(`Nessun attore associato al centro ricevente ID: ${centroRicevente.id}`);
    }
    
  } catch (err) {
    console.error('Errore nella generazione delle notifiche "pronto per ritiro":', err);
  }
}

// Aggiungi la funzione di registrazione del ritiro
/**
 * Registra il ritiro effettivo di un lotto prenotato
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const registraRitiro = async (req, res, next) => {
  try {
    const prenotazioneId = parseInt(req.params.id);
    const { ritirato_da, documento_ritiro, note_ritiro } = req.body;
    
    // Validazione dati minimi richiesti
    if (!ritirato_da) {
      return res.status(400).json({
        status: 'error',
        message: 'È necessario specificare il nome di chi ritira il lotto'
      });
    }
    
    // Recupera la prenotazione corrente
    const prenotazione = await db.get('SELECT * FROM Prenotazioni WHERE id = ?', [prenotazioneId]);
    
    if (!prenotazione) {
      return res.status(404).json({
        status: 'error',
        message: 'Prenotazione non trovata'
      });
    }
    
    // Verifica che lo stato attuale permetta il ritiro (ProntoPerRitiro o Confermato)
    if (prenotazione.stato !== 'ProntoPerRitiro' && prenotazione.stato !== 'Confermato') {
      return res.status(400).json({
        status: 'error',
        message: `Impossibile registrare il ritiro di una prenotazione nello stato ${prenotazione.stato}`
      });
    }
    
    // Prepara il nuovo stato e la transizione
    const nuovoStato = 'Consegnato'; // Modificato: cambiamo direttamente a Consegnato invece di InTransito
    const timestamp = new Date().toISOString();
    
    // Costruisci o aggiorna l'array delle transizioni
    let transizioni = [];
    if (prenotazione.transizioni_stato) {
      try {
        transizioni = JSON.parse(prenotazione.transizioni_stato);
      } catch (e) {
        console.error('Errore nel parsing delle transizioni di stato:', e);
      }
    }
    
    // Aggiungi la nuova transizione
    transizioni.push({
      da: prenotazione.stato,
      a: nuovoStato,
      timestamp,
      utente_id: req.user.id,
      operazione: 'ritiro',
      ritirato_da,
      documento_ritiro,
      note: note_ritiro || null
    });
    
    // Aggiorna la prenotazione
    await db.run(
      `UPDATE Prenotazioni 
       SET stato = ?, 
           updated_at = ?, 
           data_ritiro_effettivo = ?,
           ritirato_da = ?,
           documento_ritiro = ?,
           note_ritiro = ?,
           operatore_ritiro = ?,
           transizioni_stato = ?,
           data_consegna = ?  /* Aggiungiamo la data di consegna che corrisponde alla data di ritiro effettivo */
       WHERE id = ?`,
      [
        nuovoStato,
        timestamp,
        timestamp,
        ritirato_da,
        documento_ritiro || null,
        note_ritiro || null,
        req.user.id,
        JSON.stringify(transizioni),
        timestamp,  /* Nuova data di consegna */
        prenotazioneId
      ]
    );
    
    // Recupera la prenotazione aggiornata per la risposta
    const prenotazioneAggiornata = await db.get('SELECT * FROM Prenotazioni WHERE id = ?', [prenotazioneId]);
    
    // Genera notifiche
    await generaNotificheRitiro(prenotazioneId, prenotazioneAggiornata, note_ritiro || '');
    
    return res.status(200).json({
      status: 'success',
      message: 'Ritiro del lotto completato con successo',
      data: prenotazioneAggiornata
    });
  } catch (err) {
    console.error('Errore durante la registrazione del ritiro:', err);
    next(err);
  }
};

/**
 * Genera notifiche per il ritiro di una prenotazione
 * @param {number} id - ID della prenotazione
 * @param {Object} prenotazione - Oggetto prenotazione
 * @param {string} note - Note aggiuntive
 */
async function generaNotificheRitiro(id, prenotazione, note) {
  try {
    // Recupera informazioni sul lotto
    const lotto = await db.get('SELECT * FROM Lotti WHERE id = ?', [prenotazione.lotto_id]);
    if (!lotto) {
      console.error(`Lotto non trovato per la prenotazione ${id}`);
      return;
    }
    
    // Recupera informazioni sui centri
    const centroOrigine = await db.get('SELECT * FROM Tipo_Utente WHERE id = ?', [lotto.tipo_utente_origine_id]);
    const centroRicevente = await db.get('SELECT * FROM Tipo_Utente WHERE id = ?', [prenotazione.tipo_utente_ricevente_id]);
    
    if (!centroOrigine || !centroRicevente) {
      console.error(`Informazioni centro mancanti per la prenotazione ${id}`);
      return;
    }
    
    // Crea una notifica per il centro di origine
    await db.run(
      `INSERT INTO Notifiche (tipo, utente_id, titolo, descrizione, data_creazione, letto, azione_richiesta, riferimento_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'prenotazione_consegnata', // Modificato da "prenotazione_ritirata" a "prenotazione_consegnata"
        centroOrigine.attore_id,
        'Lotto consegnato', // Modificato da "Prenotazione ritirata" a "Lotto consegnato"
        `Il lotto "${lotto.prodotto}" è stato consegnato a ${prenotazione.ritirato_da} per conto di ${centroRicevente.tipo}. ${note ? `Note: ${note}` : ''}`,
        new Date().toISOString(),
        0,
        'visualizza_prenotazione',
        id
      ]
    );
    
    console.log(`Notifica "consegna" creata per centro origine ${centroOrigine.tipo}`);
    
    // Crea anche una notifica per l'amministratore del centro ricevente
    if (centroRicevente.attore_id) {
      await db.run(
        `INSERT INTO Notifiche (tipo, utente_id, titolo, descrizione, data_creazione, letto, azione_richiesta, riferimento_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'prenotazione_consegnata', // Modificato da "prenotazione_ritirata" a "prenotazione_consegnata"
          centroRicevente.attore_id,
          'Lotto ricevuto', // Modificato da "Lotto ritirato" a "Lotto ricevuto"
          `Il lotto "${lotto.prodotto}" è stato ricevuto da ${prenotazione.ritirato_da}. ${note ? `Note: ${note}` : ''}`,
          new Date().toISOString(),
          0,
          'visualizza_prenotazione',
          id
        ]
      );
    }
    
  } catch (err) {
    console.error('Errore nella generazione delle notifiche di ritiro:', err);
  }
}

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
  cleanupDuplicatePrenotazioni,
  segnaComeProntoPerRitiro,
  registraRitiro
}; 