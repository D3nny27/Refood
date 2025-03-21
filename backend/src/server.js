const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const compression = require('compression');
const path = require('path');

// Caricamento delle variabili d'ambiente
dotenv.config();

const logger = require('./utils/logger');
const swaggerSetup = require('./utils/swagger');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');
const scheduler = require('./utils/scheduler');

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

// Avvio del server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server avviato sulla porta ${PORT} in modalità ${process.env.NODE_ENV || 'development'}`);
  logger.info(`API disponibili su http://localhost:${PORT}${API_PREFIX}`);
  logger.info(`Documentazione API su http://localhost:${PORT}/api-docs`);
  
  // Inizializza lo scheduler per le attività pianificate
  scheduler.init();
});

// Gestione della chiusura graziosa
process.on('SIGTERM', () => {
  logger.info('Ricevuto segnale SIGTERM. Chiusura del server...');
  
  // Arresta lo scheduler
  scheduler.stop();
  
  server.close(() => {
    logger.info('Server chiuso correttamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Ricevuto segnale SIGINT. Chiusura del server...');
  
  // Arresta lo scheduler
  scheduler.stop();
  
  server.close(() => {
    logger.info('Server chiuso correttamente');
    process.exit(0);
  });
});

module.exports = app; 