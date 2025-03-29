const express = require('express');
const { body, param, query } = require('express-validator');
const validator = require('../middlewares/validator');
const { authenticate, authorize, belongsToTipoUtente, authMiddleware, isAuthorized } = require('../middlewares/auth');
const prenotazioniController = require('../controllers/prenotazioni.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Prenotazioni
 *   description: Endpoints per la gestione delle prenotazioni dei lotti alimentari
 */

/**
 * @swagger
 * /prenotazioni:
 *   get:
 *     summary: Ottieni elenco prenotazioni
 *     description: Restituisce l'elenco delle prenotazioni filtrato in base ai parametri
 *     tags: [Prenotazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: stato
 *         schema:
 *           type: string
 *           enum: [Prenotato, InTransito, Consegnato, Annullato]
 *         description: Filtra per stato
 *       - in: query
 *         name: centro
 *         schema:
 *           type: integer
 *         description: Filtra per ID del centro ricevente
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Pagina dei risultati 
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Numero di risultati per pagina
 *     responses:
 *       200:
 *         description: Lista di prenotazioni
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 */
router.get('/', authenticate, prenotazioniController.getPrenotazioni);

/**
 * @swagger
 * /prenotazioni/{id}:
 *   get:
 *     summary: Ottieni dettagli di una prenotazione
 *     tags: [Prenotazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della prenotazione
 *     responses:
 *       200:
 *         description: Dettagli della prenotazione
 *       404:
 *         description: Prenotazione non trovata
 */
router.get('/:id', [
  authenticate,
  param('id').isInt().withMessage('ID prenotazione deve essere un numero intero'),
  validator.validate
], prenotazioniController.getPrenotazioneById);

/**
 * @swagger
 * /prenotazioni:
 *   post:
 *     summary: Crea una nuova prenotazione
 *     tags: [Prenotazioni]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lotto_id
 *             properties:
 *               lotto_id:
 *                 type: integer
 *               note:
 *                 type: string
 *               data_ritiro:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Prenotazione creata con successo
 *       400:
 *         description: Dati non validi
 *       404:
 *         description: Lotto o tipo utente non trovato
 *       409:
 *         description: Lotto già prenotato o non disponibile
 */
router.post('/', [
  authenticate,
  authorize(['TipoUtenteSociale', 'TipoUtenteRiciclaggio', 'Amministratore']),
  body('lotto_id').isInt().withMessage('ID lotto deve essere un numero intero'),
  body('note').optional().isString().withMessage('Note deve essere una stringa'),
  body('data_ritiro').optional().isISO8601().withMessage('Data ritiro deve essere una data valida'),
  validator.validate
], prenotazioniController.createPrenotazione);

/**
 * @swagger
 * /prenotazioni/{id}:
 *   put:
 *     summary: Aggiorna lo stato di una prenotazione
 *     tags: [Prenotazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della prenotazione
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stato
 *             properties:
 *               stato:
 *                 type: string
 *                 enum: [Prenotato, InTransito, Consegnato, Annullato]
 *               data_ritiro:
 *                 type: string
 *                 format: date-time
 *               data_consegna:
 *                 type: string
 *                 format: date-time
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Prenotazione aggiornata con successo
 *       400:
 *         description: Dati non validi
 *       404:
 *         description: Prenotazione non trovata
 */
router.put('/:id', [
  authenticate,
  param('id').isInt().withMessage('ID prenotazione deve essere un numero intero'),
  body('stato').isIn(['Prenotato', 'InTransito', 'Consegnato', 'Annullato']).withMessage('Stato non valido'),
  body('data_ritiro').optional().isISO8601().withMessage('Data ritiro deve essere una data valida'),
  body('data_consegna').optional().isISO8601().withMessage('Data consegna deve essere una data valida'),
  body('note').optional().isString().withMessage('Note deve essere una stringa'),
  validator.validate
], prenotazioniController.updatePrenotazione);

/**
 * @swagger
 * /prenotazioni/{id}/trasporto:
 *   post:
 *     summary: Registra informazioni sul trasporto per una prenotazione
 *     tags: [Prenotazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della prenotazione
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mezzo
 *             properties:
 *               mezzo:
 *                 type: string
 *               distanza_km:
 *                 type: number
 *               autista:
 *                 type: string
 *               telefono_autista:
 *                 type: string
 *               orario_partenza:
 *                 type: string
 *                 format: date-time
 *               orario_arrivo:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Informazioni sul trasporto registrate con successo
 *       400:
 *         description: Dati non validi
 *       404:
 *         description: Prenotazione non trovata
 */
router.post('/:id/trasporto', [
  authenticate,
  param('id').isInt().withMessage('ID prenotazione deve essere un numero intero'),
  body('mezzo').isString().withMessage('Mezzo deve essere specificato'),
  body('distanza_km').optional().isFloat({ min: 0 }).withMessage('Distanza deve essere un numero positivo'),
  body('autista').optional().isString().withMessage('Nome autista deve essere una stringa'),
  body('telefono_autista').optional().isString().withMessage('Telefono autista deve essere una stringa'),
  body('orario_partenza').optional().isISO8601().withMessage('Orario partenza deve essere una data valida'),
  body('orario_arrivo').optional().isISO8601().withMessage('Orario arrivo deve essere una data valida'),
  validator.validate
], prenotazioniController.addTrasporto);

/**
 * @swagger
 * /prenotazioni/{id}/annulla:
 *   post:
 *     summary: Annulla una prenotazione
 *     tags: [Prenotazioni]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della prenotazione
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *                 description: Motivo dell'annullamento
 *     responses:
 *       200:
 *         description: Prenotazione annullata con successo
 *       401:
 *         description: Non autorizzato
 *       403:
 *         description: Permessi insufficienti
 *       404:
 *         description: Prenotazione non trovata
 */
router.post('/:id/annulla', authenticate, prenotazioniController.cancelPrenotazione);

/**
 * @swagger
 * /prenotazioni/{id}/accetta:
 *   put:
 *     summary: Accetta una prenotazione
 *     tags: [Prenotazioni]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della prenotazione
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data_ritiro_prevista:
 *                 type: string
 *                 format: date
 *                 description: Data prevista per il ritiro del lotto
 *     responses:
 *       200:
 *         description: Prenotazione accettata con successo
 *       400:
 *         description: La prenotazione non può essere accettata nello stato corrente
 *       401:
 *         description: Non autorizzato
 *       403:
 *         description: Permessi insufficienti
 *       404:
 *         description: Prenotazione non trovata
 */
router.put('/:id/accetta', authenticate, prenotazioniController.accettaPrenotazione);

/**
 * @swagger
 * /prenotazioni/{id}/rifiuta:
 *   put:
 *     summary: Rifiuta una prenotazione
 *     tags: [Prenotazioni]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della prenotazione
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *                 description: Motivo del rifiuto
 *     responses:
 *       200:
 *         description: Prenotazione rifiutata con successo
 *       400:
 *         description: La prenotazione non può essere rifiutata nello stato corrente
 *       401:
 *         description: Non autorizzato
 *       403:
 *         description: Permessi insufficienti
 *       404:
 *         description: Prenotazione non trovata
 */
router.put('/:id/rifiuta', authenticate, prenotazioniController.rifiutaPrenotazione);

/**
 * @swagger
 * /prenotazioni/centro/{tipo_utente_id}:
 *   get:
 *     summary: Ottieni prenotazioni di un centro specifico
 *     tags: [Prenotazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tipo_utente_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *       - in: query
 *         name: stato
 *         schema:
 *           type: string
 *           enum: [Prenotato, InTransito, Consegnato, Annullato]
 *         description: Filtra per stato
 *     responses:
 *       200:
 *         description: Lista di prenotazioni del centro
 *       404:
 *         description: TipoUtente non trovato
 */
router.get('/centro/:tipo_utente_id', [
  authenticate,
  param('tipo_utente_id').isInt().withMessage('ID centro deve essere un numero intero'),
  query('stato').optional().isIn(['Prenotato', 'InTransito', 'Consegnato', 'Annullato']).withMessage('Stato non valido'),
  validator.validate,
  belongsToTipoUtente(req => req.params.tipo_utente_id)
], prenotazioniController.getPrenotazioniByTipoUtente);

// Aggiungo la nuova rotta per la pulizia delle prenotazioni duplicate
// Questa rotta dovrebbe essere accessibile solo agli amministratori
router.post('/cleanup-duplicates', authenticate, authorize(['Amministratore']), prenotazioniController.cleanupDuplicatePrenotazioni);

module.exports = router; 