const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const validator = require('../middlewares/validator');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Utenti
 *   description: Endpoints per la gestione degli utenti
 */

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Ottiene il profilo dell'utente corrente
 *     tags: [Utenti]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profilo utente
 *       401:
 *         description: Non autenticato
 */
router.get('/profile', authenticate, userController.getProfile);

/**
 * @swagger
 * /users/profile-web:
 *   get:
 *     summary: Ottiene il profilo dell'utente corrente (versione web con cookie)
 *     tags: [Utenti]
 *     responses:
 *       200:
 *         description: Profilo utente
 *       401:
 *         description: Non autenticato
 */
router.get('/profile-web', authenticate, userController.getProfileWeb);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Aggiorna il profilo dell'utente corrente
 *     tags: [Utenti]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               cognome:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Profilo aggiornato con successo
 *       400:
 *         description: Errore di validazione
 *       401:
 *         description: Non autenticato
 */
router.put('/profile', [
  authenticate,
  body('email').optional().isEmail().withMessage('Email non valida'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password deve contenere almeno 6 caratteri'),
  validator.validate
], userController.updateProfile);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Ottiene l'elenco degli utenti
 *     tags: [Utenti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ruolo
 *         schema:
 *           type: string
 *         description: Filtra per ruolo
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
 *         description: Elenco degli utenti
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 */
router.get('/', [
  authenticate,
  authorize('Amministratore')
], userController.getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Ottiene un utente specifico
 *     tags: [Utenti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dell'utente
 *     responses:
 *       200:
 *         description: Dettagli dell'utente
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       404:
 *         description: Utente non trovato
 */
router.get('/:id', [
  authenticate,
  authorize('Amministratore')
], userController.getUserById);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Crea un nuovo utente
 *     tags: [Utenti]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - nome
 *               - cognome
 *               - ruolo
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               nome:
 *                 type: string
 *               cognome:
 *                 type: string
 *               ruolo:
 *                 type: string
 *                 enum: [Operatore, Amministratore, CentroSociale, CentroRiciclaggio]
 *     responses:
 *       201:
 *         description: Utente creato con successo
 *       400:
 *         description: Errore di validazione
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 */
router.post('/', [
  authenticate,
  authorize('Amministratore'),
  body('email').isEmail().withMessage('Email non valida'),
  body('password').isLength({ min: 6 }).withMessage('Password deve contenere almeno 6 caratteri'),
  body('nome').notEmpty().withMessage('Nome è richiesto'),
  body('cognome').notEmpty().withMessage('Cognome è richiesto'),
  body('ruolo').isIn(['Operatore', 'Amministratore', 'CentroSociale', 'CentroRiciclaggio']).withMessage('Ruolo non valido'),
  validator.validate
], userController.createUser);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Aggiorna un utente
 *     tags: [Utenti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dell'utente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               nome:
 *                 type: string
 *               cognome:
 *                 type: string
 *               ruolo:
 *                 type: string
 *                 enum: [Operatore, Amministratore, CentroSociale, CentroRiciclaggio]
 *     responses:
 *       200:
 *         description: Utente aggiornato con successo
 *       400:
 *         description: Errore di validazione
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       404:
 *         description: Utente non trovato
 */
router.put('/:id', [
  authenticate,
  authorize('Amministratore'),
  body('email').optional().isEmail().withMessage('Email non valida'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password deve contenere almeno 6 caratteri'),
  body('ruolo').optional().isIn(['Operatore', 'Amministratore', 'CentroSociale', 'CentroRiciclaggio']).withMessage('Ruolo non valido'),
  validator.validate
], userController.updateUser);

module.exports = router; 