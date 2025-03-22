# Istruzioni per Testare le Notifiche Push in ReFood Mobile

## Metodo 1: Test Notifiche Locali

Il modo più semplice per verificare il funzionamento delle notifiche è utilizzare il pulsante di test all'interno dell'app:

1. Avvia l'app ReFood Mobile
2. Accedi con le tue credenziali
3. Vai alla sezione "Notifiche"
4. Clicca sul pulsante con l'icona del campanello (verde) in alto a destra
5. Dovresti vedere una notifica locale apparire immediatamente

## Metodo 2: Test Notifiche Remote con Expo

Per testare le notifiche push remote utilizzando il servizio Expo:

### Prerequisiti
- Node.js installato
- npm o yarn installato

### Passi

1. **Ottieni il tuo token Expo Push**:
   - Avvia l'app in modalità sviluppo
   - Dopo l'accesso, controlla i log della console
   - Cerca il messaggio "Token push salvato: ExponentPushToken[...]"
   - Copia questo token

2. **Modifica lo script di test**:
   - Apri il file `test-push.js` in questa directory
   - Sostituisci `SOSTITUISCI_CON_IL_TUO_TOKEN` con il tuo token Expo Push

3. **Installa axios** (se non è già installato):
   ```bash
   npm install axios
   ```

4. **Esegui lo script**:
   ```bash
   node test-push.js
   ```

5. **Verifica**:
   - Dovresti ricevere una notifica push sul tuo dispositivo
   - Se l'app è in background, tocca la notifica per verificare che ti porti alla schermata corretta
   - Se l'app è in primo piano, dovresti vedere un toast con la notifica

## Metodo 3: Test con l'Expo Push Tool (Online)

Puoi anche utilizzare lo strumento online di Expo per inviare notifiche push:

1. Vai a [https://expo.dev/notifications](https://expo.dev/notifications)
2. Inserisci il tuo token push
3. Personalizza il titolo, il messaggio e i dati della notifica
4. Invia la notifica

## Risoluzione Problemi

Se le notifiche non funzionano:

- **Permessi:** Verifica che l'app abbia i permessi per le notifiche nelle impostazioni del dispositivo
- **Token:** Controlla che il token push venga generato correttamente (nei log)
- **Dispositivo fisico:** Le notifiche push non funzionano sugli emulatori/simulatori
- **Project ID:** Assicurati che nell'app sia configurato il Project ID Expo corretto
- **Connessione:** Verifica che il dispositivo sia connesso a Internet

## Nota Importante

Le notifiche push remote richiedono un server backend configurato per inviare le notifiche. Questo script di test utilizza direttamente l'API Expo Push e serve solo per verificare la configurazione dell'app client.

# Server Stub per Notifiche ReFood

Questo server stub simula gli endpoint API per le notifiche di ReFood, fornendo un ambiente di test isolato per lo sviluppo dell'app mobile.

## Funzionalità

- Simula tutti gli endpoint necessari per le notifiche
- Fornisce dati di esempio per testare vari tipi di notifiche
- Supporta operazioni CRUD complete sulle notifiche

## Prerequisiti

- Node.js (v14 o superiore)
- npm

## Installazione

1. Assicurati di essere nella cartella `test`:
   ```
   cd test
   ```

2. Installa le dipendenze:
   ```
   npm install
   ```

## Utilizzo

1. Avvia il server:
   ```
   node stub-notification-server.js
   ```

2. Il server sarà in ascolto su `http://localhost:3001`

3. Modifica temporaneamente il file `refood-mobile/src/config/constants.ts` per puntare al server locale:
   ```typescript
   export let API_URL = 'http://localhost:3001/api/v1';
   ```

4. Dopo aver finito i test, ricorda di ripristinare l'URL originale:
   ```typescript
   export let API_URL = 'https://refood-be.stage.app-it-up.com/api/v1';
   ```

## Endpoint disponibili

- `GET /api/v1/notifiche` - Recupera l'elenco delle notifiche
- `GET /api/v1/notifiche/conteggio` - Conta le notifiche (supporta filtro per lette/non lette)
- `GET /api/v1/notifiche/:id` - Dettaglio di una notifica specifica
- `PUT /api/v1/notifiche/:id/letta` - Segna una notifica come letta
- `POST /api/v1/notifiche/segna-tutte-lette` - Segna tutte le notifiche come lette
- `DELETE /api/v1/notifiche/:id` - Elimina una notifica

## Log

Il server registra tutte le richieste sulla console, facilitando il debug durante i test.

## Note

Questo server è solo per scopi di test e non dovrebbe essere utilizzato in produzione. 