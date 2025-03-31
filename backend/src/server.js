const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const compression = require('compression');
const path = require('path');
const http = require('http');

// Caricamento delle variabili d'ambiente
dotenv.config();

const logger = require('./utils/logger');
const swaggerSetup = require('./utils/swagger');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');
const scheduler = require('./utils/scheduler');
const websocket = require('./utils/websocket');

// Importa il modulo di configurazione automatica del sistema di monitoraggio schema
const schemaMonitor = require('./init/schema_autosetup');

// Inizializzazione app Express
const app = express();

// Middleware di sicurezza
app.use(helmet());

// Configurazione CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compressione delle risposte
app.use(compression());

// Parsing del body JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging delle richieste con Morgan
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

// API paths
const API_PREFIX = process.env.API_PREFIX || '/api';
app.use(API_PREFIX, routes);

// Documentazione Swagger
swaggerSetup(app);

// Servire risorse statiche (se necessario)
app.use('/static', express.static(path.join(__dirname, '../public')));

// Gestione degli errori
app.use(errorHandler);

// Rotta 404 per risorse non trovate
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Risorsa non trovata'
  });
});

// Creazione server HTTP
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Inizializzazione del server e database
async function startServer() {
  try {
    // Verifica e configura automaticamente il sistema di monitoraggio schema
    await schemaMonitor.configureMonitoringSystem();
    
    // Avvia il server
    server.listen(PORT, () => {
      logger.info(`Server avviato sulla porta ${PORT} in modalità ${process.env.NODE_ENV || 'development'}`);
      logger.info(`API disponibili su http://localhost:${PORT}${API_PREFIX}`);
      logger.info(`Documentazione API su http://localhost:${PORT}/api-docs`);
      
      // Inizializza lo scheduler per le attività pianificate
      scheduler.init();
      
      // Inizializza il servizio WebSocket
      websocket.init(server);
      
      logger.info(`WebSocket disponibile su ws://localhost:${PORT}/api/notifications/ws`);
    });
  } catch (error) {
    console.error(`Errore durante l'avvio del server: ${error.message}`);
    process.exit(1);
  }
}

// Avvia il server
startServer();

// Gestione della chiusura graziosa
process.on('SIGTERM', () => {
  logger.info('Ricevuto segnale SIGTERM. Chiusura del server...');
  
  // Arresta lo scheduler
  scheduler.stop();
  
  // Arresta il servizio WebSocket
  websocket.stop();
  
  server.close(() => {
    logger.info('Server chiuso correttamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Ricevuto segnale SIGINT. Chiusura del server...');
  
  // Arresta lo scheduler
  scheduler.stop();
  
  // Arresta il servizio WebSocket
  websocket.stop();
  
  server.close(() => {
    logger.info('Server chiuso correttamente');
    process.exit(0);
  });
});

module.exports = app; 