const express = require('express');
const { body, param, query } = require('express-validator');
const validator = require('../middlewares/validator');
const { authenticate, authorize } = require('../middlewares/auth');
const { 
  getUtenti, 
  getUtenteById, 
  createUtente, 
  updateUtente, 
  deleteUtente,
  getUtentiTipi,
  getUtenteAttori,
  associaAttore,
  rimuoviAttore,
  getUtenteStatistiche,
  associaOperatori
} = require('../controllers/utenti.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Utenti
 *   description: Endpoints per la gestione degli utenti (ex centri)
 */

/**
 * @swagger
 * /utenti:
 *   get:
 *     summary: Ottiene tutti gli utenti (ex centri)
 *     description: Restituisce un elenco di tutti gli utenti con supporto per filtri e paginazione
 *     tags: [Utenti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numero della pagina
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Numero di risultati per pagina
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         description: Filtra per tipo di utente
 *       - in: query
 *         name: nome
 *         schema:
 *           type: string
 *         description: Filtra per nome (ricerca parziale)
 *     responses:
 *       200:
 *         description: Elenco di utenti
 *       401:
 *         description: Non autenticato
 *       500:
 *         description: Errore del server
 */
router.get('/', authenticate, getUtenti);

/**
 * @swagger
 * /utenti/{id}:
 *   get:
 *     summary: Ottiene un utente specifico
 *     description: Restituisce i dettagli di un utente specifico
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
 *       404:
 *         description: Utente non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/:id', 
  authenticate, 
  [
    param('id').isInt().withMessage('ID non valido')
  ],
  validator.validate,
  getUtenteById
);

/**
 * @swagger
 * /utenti:
 *   post:
 *     summary: Crea un nuovo utente
 *     description: Crea un nuovo utente nel sistema
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
 *               - nome
 *             properties:
 *               nome:
 *                 type: string
 *               tipo:
 *                 type: string
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
 *               tipo_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Utente creato con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.post('/', 
  authenticate,
  authorize(['Amministratore']),
  [
    body('nome').notEmpty().withMessage('Il nome è obbligatorio'),
    body('indirizzo').optional(),
    body('telefono').optional(),
    body('email').optional().isEmail().withMessage('Email non valida'),
    body('latitudine').optional().isFloat().withMessage('Latitudine non valida'),
    body('longitudine').optional().isFloat().withMessage('Longitudine non valida'),
    body('tipo').optional(),
    body('tipo_id').optional().isInt().withMessage('Tipo ID non valido')
  ],
  validator.validate,
  createUtente
);

/**
 * @swagger
 * /utenti/{id}:
 *   put:
 *     summary: Aggiorna un utente
 *     description: Aggiorna i dati di un utente esistente
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
 *               nome:
 *                 type: string
 *               tipo:
 *                 type: string
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
 *               tipo_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Utente aggiornato con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       404:
 *         description: Utente non trovato
 *       500:
 *         description: Errore del server
 */
router.put('/:id', 
  authenticate,
  authorize(['Amministratore']),
  [
    param('id').isInt().withMessage('ID non valido'),
    body('nome').optional(),
    body('indirizzo').optional(),
    body('telefono').optional(),
    body('email').optional().isEmail().withMessage('Email non valida'),
    body('latitudine').optional().isFloat().withMessage('Latitudine non valida'),
    body('longitudine').optional().isFloat().withMessage('Longitudine non valida'),
    body('tipo').optional(),
    body('tipo_id').optional().isInt().withMessage('Tipo ID non valido')
  ],
  validator.validate,
  updateUtente
);

/**
 * @swagger
 * /utenti/{id}:
 *   delete:
 *     summary: Elimina un utente
 *     description: Elimina un utente dal sistema
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
 *         description: Utente eliminato con successo
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       404:
 *         description: Utente non trovato
 *       500:
 *         description: Errore del server
 */
router.delete('/:id', 
  authenticate,
  authorize(['Amministratore']),
  [
    param('id').isInt().withMessage('ID non valido')
  ],
  validator.validate,
  deleteUtente
);

/**
 * @swagger
 * /utenti/tipi:
 *   get:
 *     summary: Ottiene tutti i tipi di utente
 *     description: Restituisce un elenco di tutti i tipi di utente disponibili
 *     tags: [Utenti]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Elenco di tipi di utente
 *       401:
 *         description: Non autenticato
 *       500:
 *         description: Errore del server
 */
router.get('/tipi', authenticate, getUtentiTipi);

/**
 * @swagger
 * /utenti/{id}/attori:
 *   get:
 *     summary: Ottiene tutti gli attori associati a un utente
 *     description: Restituisce un elenco di tutti gli attori associati a un utente specifico
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
 *         description: Elenco di attori
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Utente non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/:id/attori', 
  authenticate,
  [
    param('id').isInt().withMessage('ID non valido')
  ],
  validator.validate,
  getUtenteAttori
);

/**
 * @swagger
 * /utenti/{id}/attori/{attore_id}:
 *   post:
 *     summary: Associa un attore a un utente
 *     description: Associa un attore esistente a un utente specifico
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
 *       - in: path
 *         name: attore_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dell'attore
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ruolo_specifico:
 *                 type: string
 *                 description: Ruolo specifico dell'attore per questo utente
 *     responses:
 *       201:
 *         description: Attore associato con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       404:
 *         description: Utente o attore non trovato
 *       409:
 *         description: Attore già associato all'utente
 *       500:
 *         description: Errore del server
 */
router.post('/:id/attori/:utente_id', 
  authenticate,
  authorize(['Amministratore']),
  [
    param('id').isInt().withMessage('ID utente non valido'),
    param('utente_id').isInt().withMessage('ID attore non valido'),
    body('ruolo_specifico').optional()
  ],
  validator.validate,
  associaAttore
);

/**
 * @swagger
 * /utenti/{id}/attori/{attore_id}:
 *   delete:
 *     summary: Rimuove un attore da un utente
 *     description: Rimuove l'associazione tra un attore e un utente specifico
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
 *       - in: path
 *         name: attore_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dell'attore
 *     responses:
 *       200:
 *         description: Attore rimosso con successo
 *       400:
 *         description: Dati non validi o attore non associato
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       404:
 *         description: Utente o attore non trovato
 *       500:
 *         description: Errore del server
 */
router.delete('/:id/attori/:utente_id', 
  authenticate,
  authorize(['Amministratore']),
  [
    param('id').isInt().withMessage('ID utente non valido'),
    param('utente_id').isInt().withMessage('ID attore non valido')
  ],
  validator.validate,
  rimuoviAttore
);

/**
 * @swagger
 * /utenti/{id}/statistiche:
 *   get:
 *     summary: Ottiene le statistiche di un utente
 *     description: Restituisce le statistiche di un utente specifico
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
 *       - in: query
 *         name: inizio
 *         schema:
 *           type: string
 *           format: date
 *         description: Data di inizio (YYYY-MM-DD)
 *       - in: query
 *         name: fine
 *         schema:
 *           type: string
 *           format: date
 *         description: Data di fine (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Statistiche dell'utente
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Utente non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/:id/statistiche', 
  authenticate,
  [
    param('id').isInt().withMessage('ID non valido'),
    query('inizio').optional().isDate().withMessage('Data di inizio non valida'),
    query('fine').optional().isDate().withMessage('Data di fine non valida')
  ],
  validator.validate,
  getUtenteStatistiche
);

/**
 * @swagger
 * /utenti/{id}/operatori:
 *   post:
 *     summary: Associa operatori e amministratori a un utente
 *     description: Associa operatori e amministratori a un utente specifico
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
 *               operatori_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *               amministratori_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Operatori e amministratori associati con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       404:
 *         description: Utente non trovato
 *       500:
 *         description: Errore del server
 */
router.post('/:id/operatori', 
  authenticate,
  authorize(['Amministratore']),
  [
    param('id').isInt().withMessage('ID utente non valido'),
    body('operatori_ids').optional().isArray().withMessage('Operatori_ids deve essere un array'),
    body('amministratori_ids').optional().isArray().withMessage('Amministratori_ids deve essere un array')
  ],
  validator.validate,
  associaOperatori
);

module.exports = router; 