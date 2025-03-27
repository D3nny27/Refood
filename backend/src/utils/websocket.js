const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const db = require('../config/database');

/**
 * Enum per i tipi di eventi WebSocket
 */
const WebSocketEvent = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  MESSAGE: 'message',
  ERROR: 'error',
  NOTIFICATION: 'notification',
  LOTTO_UPDATE: 'lotto_update',
  PRENOTAZIONE_UPDATE: 'prenotazione_update'
};

class WebSocketService {
  constructor() {
    this.clients = new Map(); // Map<userId, WebSocket[]>
    this.server = null;
    this.pingInterval = null;
  }

  /**
   * Inizializza il server WebSocket
   * @param {http.Server} httpServer - Il server HTTP di Express
   */
  init(httpServer) {
    logger.info('Inizializzazione del servizio WebSocket');
    
    // Crea un server WebSocket collegato al server HTTP
    this.server = new WebSocket.Server({
      server: httpServer,
      path: '/api/notifications/ws'
    });

    // Gestione delle connessioni
    this.server.on('connection', (ws, req) => this.handleConnection(ws, req));
    
    // Avvia il ping dei client per mantenere attive le connessioni
    this.pingInterval = setInterval(() => this.pingClients(), 30000);
    
    logger.info('Servizio WebSocket inizializzato con successo');
  }

  /**
   * Gestisce una nuova connessione WebSocket
   * @param {WebSocket} ws - Oggetto WebSocket
   * @param {http.IncomingMessage} req - Richiesta HTTP
   */
  async handleConnection(ws, req) {
    try {
      // Estrae il token JWT dal query parameter
      const params = url.parse(req.url, true).query;
      const token = params.token;
      
      if (!token) {
        this.sendErrorAndClose(ws, 'Token non fornito');
        return;
      }
      
      // Verifica il token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        this.sendErrorAndClose(ws, 'Token non valido');
        return;
      }
      
      // Verifica che il token non sia revocato
      const tokenValido = await this.verificaToken(token);
      if (!tokenValido) {
        this.sendErrorAndClose(ws, 'Token revocato o scaduto');
        return;
      }
      
      const userId = decoded.id;
      
      // Salva il client nella mappa
      if (!this.clients.has(userId)) {
        this.clients.set(userId, []);
      }
      this.clients.get(userId).push(ws);
      
      // Salva l'ID attore nel WebSocket per riferimento futuro
      ws.userId = userId;
      
      logger.info(`Nuova connessione WebSocket stabilita per l'attore ID: ${userId}`);
      
      // Invia un messaggio di conferma connessione
      this.sendMessage(ws, {
        type: WebSocketEvent.CONNECT,
        payload: { message: 'Connessione stabilita' },
        timestamp: Date.now()
      });
      
      // Gestione messaggi dal client
      ws.on('message', (message) => this.handleMessage(ws, message));
      
      // Gestione chiusura connessione
      ws.on('close', () => this.handleClose(ws));
      
      // Gestione errori
      ws.on('error', (error) => {
        logger.error(`Errore WebSocket per l'attore ${userId}: ${error.message}`);
        this.handleClose(ws);
      });
      
    } catch (error) {
      logger.error(`Errore nella gestione della connessione WebSocket: ${error.message}`);
      this.sendErrorAndClose(ws, 'Errore interno del server');
    }
  }

  /**
   * Verifica che il token non sia stato revocato
   * @param {string} token - Token JWT da verificare
   * @returns {Promise<boolean>} True se il token è valido
   */
  async verificaToken(token) {
    try {
      const row = await db.get(`
        SELECT 1
        FROM TokenAutenticazione 
        WHERE access_token = ? 
        AND access_token_scadenza > datetime('now')
        AND revocato = 0
      `, [token]);
      
      return !!row; // Converte in booleano
    } catch (error) {
      logger.error(`Errore nella verifica del token: ${error.message}`);
      return false;
    }
  }

  /**
   * Invia un messaggio di errore e chiude la connessione
   * @param {WebSocket} ws - WebSocket client
   * @param {string} message - Messaggio di errore
   */
  sendErrorAndClose(ws, message) {
    this.sendMessage(ws, {
      type: WebSocketEvent.ERROR,
      payload: { message },
      timestamp: Date.now()
    });
    
    ws.close();
  }

  /**
   * Gestisce i messaggi in arrivo dai client
   * @param {WebSocket} ws - WebSocket client
   * @param {string} message - Messaggio ricevuto
   */
  handleMessage(ws, message) {
    try {
      // Gestisce solo messaggi di tipo ping per mantenere attiva la connessione
      const data = JSON.parse(message);
      
      if (data.type === 'ping') {
        this.sendMessage(ws, {
          type: 'pong',
          timestamp: Date.now()
        });
      }
      
      // Altri tipi di messaggi possono essere implementati qui
      
    } catch (error) {
      logger.error(`Errore nel parsing del messaggio WebSocket: ${error.message}`);
    }
  }

  /**
   * Gestisce la chiusura di una connessione
   * @param {WebSocket} ws - WebSocket client
   */
  handleClose(ws) {
    const userId = ws.userId;
    if (!userId) return;
    
    logger.info(`Chiusura connessione WebSocket per l'attore ID: ${userId}`);
    
    // Rimuove il client dalla mappa
    if (this.clients.has(userId)) {
      const userClients = this.clients.get(userId);
      const index = userClients.indexOf(ws);
      
      if (index !== -1) {
        userClients.splice(index, 1);
      }
      
      // Se non ci sono più client per questo attore, rimuove l'attore dalla mappa
      if (userClients.length === 0) {
        this.clients.delete(userId);
      }
    }
  }

  /**
   * Invia un messaggio ping a tutti i client per mantenere attive le connessioni
   */
  pingClients() {
    for (const [userId, clients] of this.clients.entries()) {
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          this.sendMessage(client, {
            type: 'ping',
            timestamp: Date.now()
          });
        }
      }
    }
  }

  /**
   * Invia un messaggio a un client
   * @param {WebSocket} ws - WebSocket client
   * @param {object} data - Dati da inviare
   */
  sendMessage(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Invia una notifica a un attore specifico tramite WebSocket
   * @param {number} userId - ID dell'attore destinatario
   * @param {object} notifica - Oggetto con i dati della notifica
   */
  async inviaNotifica(userId, notifica) {
    try {
      logger.info(`Tentativo di inviare notifica WebSocket a attore ${userId}: ${JSON.stringify(notifica)}`);
      
      if (!userId || !notifica) {
        logger.error(`Parametri invalidi per inviaNotifica: userId=${userId}, notifica=${notifica ? 'presente' : 'assente'}`);
        return;
      }
      
      // Cerca tutte le connessioni dell'attore
      const userConnections = [...this.clients.values()].filter(client => 
        client.authenticated && client.userId === userId);
      
      if (userConnections.length === 0) {
        logger.warn(`Nessuna connessione WebSocket attiva per l'attore ${userId}, notifica non inviata via WebSocket`);
        return;
      }
      
      // Prepara il messaggio
      const message = {
        type: 'notification',
        payload: notifica,
        timestamp: Date.now()
      };
      
      // Invia a tutte le connessioni dell'attore
      let sentCount = 0;
      for (const ws of userConnections) {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            this.sendMessage(ws, message);
            sentCount++;
            logger.info(`Notifica WebSocket inviata a attore ${userId} (connessione ${ws.id})`);
          } catch (err) {
            logger.error(`Errore nell'invio della notifica a attore ${userId} (connessione ${ws.id}): ${err.message}`);
          }
        } else {
          logger.warn(`Connessione ${ws.id} dell'attore ${userId} non è aperta (stato: ${ws.readyState})`);
        }
      }
      
      logger.info(`Notifica inviata a ${sentCount}/${userConnections.length} connessioni dell'attore ${userId}`);
    } catch (error) {
      logger.error(`Errore generale nell'invio della notifica WebSocket: ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
    }
  }

  /**
   * Invia un aggiornamento dello stato di un lotto a tutti gli utenti interessati
   * @param {object} lotto - Dati del lotto aggiornato
   * @param {number[]} userIds - Array di ID utenti a cui notificare (se vuoto, notifica a tutti)
   */
  notificaAggiornamentoLotto(lotto, userIds = []) {
    this.broadcastMessage({
      type: WebSocketEvent.LOTTO_UPDATE,
      payload: lotto,
      timestamp: Date.now()
    }, userIds);
  }

  /**
   * Invia un aggiornamento dello stato di una prenotazione agli utenti interessati
   * @param {object} prenotazione - Dati della prenotazione aggiornata
   * @param {number[]} userIds - Array di ID utenti a cui notificare
   */
  notificaAggiornamentoPrenotazione(prenotazione, userIds = []) {
    this.broadcastMessage({
      type: WebSocketEvent.PRENOTAZIONE_UPDATE,
      payload: prenotazione,
      timestamp: Date.now()
    }, userIds);
  }

  /**
   * Invia un messaggio broadcast a tutti gli utenti selezionati o a tutti se userIds è vuoto
   * @param {object} message - Messaggio da inviare
   * @param {number[]} userIds - Array di ID utenti (opzionale)
   */
  broadcastMessage(message, userIds = []) {
    if (userIds.length > 0) {
      // Invia solo agli utenti specificati
      for (const userId of userIds) {
        if (this.clients.has(userId)) {
          const clients = this.clients.get(userId);
          for (const client of clients) {
            this.sendMessage(client, message);
          }
        }
      }
    } else {
      // Invia a tutti gli utenti connessi
      for (const clients of this.clients.values()) {
        for (const client of clients) {
          this.sendMessage(client, message);
        }
      }
    }
  }

  /**
   * Chiude tutte le connessioni e ferma il server
   */
  stop() {
    logger.info('Arresto del servizio WebSocket');
    
    // Ferma il ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Chiude tutte le connessioni
    for (const clients of this.clients.values()) {
      for (const client of clients) {
        client.close();
      }
    }
    
    // Svuota la mappa dei client
    this.clients.clear();
    
    // Chiude il server
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    
    logger.info('Servizio WebSocket arrestato con successo');
  }
}

// Esporta una singola istanza (singleton)
module.exports = new WebSocketService(); 