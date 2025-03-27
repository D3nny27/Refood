# Guida per aggiornare il backend dopo la migrazione da Centri a Tipo_Utente

Dopo aver eseguito lo script di migrazione `rename_centri_to_tipo_utente.sql` per aggiornare il database, è necessario aggiornare anche il codice del backend. 

## File da modificare

### 1. Controllers

- `backend/src/controllers/centri.controller.js` (potrebbe essere rinominato in `tipo_utente.controller.js`)
- `backend/src/controllers/lotti.controller.js`
- `backend/src/controllers/prenotazioni.controller.js`
- `backend/src/controllers/attore.controller.js`
- `backend/src/controllers/notifiche.controller.js`
- `backend/src/controllers/statistiche.controller.js`

### 2. Middleware
- `backend/src/middlewares/auth.js` (se contiene riferimenti ai centri)

### 3. Routes
- `backend/src/routes/centri.routes.js` (potrebbe essere rinominato in `tipo_utente.routes.js`)
- `backend/src/routes/index.js` (per aggiornare i riferimenti alle rotte)
- Tutte le route con riferimenti a Centri

## Modifiche da apportare

### Query SQL

1. Sostituire tutte le occorrenze di:
   - `FROM Centri` con `FROM Tipo_Utente`
   - `JOIN Centri` con `JOIN Tipo_Utente`
   - `INSERT INTO Centri` con `INSERT INTO Tipo_Utente`
   - `UPDATE Centri` con `UPDATE Tipo_Utente`
   - `SELECT * FROM Centri` con `SELECT * FROM Tipo_Utente`

2. Per la tabella AttoriCentri:
   - `FROM AttoriCentri` con `FROM AttoriTipoUtente`
   - `JOIN AttoriCentri` con `JOIN AttoriTipoUtente`
   - `INSERT INTO AttoriCentri` con `INSERT INTO AttoriTipoUtente`
   - `attore_id, centro_id` con `attore_id, tipo_utente_id`

3. Per le altre tabelle:
   - `centro_origine_id` con `tipo_utente_origine_id` (in Lotti)
   - `centro_ricevente_id` con `tipo_utente_ricevente_id` (in Prenotazioni)
   - `centro_trasformazione_id` con `tipo_utente_trasformazione_id` (in Trasformazioni)
   - `centro_id` con `tipo_utente_id` (in Notifiche, StatisticheSettimanali, ecc.)

4. Per i tipi di centro:
   - Sostituire `tipo = 'Distribuzione'` con `tipo = 'Privato'`
   - Sostituire `tipo = 'Sociale'` con `tipo = 'Canale sociale'`
   - Sostituire `tipo = 'Riciclaggio'` con `tipo = 'centro riciclo'`

### Riferimenti nel codice JavaScript

1. Variabili e oggetti:
   - Rinominare variabili come `centro` in `tipoUtente`
   - Aggiornare proprietà di oggetti come `centro_id` in `tipo_utente_id`

2. Commenti e documentazione:
   - Aggiornare tutti i commenti che fanno riferimento a "Centri"

3. API Swagger:
   - Aggiornare le definizioni Swagger/OpenAPI per riflettere i cambiamenti
   - Cambiare `/centri` in `/tipi-utente` negli endpoint

## Esempio di modifica di una query

Prima:
```javascript
const centro = await db.get('SELECT * FROM Centri WHERE id = ?', [id]);
```

Dopo:
```javascript
const tipoUtente = await db.get('SELECT * FROM Tipo_Utente WHERE id = ?', [id]);
```

## Suggerimento per l'automazione

È possibile utilizzare comandi come `grep` e `sed` per automatizzare molte di queste modifiche:

```bash
# Trova tutte le occorrenze di Centri nei file sorgente
grep -r "Centri" --include="*.js" ./backend/src

# Sostituisci Centri con Tipo_Utente
find ./backend/src -type f -name "*.js" -exec sed -i 's/Centri/Tipo_Utente/g' {} \;
find ./backend/src -type f -name "*.js" -exec sed -i 's/centro_id/tipo_utente_id/g' {} \;
find ./backend/src -type f -name "*.js" -exec sed -i 's/AttoriCentri/AttoriTipoUtente/g' {} \;
```

## Controlli finali

Dopo le modifiche, verificare attentamente:
1. La sintassi corretta di tutte le query SQL
2. Il corretto funzionamento dei controller
3. Le relazioni tra tabelle nelle query complesse

Eseguire test approfonditi per ogni endpoint API che interagisce con le tabelle rinominate. 

## Convenzione di nomenclatura

Prestare attenzione alla convenzione di nomenclatura in JavaScript:
- Nel database usiamo `Tipo_Utente` (con underscore)
- Nel codice JavaScript meglio usare `tipoUtente` (camelCase)
- Nei percorsi API meglio usare `/tipi-utente` (kebab-case)

Assicurarsi di mantenere coerenza nella convenzione di nomenclatura in tutto il codice. 