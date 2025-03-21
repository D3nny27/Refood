const express = require('express');
const notificheController = require('../controllers/notifiche.controller');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Notifiche
 *   description: Endpoints per la gestione delle notifiche
 */

/**
 * @swagger
 * /notifiche:
 *   get:
 *     summary: Ottiene l'elenco delle notifiche per l'utente corrente
 *     tags: [Notifiche]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: letto
 *         schema:
 *           type: boolean
 *         description: Filtra per stato di lettura
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numero di pagina
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Numero di risultati per pagina
 *     responses:
 *       200:
 *         description: Elenco di notifiche
 *       401:
 *         description: Non autenticato
 */
router.get('/', authenticate, notificheController.getNotifiche);

/**
 * @swagger
 * /notifiche/{id}/letto:
 *   put:
 *     summary: Segna una notifica come letta
 *     tags: [Notifiche]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della notifica
 *     responses:
 *       200:
 *         description: Notifica segnata come letta
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Notifica non trovata
 */
router.put('/:id/letto', authenticate, notificheController.segnaComeLetta);

/**
 * @swagger
 * /notifiche/leggi-tutte:
 *   put:
 *     summary: Segna tutte le notifiche come lette
 *     tags: [Notifiche]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tutte le notifiche segnate come lette
 *       401:
 *         description: Non autenticato
 */
router.put('/leggi-tutte', authenticate, notificheController.segnaLeggiTutte);

/**
 * @swagger
 * /notifiche/{id}:
 *   delete:
 *     summary: Elimina una notifica
 *     tags: [Notifiche]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della notifica
 *     responses:
 *       200:
 *         description: Notifica eliminata con successo
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Notifica non trovata
 */
router.delete('/:id', authenticate, notificheController.eliminaNotifica);

module.exports = router; 