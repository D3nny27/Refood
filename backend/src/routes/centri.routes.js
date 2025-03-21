const express = require('express');
const { body, param, query } = require('express-validator');
const validator = require('../middlewares/validator');
const { authenticate, authorize } = require('../middlewares/auth');
const centriController = require('../controllers/centri.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Centri
 *   description: Endpoints per la gestione dei centri che partecipano al sistema
 */

/**
 * @swagger
 * /centri:
 *   get:
 *     summary: Ottieni elenco centri
 *     description: Restituisce l'elenco dei centri filtrato in base ai parametri
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         description: Filtra per tipo di centro
 *       - in: query
 *         name: nome
 *         schema:
 *           type: string
 *         description: Filtra per nome del centro
 *       - in: query
 *         name: raggio
 *         schema:
 *           type: number
 *         description: Raggio di ricerca in km
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitudine per ricerca geografica
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Longitudine per ricerca geografica
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
 *         description: Lista di centri
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
router.get('/', authenticate, centriController.getCentri);

/**
 * @swagger
 * /centri/{id}:
 *   get:
 *     summary: Ottieni dettagli di un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *     responses:
 *       200:
 *         description: Dettagli del centro
 *       404:
 *         description: Centro non trovato
 */
router.get('/:id', [
  authenticate,
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  validator.validate
], centriController.getCentroById);

/**
 * @swagger
 * /centri:
 *   post:
 *     summary: Crea un nuovo centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - tipo_id
 *               - indirizzo
 *             properties:
 *               nome:
 *                 type: string
 *               tipo_id:
 *                 type: integer
 *               indirizzo:
 *                 type: string
 *               telefono:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               latitudine:
 *                 type: number
 *               longitudine:
 *                 type: number
 *               descrizione:
 *                 type: string
 *               orari_apertura:
 *                 type: string
 *     responses:
 *       201:
 *         description: Centro creato con successo
 *       400:
 *         description: Dati non validi
 */
router.post('/', [
  authenticate,
  authorize(['Amministratore']),
  body('nome').isString().isLength({ min: 2 }).withMessage('Nome deve essere una stringa di almeno 2 caratteri'),
  body('tipo_id').isInt().withMessage('Tipo ID deve essere un numero intero'),
  body('indirizzo').isString().withMessage('Indirizzo deve essere una stringa'),
  body('telefono').optional().isString().withMessage('Telefono deve essere una stringa'),
  body('email').optional().isEmail().withMessage('Email non valida'),
  body('latitudine').optional().isFloat().withMessage('Latitudine deve essere un numero'),
  body('longitudine').optional().isFloat().withMessage('Longitudine deve essere un numero'),
  body('descrizione').optional().isString().withMessage('Descrizione deve essere una stringa'),
  body('orari_apertura').optional().isString().withMessage('Orari apertura deve essere una stringa'),
  validator.validate
], centriController.createCentro);

/**
 * @swagger
 * /centri/{id}:
 *   put:
 *     summary: Aggiorna un centro esistente
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               tipo_id:
 *                 type: integer
 *               indirizzo:
 *                 type: string
 *               telefono:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               latitudine:
 *                 type: number
 *               longitudine:
 *                 type: number
 *               descrizione:
 *                 type: string
 *               orari_apertura:
 *                 type: string
 *     responses:
 *       200:
 *         description: Centro aggiornato con successo
 *       400:
 *         description: Dati non validi
 *       404:
 *         description: Centro non trovato
 */
router.put('/:id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  body('nome').optional().isString().isLength({ min: 2 }).withMessage('Nome deve essere una stringa di almeno 2 caratteri'),
  body('tipo_id').optional().isInt().withMessage('Tipo ID deve essere un numero intero'),
  body('indirizzo').optional().isString().withMessage('Indirizzo deve essere una stringa'),
  body('telefono').optional().isString().withMessage('Telefono deve essere una stringa'),
  body('email').optional().isEmail().withMessage('Email non valida'),
  body('latitudine').optional().isFloat().withMessage('Latitudine deve essere un numero'),
  body('longitudine').optional().isFloat().withMessage('Longitudine deve essere un numero'),
  body('descrizione').optional().isString().withMessage('Descrizione deve essere una stringa'),
  body('orari_apertura').optional().isString().withMessage('Orari apertura deve essere una stringa'),
  validator.validate
], centriController.updateCentro);

/**
 * @swagger
 * /centri/{id}:
 *   delete:
 *     summary: Elimina un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *     responses:
 *       200:
 *         description: Centro eliminato con successo
 *       404:
 *         description: Centro non trovato
 *       400:
 *         description: Non è possibile eliminare il centro
 */
router.delete('/:id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  validator.validate
], centriController.deleteCentro);

/**
 * @swagger
 * /centri/tipi:
 *   get:
 *     summary: Ottieni tutti i tipi di centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista dei tipi di centro
 */
router.get('/tipi', authenticate, centriController.getCentriTipi);

/**
 * @swagger
 * /centri/{id}/utenti:
 *   get:
 *     summary: Ottieni gli utenti associati a un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *     responses:
 *       200:
 *         description: Lista degli utenti del centro
 *       404:
 *         description: Centro non trovato
 */
router.get('/:id/utenti', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  validator.validate
], centriController.getCentroUtenti);

/**
 * @swagger
 * /centri/{id}/utenti/{utente_id}:
 *   post:
 *     summary: Associa un utente a un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *       - in: path
 *         name: utente_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dell'utente
 *     responses:
 *       201:
 *         description: Utente associato con successo
 *       404:
 *         description: Centro o utente non trovato
 *       409:
 *         description: Utente già associato al centro
 */
router.post('/:id/utenti/:utente_id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  param('utente_id').isInt().withMessage('ID utente deve essere un numero intero'),
  validator.validate
], centriController.associaUtente);

/**
 * @swagger
 * /centri/{id}/utenti/{utente_id}:
 *   delete:
 *     summary: Rimuovi un utente da un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *       - in: path
 *         name: utente_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dell'utente
 *     responses:
 *       200:
 *         description: Utente rimosso con successo
 *       404:
 *         description: Centro o utente non trovato
 *       400:
 *         description: Utente non associato al centro
 */
router.delete('/:id/utenti/:utente_id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  param('utente_id').isInt().withMessage('ID utente deve essere un numero intero'),
  validator.validate
], centriController.rimuoviUtente);

/**
 * @swagger
 * /centri/{id}/statistiche:
 *   get:
 *     summary: Ottieni statistiche di un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *       - in: query
 *         name: inizio
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inizio periodo (formato YYYY-MM-DD)
 *       - in: query
 *         name: fine
 *         schema:
 *           type: string
 *           format: date
 *         description: Data fine periodo (formato YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Statistiche del centro
 *       404:
 *         description: Centro non trovato
 */
router.get('/:id/statistiche', [
  authenticate,
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  query('inizio').optional().isDate().withMessage('Data inizio deve essere una data valida'),
  query('fine').optional().isDate().withMessage('Data fine deve essere una data valida'),
  validator.validate
], centriController.getCentroStatistiche);

module.exports = router; 