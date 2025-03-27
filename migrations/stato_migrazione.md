# Stato Attuale della Migrazione da Centri a Tipo_Utente

## Passaggi Completati

1. **Migrazione del Database**
   - Eseguito script SQL `rename_centri_to_tipo_utente.sql` per rinominare le tabelle
   - Aggiornate le relazioni e i vincoli nel database

2. **Creazione dei File Controller e Routes per la Nuova Entità**
   - Creato `tipo_utente.controller.js` basato su `centri.controller.js`
   - Creato `tipo_utente.routes.js` basato su `centri.routes.js`
   - Aggiornati i riferimenti interni in questi file

3. **Configurazione del Routing**
   - Aggiornato `routes/index.js` per includere le nuove rotte `/tipi-utente`
   - Aggiunto reindirizzamento temporaneo da `/centri` a `/tipi-utente`

4. **Aggiornamento del Middleware di Autenticazione**
   - Modificato `auth.js` per utilizzare `belongsToTipoUtente` invece di `belongsToCenter`

5. **Migrazione Automatica dei Reference**
   - Creato ed eseguito lo script `complete_migration.sh` per aggiornare automaticamente i riferimenti in altri file
   - Sono stati aggiornati vari controller e file di route

## Problemi Attuali

1. **Il Server Non Si Avvia Correttamente**
   - Diversi errori relativi a metodi mancanti nei controller
   - Riferimenti inconsistenti tra vecchi e nuovi nomi in vari file

2. **File Controller Incompatibili**
   - Controller come `statistiche.controller.js` ancora utilizzano riferimenti a metodi e tabelle obsolete
   - Necessaria una revisione completa di questi controller

3. **Gestione Inconsistente dei Nomi dei Metodi**
   - Alcuni metodi hanno mantenuto i nomi vecchi (es. `getCentri`)
   - Altri sono stati rinominati ma hanno problemi di compatibilità

## Azioni Richieste per Completare la Migrazione

1. **Revisione Sistematica dei Controller**
   - Aggiornare sistematicamente tutti i metodi in tutti i controller per utilizzare i nuovi nomi di tabella
   - Particolare attenzione a `lotti.controller.js`, `prenotazioni.controller.js` e `notifiche.controller.js`

2. **Aggiornamento delle Query SQL**
   - Cercare e sostituire tutte le occorrenze di `Centri` con `Tipo_Utente`
   - Sostituire tutti i riferimenti a `centro_id` con `tipo_utente_id`

3. **Test Completo delle API**
   - Verificare il funzionamento di ogni singolo endpoint dopo le modifiche
   - Assicurarsi che il reindirizzamento temporaneo funzioni correttamente

4. **Aggiornamento della Documentazione OpenAPI/Swagger**
   - Assicurarsi che tutta la documentazione API rifletta i nuovi nomi delle entità

## Piano di Completamento

1. **Approccio Graduale**
   - Ripristinare il database al suo stato originale (pre-migrazione)
   - Implementare la migrazione in un ambiente di test/sviluppo separato
   - Testare completamente prima di applicare al sistema di produzione

2. **Perfezionamento degli Script di Migrazione**
   - Migliorare lo script `complete_migration.sh` per gestire meglio i casi particolari
   - Aggiungere validazione dopo l'esecuzione

3. **Test di Integrazione**
   - Verificare l'interazione tra backend, frontend e applicazione mobile
   - Assicurarsi che tutti i client possano funzionare sia con i vecchi che con i nuovi endpoint

## Raccomandazioni

1. Procedere con un approccio incrementale, affrontando un componente alla volta
2. Mantenere la retrocompatibilità temporanea per facilitare la transizione
3. Documentare completamente tutti i cambiamenti per riferimento futuro
4. Pianificare un periodo di inattività per l'applicazione durante la migrazione finale 