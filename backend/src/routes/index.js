const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const attoreRoutes = require('./attore.routes');
const tipoUtenteRoutes = require('./tipo_utente.routes');
const centriRedirectRoutes = require('./centri_redirect.js');
const lottiRoutes = require('./lotti.routes');
const prenotazioniRoutes = require('./prenotazioni.routes');
const notificheRoutes = require('./notifiche.routes');
const statisticheRoutes = require('./statistiche.routes');
const { ApiError } = require('../middlewares/errorHandler');

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health check
 *     description: Verifica che l'API sia attiva
 *     responses:
 *       200:
 *         description: L'API è attiva e funzionante
 */
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'ReFood API v1',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /health-check:
 *   get:
 *     summary: Verifica lo stato dell'API
 *     description: Endpoint per verificare che l'API sia in funzione
 *     responses:
 *       200:
 *         description: API funzionante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
router.get('/health-check', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

/**
 * @swagger
 * /debug/database:
 *   get:
 *     summary: Verifica lo stato della connessione al database
 *     description: Endpoint per verificare che il database sia accessibile e funzionante
 *     responses:
 *       200:
 *         description: Informazioni sul database
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 dbPath:
 *                   type: string
 *                 tables:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/debug/database', async (req, res) => {
  try {
    // Test di connessione
    const connectionTest = await db.testConnection();
    
    // Recupera l'elenco delle tabelle
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
    
    // Recupera il numero di lotti
    const lottiCount = await db.get("SELECT COUNT(*) as count FROM Lotti");
    
    res.json({ 
      status: connectionTest ? 'ok' : 'error',
      dbPath: process.env.DB_PATH,
      tables: tables.map(t => t.name),
      lottiCount: lottiCount ? lottiCount.count : 0,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error', 
      message: `Errore nella verifica del database: ${err.message}`,
      timestamp: new Date()
    });
  }
});

// Rotte autenticazione
router.use('/auth', authRoutes);

// Rotte attori
router.use('/attori', attoreRoutes);

// Rotte tipi utente (precedentemente centri)
router.use('/tipi-utente', tipoUtenteRoutes);

// Reindirizzamento temporaneo dalle vecchie rotte
router.use('/centri', centriRedirectRoutes);

// Rotte lotti
router.use('/lotti', lottiRoutes);

// Rotte prenotazioni
router.use('/prenotazioni', prenotazioniRoutes);

// Rotte notifiche
router.use('/notifiche', notificheRoutes);

// Rotte statistiche
router.use('/statistiche', statisticheRoutes);

// Errore 404
router.use((req, res, next) => {
  next(new ApiError(404, 'Risorsa non trovata'));
});

// Middleware per la gestione degli errori
router.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Errore interno del server';
  
  // Log errore
  console.error(`[ERROR] ${statusCode} - ${message}`);
  if (err.stack) {
    console.error(err.stack);
  }
  
  res.status(statusCode).json({
    status: 'error',
    message
  });
});

module.exports = router; 