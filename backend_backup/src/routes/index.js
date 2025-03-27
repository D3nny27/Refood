const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const lottiRoutes = require('./lotti.routes');
const prenotazioniRoutes = require('./prenotazioni.routes');
const centriRoutes = require('./centri.routes');
const statisticheRoutes = require('./statistiche.routes');
const notificheRoutes = require('./notifiche.routes');
const db = require('../config/database');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: API
 *   description: Endpoints dell'API Refood per la gestione della piattaforma
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Informazioni sull'API
 *     tags: [API]
 *     responses:
 *       200:
 *         description: Informazioni sulla versione e stato dell'API
 */
router.get('/', (req, res) => {
  res.json({
    app: 'Refood API',
    version: process.env.npm_package_version || '1.0.0',
    status: 'online',
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

// Raggruppa le routes per ciascun modulo
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/lotti', lottiRoutes);
router.use('/prenotazioni', prenotazioniRoutes);
router.use('/centri', centriRoutes);
router.use('/statistiche', statisticheRoutes);
router.use('/notifiche', notificheRoutes);

module.exports = router; 