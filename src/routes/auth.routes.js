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
 *                 enum: [Operatore, CentroSociale, CentroRiciclaggio, UTENTE, CENTRO_SOCIALE, CENTRO_RICICLAGGIO]
 *                 default: Operatore
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
  body('ruolo').optional().isIn(['Operatore', 'CentroSociale', 'CentroRiciclaggio', 'UTENTE', 'CENTRO_SOCIALE', 'CENTRO_RICICLAGGIO']).withMessage('Ruolo non valido'),
  validator.validate
], authController.register); 