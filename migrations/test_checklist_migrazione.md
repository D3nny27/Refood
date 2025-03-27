# Checklist per il Test della Migrazione

## Preparazione

- [ ] Backup del database attuale prima di iniziare i test
- [ ] Verifica della corretta installazione delle dipendenze (`npm install`)
- [ ] Configurazione dell'ambiente di test (file `.env` con parametri corretti)

## Test della Migrazione del Database

- [ ] Eseguire lo script di migrazione: `npm run migrate:utenti-to-attori`
- [ ] Verificare che lo script sia stato completato senza errori
- [ ] Controllare che la tabella `Attori` contenga i ruoli aggiornati
- [ ] Controllare che la tabella `Tipo_Utente` contenga i tipi corretti
- [ ] Verificare le associazioni nella tabella `AttoriTipoUtente`
- [ ] Testare i trigger che impediscono associazioni non valide

## Test del Frontend

### Registrazione

- [ ] Test della registrazione come Organizzazione > Operatore
- [ ] Test della registrazione come Organizzazione > Amministratore
- [ ] Test della registrazione come Utente > Privato
- [ ] Test della registrazione come Utente > Canale sociale
- [ ] Test della registrazione come Utente > Centro riciclo
- [ ] Verificare che i dati vengano salvati correttamente nel database
- [ ] Test delle validazioni dei campi (email, password, campi obbligatori)
- [ ] Test della gestione degli errori (email già registrata, errori del server)

### Login

- [ ] Test del login con credenziali di Operatore
- [ ] Test del login con credenziali di Amministratore
- [ ] Test del login con credenziali di Utente (tutti i tipi)
- [ ] Verificare che i token di autenticazione vengano generati correttamente
- [ ] Verificare che le sessioni vengano salvate nel database

### Gestione Tipi Utente (precedentemente Centri)

- [ ] Verificare che il reindirizzamento da `/centri` a `/tipi-utente` funzioni correttamente
- [ ] Test della visualizzazione dell'elenco dei tipi utente
- [ ] Test della creazione di un nuovo tipo utente
- [ ] Test della modifica di un tipo utente esistente
- [ ] Test dell'eliminazione di un tipo utente
- [ ] Test dell'associazione di attori a un tipo utente
- [ ] Test della rimozione di attori da un tipo utente

## Test delle API

### Endpoint di Autenticazione

- [ ] Test dell'endpoint `/api/auth/register` con tutti i possibili casi
- [ ] Test dell'endpoint `/api/auth/login`
- [ ] Test dell'endpoint `/api/auth/logout`
- [ ] Test dell'endpoint `/api/auth/refresh-token`

### Endpoint Attori

- [ ] Test dell'endpoint GET `/api/attori`
- [ ] Test dell'endpoint GET `/api/attori/{id}`
- [ ] Test dell'endpoint POST `/api/attori`
- [ ] Test dell'endpoint PUT `/api/attori/{id}`
- [ ] Test dell'endpoint GET `/api/attori/profile`

### Endpoint Tipi Utente

- [ ] Test dell'endpoint GET `/api/tipi-utente`
- [ ] Test dell'endpoint GET `/api/tipi-utente/{id}`
- [ ] Test dell'endpoint POST `/api/tipi-utente`
- [ ] Test dell'endpoint PUT `/api/tipi-utente/{id}`
- [ ] Test dell'endpoint DELETE `/api/tipi-utente/{id}`
- [ ] Test degli endpoint per la gestione delle associazioni attori-tipi utente

## Test di Sicurezza e Autorizzazioni

- [ ] Verificare che solo gli amministratori possano accedere alle funzionalità di gestione degli attori
- [ ] Verificare che gli operatori possano accedere solo alle funzionalità consentite
- [ ] Verificare che gli utenti possano accedere solo ai propri dati
- [ ] Testare la protezione degli endpoint contro accessi non autorizzati
- [ ] Verificare che i token scaduti vengano gestiti correttamente

## Test di Regressione

- [ ] Verificare che tutte le funzionalità esistenti continuino a funzionare
- [ ] Testare il flusso completo di operatività del sistema:
  - [ ] Registrazione
  - [ ] Login
  - [ ] Gestione lotti
  - [ ] Prenotazioni
  - [ ] Notifiche

## Feedback e Correzioni

- [ ] Documentare eventuali problemi riscontrati
- [ ] Implementare correzioni per i problemi identificati
- [ ] Rieseguire i test dopo le correzioni

## Completamento

- [ ] Verificare che tutti i test siano stati superati
- [ ] Aggiornare la documentazione con eventuali modifiche apportate
- [ ] Comunicare il completamento della migrazione al team di sviluppo 