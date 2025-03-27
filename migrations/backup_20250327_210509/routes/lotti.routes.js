const express = require('express');
const { body, param, query } = require('express-validator');
const validator = require('../middlewares/validator');
const { authenticate, authorize, belongsToCenter } = require('../middlewares/auth');
const lottiController = require('../controllers/lotti.controller');
const db = require('../config/database');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Lotti
 *   description: Endpoints per la gestione dei lotti alimentari
 */

/**
 * @swagger
 * /lotti/test:
 *   get:
 *     summary: Test di connessione
 *     tags: [Lotti]
 *     responses:
 *       200:
 *         description: Test riuscito
 */
router.get('/test', (req, res) => {
  console.log('Test endpoint chiamato');
  res.json({ message: 'Test endpoint funzionante', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /lotti/disponibili:
 *   get:
 *     summary: Ottieni lotti disponibili per prenotazione
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: stato
 *         schema:
 *           type: string
 *           enum: [Verde, Arancione, Rosso]
 *         description: Filtra per stato
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
 *     responses:
 *       200:
 *         description: Lista di lotti disponibili
 */
router.get('/disponibili', [
  authenticate,
  authorize(['CentroSociale', 'CentroRiciclaggio', 'Amministratore']),
  query('stato').optional().isString().isIn(['Verde', 'Arancione', 'Rosso']).withMessage('Stato non valido'),
  query('raggio').optional().isFloat({ min: 0.1 }).withMessage('Raggio deve essere un numero positivo'),
  query('lat').optional().isFloat().withMessage('Latitudine non valida'),
  query('lng').optional().isFloat().withMessage('Longitudine non valida'),
  validator.validate
], lottiController.getLottiDisponibili);

/**
 * @swagger
 * /lotti/test-create:
 *   post:
 *     summary: Test di creazione lotto semplificato
 *     tags: [Lotti]
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
 *               - quantita
 *             properties:
 *               nome:
 *                 type: string
 *               quantita:
 *                 type: number
 *               categoria:
 *                 type: string
 *               centro_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Lotto creato con successo
 *       401:
 *         description: Autenticazione richiesta
 *       500:
 *         description: Errore interno del server
 */
router.post('/test-create', authenticate, async (req, res, next) => {
  try {
    console.log('Endpoint test-create chiamato');
    console.log('Headers ricevuti:', JSON.stringify(req.headers));
    console.log('Body ricevuto:', JSON.stringify(req.body));
    console.log('Utente autenticato:', req.user ? JSON.stringify(req.user) : 'Nessun attore');
    
    // Valida i dati di input
    const { nome, quantita } = req.body;
    
    if (!nome || !quantita) {
      console.log('Dati mancanti:', { nome, quantita });
      return res.status(400).json({ 
        status: 'error', 
        message: 'Dati richiesti mancanti',
        details: 'nome e quantita sono campi obbligatori' 
      });
    }
    
    // Estrai l'ID dell'attore dal token JWT
    const userId = req.user.sub;
    console.log('ID attore estratto dal token:', userId);
    
    // Ottieni un ID centro (utilizziamo il primo disponibile per semplicità)
    let centroId = 1; // Valore predefinito
    
    try {
      console.log('Cerco un centro valido per l\'attore');
      const rows = await new Promise((resolve, reject) => {
        db.all('SELECT centro_id FROM AttoriCentri WHERE attore_id = ? LIMIT 1', [userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      if (rows && rows.length > 0) {
        centroId = rows[0].centro_id;
        console.log('Centro trovato:', centroId);
      } else {
        console.log('Nessun centro trovato per l\'attore, uso valore predefinito:', centroId);
      }
    } catch (dbErr) {
      console.error('Errore nel recupero del centro:', dbErr);
    }
    
    // Dati completi per l'inserimento
    const dataScadenza = new Date();
    dataScadenza.setDate(dataScadenza.getDate() + 7); // Scadenza tra 7 giorni
    
    const lottoData = {
      prodotto: nome,
      descrizione: nome + ' (creato da test)',
      quantita: parseFloat(quantita),
      unita_misura: 'kg',
      data_scadenza: dataScadenza.toISOString().split('T')[0],
      centro_origine_id: centroId,
      stato: 'Verde',
      giorni_permanenza: 7
    };
    
    console.log('Tentativo di inserimento lotto con dati:', JSON.stringify(lottoData));
    
    // Inizia una transazione
    db.run('BEGIN TRANSACTION', async function(beginErr) {
      if (beginErr) {
        console.error('Errore nell\'avvio della transazione:', beginErr);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Errore nell\'avvio della transazione',
          details: beginErr.message
        });
      }
      
      try {
        // Inserisci il lotto
        const insertLotto = function() {
          return new Promise((resolve, reject) => {
            const sql = `
              INSERT INTO Lotti (
                prodotto, descrizione, quantita, unita_misura, 
                data_inserimento, data_scadenza, centro_origine_id, 
                stato, giorni_permanenza
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
              lottoData.prodotto,
              lottoData.descrizione,
              lottoData.quantita,
              lottoData.unita_misura,
              new Date().toISOString(),
              lottoData.data_scadenza,
              lottoData.centro_origine_id,
              lottoData.stato,
              lottoData.giorni_permanenza
            ];
            
            db.run(sql, params, function(err) {
              if (err) {
                console.error('Errore nell\'inserimento del lotto:', err);
                reject(err);
              } else {
                console.log('Lotto inserito con ID:', this.lastID);
                resolve(this.lastID);
              }
            });
          });
        };
        
        // Esegui l'inserimento
        const lottoId = await insertLotto();
        
        // Commit della transazione
        db.run('COMMIT', function(commitErr) {
          if (commitErr) {
            console.error('Errore nel commit della transazione:', commitErr);
            return res.status(500).json({ 
              status: 'error', 
              message: 'Errore nel commit della transazione',
              details: commitErr.message
            });
          }
          
          // Risposta con successo
          res.status(201).json({ 
            status: 'success', 
            message: 'Lotto creato con successo', 
            id: lottoId,
            data: {
              ...lottoData,
              id: lottoId
            }
          });
        });
      } catch (error) {
        // Rollback in caso di errore
        db.run('ROLLBACK', function() {
          console.error('Transazione annullata per errore:', error);
          res.status(500).json({ 
            status: 'error', 
            message: 'Errore nella creazione del lotto',
            details: error.message
          });
        });
      }
    });
  } catch (error) {
    console.error('Errore generale in test-create:', error);
    next(error);
  }
});

/**
 * @swagger
 * /lotti/simple-test:
 *   post:
 *     summary: Endpoint semplificato per test
 *     tags: [Lotti]
 *     responses:
 *       200:
 *         description: Test eseguito con successo
 */
router.post("/simple-test", (req, res) => { 
  console.log("Body ricevuto:", req.body); 
  res.json({ success: true, message: "Test eseguito con successo" }); 
});

/**
 * @swagger
 * /lotti/centri:
 *   get:
 *     summary: Ottieni centri disponibili per l'attore corrente
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista di centri disponibili
 *       401:
 *         description: Autenticazione richiesta
 *       500:
 *         description: Errore interno del server
 */
router.get('/centri', [
  authenticate,
], lottiController.getCentriDisponibili);

/**
 * @swagger
 * /lotti:
 *   get:
 *     summary: Ottieni elenco lotti
 *     description: Restituisce l'elenco dei lotti filtrato in base ai parametri
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: stato
 *         schema:
 *           type: string
 *           enum: [Verde, Arancione, Rosso]
 *         description: Filtra per stato
 *       - in: query
 *         name: centro
 *         schema:
 *           type: integer
 *         description: Filtra per ID del centro origine
 *       - in: query
 *         name: scadenza_entro
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtra per scadenza entro una data
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
 *         description: Lista di lotti
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
router.get('/', authenticate, lottiController.getLotti);

/**
 * @swagger
 * /lotti:
 *   post:
 *     summary: Crea un nuovo lotto
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prodotto
 *               - quantita
 *               - unita_misura
 *               - data_scadenza
 *               - giorni_permanenza
 *               - centro_origine_id
 *             properties:
 *               prodotto:
 *                 type: string
 *               quantita:
 *                 type: number
 *               unita_misura:
 *                 type: string
 *               data_scadenza:
 *                 type: string
 *                 format: date
 *               giorni_permanenza:
 *                 type: integer
 *               centro_origine_id:
 *                 type: integer
 *               categorie_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Lotto creato con successo
 *       400:
 *         description: Dati non validi
 */
router.post('/', [
  authenticate,
  authorize(['Operatore', 'Amministratore']),
  body('prodotto').isString().isLength({ min: 2 }).withMessage('Prodotto deve essere una stringa di almeno 2 caratteri'),
  body('quantita').isFloat({ min: 0.1 }).withMessage('Quantità deve essere un numero positivo'),
  body('unita_misura').isString().isIn(['kg', 'g', 'l', 'ml', 'pz']).withMessage('Unità di misura non valida'),
  body('data_scadenza').isDate().withMessage('Data di scadenza non valida'),
  body('giorni_permanenza').isInt({ min: 1 }).withMessage('Giorni di permanenza deve essere un numero intero positivo'),
  body('centro_origine_id').isInt().withMessage('ID centro origine deve essere un numero intero'),
  body('categorie_ids').optional().isArray().withMessage('Categorie deve essere un array di ID'),
  body('categorie_ids.*').optional().isInt().withMessage('ID categoria deve essere un numero intero'),
  validator.validate,
  belongsToCenter(req => req.body.centro_origine_id)
], lottiController.createLotto);

/**
 * @swagger
 * /lotti/{id}:
 *   get:
 *     summary: Ottieni dettagli di un lotto
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del lotto
 *     responses:
 *       200:
 *         description: Dettagli del lotto
 *       404:
 *         description: Lotto non trovato
 */
router.get('/:id', [
  authenticate,
  param('id').isInt().withMessage('ID lotto deve essere un numero intero')
], lottiController.getLottoById);

/**
 * @swagger
 * /lotti/{id}/origini:
 *   get:
 *     summary: Ottieni informazioni sulla filiera di origine
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del lotto
 *     responses:
 *       200:
 *         description: Informazioni sulla filiera
 *       404:
 *         description: Lotto non trovato
 */
router.get('/:id/origini', [
  authenticate,
  param('id').isInt().withMessage('ID lotto deve essere un numero intero'),
  validator.validate
], lottiController.getOriginiLotto);

/**
 * @swagger
 * /lotti/{id}/impatto:
 *   get:
 *     summary: Ottieni informazioni sull'impatto ambientale ed economico
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del lotto
 *     responses:
 *       200:
 *         description: Informazioni sull'impatto
 *       404:
 *         description: Lotto non trovato
 */
router.get('/:id/impatto', [
  authenticate,
  param('id').isInt().withMessage('ID lotto deve essere un numero intero'),
  validator.validate
], lottiController.getImpattoLotto);

/**
 * @swagger
 * /lotti/{id}:
 *   put:
 *     summary: Aggiorna un lotto esistente
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del lotto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prodotto:
 *                 type: string
 *               quantita:
 *                 type: number
 *               unita_misura:
 *                 type: string
 *               data_scadenza:
 *                 type: string
 *                 format: date
 *               giorni_permanenza:
 *                 type: integer
 *               stato:
 *                 type: string
 *                 enum: [Verde, Arancione, Rosso]
 *               categorie_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Lotto aggiornato con successo
 *       404:
 *         description: Lotto non trovato
 */
router.put('/:id', [
  authenticate,
  authorize(['Operatore', 'Amministratore']),
  param('id').isInt().withMessage('ID lotto deve essere un numero intero'),
  body('prodotto').optional().isString().isLength({ min: 2 }).withMessage('Prodotto deve essere una stringa di almeno 2 caratteri'),
  body('quantita').optional().isFloat({ min: 0.1 }).withMessage('Quantità deve essere un numero positivo'),
  body('unita_misura').optional().isString().isIn(['kg', 'g', 'l', 'ml', 'pz']).withMessage('Unità di misura non valida'),
  body('data_scadenza').optional().isDate().withMessage('Data di scadenza non valida'),
  body('giorni_permanenza').optional().isInt({ min: 1 }).withMessage('Giorni di permanenza deve essere un numero intero positivo'),
  body('stato').optional().isString().isIn(['Verde', 'Arancione', 'Rosso']).withMessage('Stato non valido'),
  body('categorie_ids').optional().isArray().withMessage('Categorie deve essere un array di ID'),
  body('categorie_ids.*').optional().isInt().withMessage('ID categoria deve essere un numero intero'),
  validator.validate
], lottiController.updateLotto);

/**
 * @swagger
 * /lotti/{id}:
 *   delete:
 *     summary: Elimina un lotto
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del lotto
 *     responses:
 *       200:
 *         description: Lotto eliminato con successo
 *       404:
 *         description: Lotto non trovato
 */
router.delete('/:id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID lotto deve essere un numero intero'),
  validator.validate
], lottiController.deleteLotto);

// Middleware di autenticazione per le rotte successive
router.use(authenticate);

module.exports = router;
