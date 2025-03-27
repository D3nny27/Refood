/**
 * @swagger
 * /centri/{id}/attori/{attore_id}:
 *   post:
 *     summary: Associa un attore a un centro
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
 *         name: attore_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dell'attore
 *     responses:
 *       201:
 *         description: Attore associato con successo
 *       400:
 *         description: Errore di validazione
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       404:
 *         description: Centro o attore non trovato
 *       409:
 *         description: Attore già associato al centro
 */
router.post('/:id/attori/:attore_id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  param('attore_id').isInt().withMessage('ID attore deve essere un numero intero'),
  validator.validate
], centriController.associaUtente);

/**
 * @swagger
 * /centri/{id}/attori/{attore_id}:
 *   delete:
 *     summary: Rimuovi un attore da un centro
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
 *         name: attore_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dell'attore
 *     responses:
 *       200:
 *         description: Attore rimosso con successo
 *       400:
 *         description: Errore di validazione
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       404:
 *         description: Centro non trovato
 *       409:
 *         description: Attore non associato al centro
 */
router.delete('/:id/attori/:attore_id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  param('attore_id').isInt().withMessage('ID attore deve essere un numero intero'),
  validator.validate
], centriController.rimuoviUtente);

/**
 * @swagger
 * /centri/{id}/attori:
 *   get:
 *     summary: Ottiene gli attori associati a un centro
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
 *         description: Lista degli attori del centro
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       404:
 *         description: Centro non trovato
 */
router.get('/:id/attori', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  validator.validate
], centriController.getCentroAttori); 