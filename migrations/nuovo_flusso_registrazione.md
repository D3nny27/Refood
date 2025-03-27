# Nuovo Flusso di Registrazione Refood

## Introduzione

Questo documento descrive il nuovo flusso di registrazione implementato nell'applicazione Refood, che riflette la migrazione strutturale da "Utenti" ad "Attori" e da "Centri" a "Tipi Utente". La nuova struttura consente una migliore categorizzazione degli utenti del sistema e una rappresentazione più chiara dei loro ruoli.

## Architettura del Sistema

Refood è un sistema centralizzato che gestisce la distribuzione di prodotti alimentari per prevenire lo spreco. Il sistema è composto da:

1. **Un centro di distribuzione centrale** che coordina tutte le attività
2. **Diversi tipi di utenti** che interagiscono con il sistema

Gli utenti si dividono in due categorie principali:

### Categoria ORGANIZZAZIONE
- **Operatore**: Gestisce operativamente le attività della piattaforma
- **Amministratore**: Ha accesso completo alla configurazione del sistema

### Categoria UTENTE
- **Privato**: Utenti singoli che possono prenotare prodotti
- **Canale sociale**: Organizzazioni che redistribuiscono i prodotti a persone bisognose
- **Centro riciclo**: Strutture che gestiscono il riciclaggio di prodotti non consumabili

## Nuovo Flusso di Registrazione

### Passo 1: Selezione della Tipologia
L'utente deve selezionare se si sta registrando come:
- **Organizzazione** (parte dello staff di Refood)
- **Utente** (cliente che utilizza i servizi di Refood)

### Passo 2: Dati Personali
L'utente inserisce i dati personali comuni a tutte le tipologie:
- Email (che fungerà da identificativo univoco)
- Password
- Nome
- Cognome

### Passo 3: Selezione del Ruolo Specifico

#### Se "Organizzazione" è selezionato:
L'utente deve scegliere tra:
- **Operatore**
- **Amministratore**

Questi ruoli vengono salvati direttamente nel campo `ruolo` della tabella `Attori`.

#### Se "Utente" è selezionato:
L'utente deve scegliere tra:
- **Privato**
- **Canale sociale**
- **Centro riciclo**

In questo caso:
1. Nel campo `ruolo` della tabella `Attori` viene salvato il valore "Utente"
2. Viene creato un record nella tabella `Tipo_Utente` con il tipo specifico scelto
3. Viene creata un'associazione nella tabella `AttoriTipoUtente`

### Passo 4: Dati Aggiuntivi
Se l'utente ha selezionato un tipo utente, deve inserire anche:
- Indirizzo
- Telefono

## Note Importanti per gli Sviluppatori

1. **Validazione**: Il sistema verifica che solo attori con ruolo "Utente" possano essere associati a un `Tipo_Utente`
2. **Compatibilità**: Il sistema mantiene la retrocompatibilità con gli URL precedenti (/centri ora reindirizza a /tipi-utente)
3. **Migrazione**: Uno script di migrazione è stato implementato per convertire i dati esistenti al nuovo schema

## Come Eseguire la Migrazione

Per migrare i dati esistenti al nuovo schema, eseguire:

```bash
npm run migrate:utenti-to-attori
```

Questo script eseguirà in modo sicuro la conversione di tutti gli utenti esistenti al nuovo schema, mantenendo le associazioni corrette tra attori e tipi utente.

## Verifiche Post-Migrazione

Dopo la migrazione, verificare che:

1. Tutti gli utenti precedentemente classificati come "CentroSociale" siano ora "Utente" con tipo "Canale sociale"
2. Tutti gli utenti precedentemente classificati come "CentroRiciclaggio" siano ora "Utente" con tipo "centro riciclo"
3. Le associazioni nella tabella `AttoriTipoUtente` siano corrette
4. Le autorizzazioni funzionino correttamente in base ai nuovi ruoli

## Supporto

Per qualsiasi problema relativo alla migrazione o al nuovo flusso di registrazione, contattare il team di sviluppo. 