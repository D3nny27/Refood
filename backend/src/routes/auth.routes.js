const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const validator = require('../middlewares/validator');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Autenticazione
 *   description: Endpoints per la gestione dell'autenticazione
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Accedi all'applicazione
 *     tags: [Autenticazione]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               device_info:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login avvenuto con successo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     nome:
 *                       type: string
 *                     cognome:
 *                       type: string
 *                     ruolo:
 *                       type: string
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     access:
 *                       type: string
 *                     refresh:
 *                       type: string
 *                     expires:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Credenziali non valide
 */
router.post('/login', [
  body('email').isEmail().withMessage('Email non valida'),
  body('password').isLength({ min: 6 }).withMessage('Password deve contenere almeno 6 caratteri'),
  validator.validate
], authController.login);

/**
 * @swagger
 * /auth/verifica:
 *   get:
 *     summary: Verifica la validità del token
 *     description: Verifica se il token di accesso è ancora valido
 *     tags: [Autenticazione]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token valido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Token non valido o scaduto
 */
router.get('/verifica', authenticate, (req, res) => {
  res.json({ valid: true });
});

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Rinnova il token di accesso
 *     tags: [Autenticazione]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token rinnovato con successo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 expires:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Refresh token non valido o scaduto
 */
router.post('/refresh-token', [
  body('refresh_token').notEmpty().withMessage('Refresh token richiesto'),
  validator.validate
], authController.refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout dall'applicazione
 *     tags: [Autenticazione]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout avvenuto con successo
 *       401:
 *         description: Non autenticato
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     summary: Logout da tutti i dispositivi
 *     tags: [Autenticazione]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout da tutti i dispositivi avvenuto con successo
 *       401:
 *         description: Non autenticato
 */
router.post('/logout-all', authenticate, authController.logoutAll);

/**
 * @swagger
 * /auth/active-sessions:
 *   get:
 *     summary: Ottieni tutte le sessioni attive dell'utente
 *     tags: [Autenticazione]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista di sessioni attive
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   device_info:
 *                     type: string
 *                   ip_address:
 *                     type: string
 *                   creato_il:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Non autenticato
 */
router.get('/active-sessions', authenticate, authController.getActiveSessions);

/**
 * @swagger
 * /auth/revoke-session/{id}:
 *   delete:
 *     summary: Revoca una sessione specifica
 *     tags: [Autenticazione]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della sessione
 *     responses:
 *       200:
 *         description: Sessione revocata con successo
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Sessione non trovata
 */
router.delete('/revoke-session/:id', authenticate, authController.revokeSession);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registra un nuovo utente
 *     tags: [Autenticazione]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - cognome
 *               - email
 *               - password
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
 *                 minLength: 6
 *               ruolo:
 *                 type: string
 *                 enum: [UTENTE, CENTRO_SOCIALE, CENTRO_RICICLAGGIO]
 *                 default: UTENTE
 *     responses:
 *       201:
 *         description: Utente registrato con successo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Utente registrato con successo
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         nome:
 *                           type: string
 *                         cognome:
 *                           type: string
 *                         email:
 *                           type: string
 *                         ruolo:
 *                           type: string
 *       400:
 *         description: Dati di registrazione non validi
 *       409:
 *         description: Email già registrata
 */
router.post('/register', [
  body('nome').notEmpty().withMessage('Nome richiesto'),
  body('cognome').notEmpty().withMessage('Cognome richiesto'),
  body('email').isEmail().withMessage('Email non valida'),
  body('password').isLength({ min: 6 }).withMessage('La password deve contenere almeno 6 caratteri'),
  body('ruolo').optional().isIn(['UTENTE', 'CENTRO_SOCIALE', 'CENTRO_RICICLAGGIO']).withMessage('Ruolo non valido'),
  validator.validate
], authController.register);

module.exports = router; 