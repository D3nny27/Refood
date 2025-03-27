const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const validator = require('../middlewares/validator');
const { authenticate } = require('../middlewares/auth');
const bcrypt = require('bcrypt');
const db = require('../config/database');

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
 * /auth/login-web:
 *   post:
 *     summary: Accedi all'applicazione (versione web con cookie)
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
 *     responses:
 *       200:
 *         description: Login avvenuto con successo con cookie impostati
 *       401:
 *         description: Credenziali non valide
 */
router.post('/login-web', [
  body('email').isEmail().withMessage('Email non valida'),
  body('password').isLength({ min: 6 }).withMessage('Password deve contenere almeno 6 caratteri'),
  validator.validate
], authController.loginWeb);

/**
 * @swagger
 * /auth/refresh-token-web:
 *   post:
 *     summary: Rinnova il token di accesso usando il cookie refresh token
 *     tags: [Autenticazione]
 *     responses:
 *       200:
 *         description: Token rinnovato con successo
 *       401:
 *         description: Refresh token non valido o scaduto
 */
router.post('/refresh-token-web', authController.refreshTokenWeb);

/**
 * @swagger
 * /auth/logout-web:
 *   post:
 *     summary: Logout (cancella i cookie di autenticazione)
 *     tags: [Autenticazione]
 *     responses:
 *       200:
 *         description: Logout avvenuto con successo
 */
router.post('/logout-web', authController.logoutWeb);

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
 *     summary: Ottieni tutte le sessioni attive dell'attore
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
 *                   created_at:
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
 *     summary: Registra un nuovo attore e opzionalmente una entità utente collegata
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
 *                 enum: [Amministratore, Operatore, Utente]
 *                 default: Utente
 *               tipo_utente:
 *                 type: string
 *                 enum: [Privato, Canale sociale, Centro riciclo]
 *                 default: Privato
 *     responses:
 *       201:
 *         description: Attore registrato con successo
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
 *                         utente:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             nome:
 *                               type: string
 *                             tipo:
 *                               type: string
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
  body('ruolo').optional().isIn(['Amministratore', 'Operatore', 'Utente']).withMessage('Ruolo non valido'),
  body('tipo_utente').optional().isIn(['Privato', 'Canale sociale', 'Centro riciclo']).withMessage('Tipo utente non valido'),
  validator.validate
], authController.register);

// Aggiungiamo un route per la verifica diretta delle credenziali (solo in ambiente di sviluppo)
if (process.env.NODE_ENV === 'development' || process.env.DEBUG_ROUTES === 'true') {
  /**
   * @route POST /api/v1/auth/verify-admin-credentials
   * @desc Verifica le credenziali admin senza effettuare il login
   * @access Public (ma solo in ambiente di sviluppo)
   */
  router.post('/verify-admin-credentials', async (req, res, next) => {
    try {
      const { email, password } = req.body;
      
      // Log della richiesta (senza la password)
      console.log(`[DEBUG] Richiesta di verifica credenziali per: ${email}`);
      
      // Trova l'attore per email
      const attore = await db.get(`
        SELECT id, email, password, nome, cognome, ruolo
        FROM Attori
        WHERE email = ?
      `, [email]);
      
      if (!attore) {
        return res.status(200).json({
          success: false,
          message: 'Utente non trovato',
          details: {
            userExists: false,
            validCredentials: false
          }
        });
      }
      
      console.log(`[DEBUG] Attore trovato: ${attore.email}, ruolo: ${attore.ruolo}`);
      console.log(`[DEBUG] Hash password nel DB: ${attore.password.substring(0, 10)}...`);
      
      // Verifica la password
      let passwordMatch = false;
      
      // Caso speciale per admin e test (bypass per sviluppo)
      if ((email === 'admin@refood.org' && password === 'admin123') || 
          (email === 'test@refood.org' && password === 'admin123')) {
        console.log('[DEBUG] Attore speciale, bypass della verifica standard');
        passwordMatch = true;
      } else {
        try {
          // Verifica standard della password
          passwordMatch = await bcrypt.compare(password, attore.password);
          console.log(`[DEBUG] Risultato verifica password standard: ${passwordMatch ? 'Valida' : 'NON valida'}`);
        } catch (bcryptError) {
          console.error(`[DEBUG] Errore durante la verifica bcrypt: ${bcryptError.message}`);
          return res.status(500).json({
            success: false,
            message: 'Errore durante la verifica della password',
            details: {
              userExists: true,
              error: bcryptError.message
            }
          });
        }
      }
      
      // Invia risposta con risultato
      return res.status(200).json({
        success: passwordMatch,
        message: passwordMatch ? 'Credenziali valide' : 'Password non valida',
        details: {
          userExists: true,
          validCredentials: passwordMatch,
          userInfo: {
            id: attore.id,
            email: attore.email,
            nome: attore.nome,
            cognome: attore.cognome,
            ruolo: attore.ruolo
          }
        }
      });
    } catch (error) {
      console.error('[DEBUG] Errore durante la verifica delle credenziali:', error);
      return res.status(500).json({
        success: false,
        message: 'Errore durante la verifica delle credenziali',
        error: error.message
      });
    }
  });
  
  console.log('Route di debug per verifica credenziali amministratore attivata');
}

module.exports = router; 