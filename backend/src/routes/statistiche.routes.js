const express = require('express');
const { query } = require('express-validator');
const validator = require('../middlewares/validator');
const { authenticate, authorize } = require('../middlewares/auth');
const statisticheController = require('../controllers/statistiche.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Statistiche
 *   description: Endpoints per ottenere statistiche e reportistica del sistema
 */

/**
 * @swagger
 * /statistiche/counters:
 *   get:
 *     summary: Ottieni contatori generali del sistema
 *     description: Restituisce contatori generali delle entità principali del sistema
 *     tags: [Statistiche]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contatori del sistema
 */
router.get('/counters', authenticate, statisticheController.getCounters);

/**
 * @swagger
 * /statistiche/impatto:
 *   get:
 *     summary: Ottiene le statistiche di impatto del sistema
 *     description: Restituisce le statistiche di impatto ambientale ed economico del sistema
 *     tags: [Statistiche]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiche di impatto ottenute con successo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 co2_risparmiata_kg:
 *                   type: number
 *                 valore_economico_risparmiato:
 *                   type: number
 *                 cibo_salvato_kg:
 *                   type: number
 *                 acqua_risparmiata_litri:
 *                   type: number
 *                 terreno_risparmiato_mq:
 *                   type: number
 *                 lotti_salvati:
 *                   type: integer
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.get('/impatto', authenticate, statisticheController.getImpatto);

module.exports = router; 