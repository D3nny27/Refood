# Guida per aggiornare il backend dopo la migrazione da Utenti a Attori

Dopo aver eseguito lo script di migrazione `rename_utenti_to_attori.sql` per aggiornare il database, è necessario aggiornare anche il codice del backend. 

## File da modificare

### 1. Controllers

- `backend/src/controllers/auth.controller.js`
- `backend/src/controllers/user.controller.js` (potrebbe essere rinominato in `attore.controller.js`)
- `backend/src/controllers/lotti.controller.js`
- `backend/src/controllers/notifiche.controller.js`
- `backend/src/controllers/prenotazioni.controller.js`
- `backend/src/controllers/centri.controller.js`
- `backend/src/controllers/statistiche.controller.js`

### 2. Middleware
- `backend/src/middlewares/auth.js`

### 3. Routes
- `backend/src/routes/user.routes.js` (potrebbe essere rinominato in `attore.routes.js`)
- Tutte le route con riferimenti a Utenti

## Modifiche da apportare

### Query SQL

1. Sostituire tutte le occorrenze di:
   - `FROM Utenti` con `FROM Attori`
   - `JOIN Utenti` con `JOIN Attori`
   - `INSERT INTO Utenti` con `INSERT INTO Attori`
   - `UPDATE Utenti` con `UPDATE Attori`
   - `SELECT * FROM Utenti` con `SELECT * FROM Attori`

2. Per la tabella UtentiCentri:
   - `FROM UtentiCentri` con `FROM AttoriCentri`
   - `JOIN UtentiCentri` con `JOIN AttoriCentri`
   - `INSERT INTO UtentiCentri` con `INSERT INTO AttoriCentri`
   - `utente_id` con `attore_id` in tutte le query

3. Riferimenti alle chiavi esterne:
   - `REFERENCES Utenti` con `REFERENCES Attori`

### Riferimenti nel codice JavaScript

1. Variabili e oggetti:
   - Rinominare variabili come `utente` in `attore`
   - Aggiornare proprietà di oggetti come `utente_id` in `attore_id`

2. Commenti e documentazione:
   - Aggiornare tutti i commenti che fanno riferimento a "Utenti"

3. API Swagger:
   - Aggiornare le definizioni Swagger/OpenAPI per riflettere i cambiamenti

## Esempio di modifica di una query

Prima:
```javascript
const utente = await db.get('SELECT * FROM Utenti WHERE email = ?', [email]);
```

Dopo:
```javascript
const attore = await db.get('SELECT * FROM Attori WHERE email = ?', [email]);
```

## Suggerimento per l'automazione

È possibile utilizzare comandi come `grep` e `sed` per automatizzare molte di queste modifiche:

```bash
# Trova tutte le occorrenze di Utenti nei file sorgente
grep -r "Utenti" --include="*.js" ./backend/src

# Sostituisci Utenti con Attori
find ./backend/src -type f -name "*.js" -exec sed -i 's/Utenti/Attori/g' {} \;
find ./backend/src -type f -name "*.js" -exec sed -i 's/utente_id/attore_id/g' {} \;
find ./backend/src -type f -name "*.js" -exec sed -i 's/UtentiCentri/AttoriCentri/g' {} \;
```

## Controlli finali

Dopo le modifiche, verificare attentamente:
1. La sintassi corretta di tutte le query SQL
2. Il corretto funzionamento dell'autenticazione
3. Le relazioni tra tabelle nelle query complesse

Eseguire test approfonditi per ogni endpoint API che interagisce con le tabelle rinominate. 