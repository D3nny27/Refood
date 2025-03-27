# Riepilogo Migrazione da Centri a Tipo_Utente

## Passaggi Completati

1. **Migrazione Database**:
   - Creato e eseguito lo script SQL `rename_centri_to_tipo_utente.sql` che ha:
     - Creato la nuova tabella `Tipo_Utente`
     - Trasferito i dati da `Centri` a `Tipo_Utente`
     - Aggiornato le tabelle correlate (`AttoriCentri` → `AttoriTipoUtente`, ecc.)
     - Eliminato le vecchie tabelle

2. **File di Controller e Route**:
   - Creato una copia del controller `centri.controller.js` come `tipo_utente.controller.js`
   - Aggiornato `tipo_utente.controller.js` con i riferimenti corretti a `Tipo_Utente`
   - Creato una copia del file di routing `centri.routes.js` come `tipo_utente.routes.js`
   - Aggiornato `tipo_utente.routes.js` con i nuovi endpoint per `/tipi-utente`

3. **File Index delle Routes**:
   - Aggiornato il file `routes/index.js` per utilizzare `tipoUtenteRoutes` invece di `centriRoutes`
   - Aggiornato il routing per utilizzare `/tipi-utente` invece di `/centri`

4. **Middleware Auth**:
   - Aggiornato il middleware `belongsToCenter` a `belongsToTipoUtente` 
   - Aggiornato i riferimenti a `AttoriCentri` a `AttoriTipoUtente` in questo middleware

5. **Documentazione**:
   - Creati file di guida per aggiornare backend e frontend
   - Creato un README con la panoramica della migrazione

## Passaggi da Completare

1. **Aggiornamento Query nei Controller**:
   - Aggiornare tutte le query in `notifiche.controller.js` che fanno riferimento a `Centri` e `centro_id`
   - Aggiornare tutte le query in `lotti.controller.js` che fanno riferimento a `Centri` e `centro_id`
   - Aggiornare tutte le query in `prenotazioni.controller.js` che fanno riferimento a `Centri` e `centro_id`
   - Aggiornare tutte le query in `statistiche.controller.js` che fanno riferimento a `Centri` e `centro_id`
   - Aggiornare tutte le query in `attore.controller.js` che fanno riferimento a `Centri` e `centro_id`

2. **Aggiornamento nei Router**:
   - Aggiornare le rotte in `notifiche.routes.js` che utilizzano `centro_id`
   - Aggiornare le rotte in `prenotazioni.routes.js` che utilizzano `centro_id`
   - Aggiornare le rotte in `lotti.routes.js` che utilizzano `centro_id`
   - Rimuovere le rotte obsolete in `centri.routes.js` se il file deve rimanere

3. **Aggiornamento Funzioni nei Controller**:
   - Rimuovere o aggiornare la funzione `getCentriDisponibili` in `lotti.controller.js`
   - Aggiornare tutte le proprietà JSON restituite che utilizzano `centro_id` e `centro_nome` 

4. **Testing e Debug**:
   - Testare tutte le API `/tipi-utente`
   - Verificare la compatibilità con frontend e mobile app
   - Debuggare e risolvere i problemi di avvio del server

## Suggerimenti per il Completamento

1. Utilizza un approccio per fasi, aggiornando un modulo alla volta e testando dopo ogni aggiornamento.
2. Considera di creare uno script che automatizzi i cambiamenti ripetitivi (es. sostituire con `sed`).
3. Prepara un piano di fallback nel caso in cui ci siano problemi durante la migrazione.
4. Aggiorna la documentazione Swagger/OpenAPI man mano che aggiorni le API.

## Problemi Noti

1. Il server non si avvia correttamente dopo la migrazione parziale, probabilmente a causa di riferimenti misti tra `Centri` e `Tipo_Utente`.
2. Ci sono ancora molti riferimenti a `centro_id` e `Centri` in diversi controller.
3. L'attuale implementazione potrebbe generare errori 404 per le richieste ai vecchi endpoint `/centri`.

## Prossimi Passi Immediati

1. Correggere gli errori che impediscono l'avvio del server.
2. Creare un endpoint di reindirizzamento temporaneo da `/centri` a `/tipi-utente` per la compatibilità con i client esistenti.
3. Aggiornare un controller alla volta, iniziando da quelli con meno dipendenze. 