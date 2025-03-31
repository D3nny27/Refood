# Sistema di Autoconfigurazione del Monitoraggio Schema

## Panoramica

Il sistema di autoconfigurazione è un'estensione del sistema di monitoraggio dello schema che permette l'installazione e la configurazione automatica di tutte le componenti necessarie alla prima esecuzione dell'applicazione, senza richiedere alcun intervento manuale.

## Funzionamento

Il sistema si avvia automaticamente all'inizializzazione del server backend e esegue i seguenti passaggi:

1. **Verifica dell'esistenza del sistema**: controlla se le tabelle di monitoraggio schema esistono già nel database.
2. **Creazione delle directory**: crea automaticamente le directory necessarie per i file di monitoraggio e i backup.
3. **Generazione dei file di configurazione**: crea i file SQL e gli script bash necessari per il monitoraggio e la correzione dello schema.
4. **Inizializzazione del database**: crea le tabelle di monitoraggio nel database e le popola con lo schema di riferimento.
5. **Configurazione dei job periodici**: configura i job cron per la verifica periodica dello schema (solo in ambiente di produzione).

## Componenti Generate Automaticamente

### 1. File SQL

- **schema_monitor.sql**: Script per la verifica dello schema. Contiene la definizione delle tabelle di monitoraggio e la logica per il rilevamento delle discrepanze.
- **schema_fix.sql**: Script per la correzione automatica delle discrepanze rilevate.

### 2. Script Bash

- **safe_schema_exec.sh**: Script per l'esecuzione sicura di modifiche allo schema, con backup automatici.
- **verify_schema.sh**: Script per la verifica periodica dello schema e l'avvio automatico della correzione in caso di discrepanze.

### 3. Job Cron

- **Verifica settimanale**: Configurazione di un job cron per l'esecuzione settimanale della verifica dello schema (ogni domenica alle 2:30 AM).

## Vantaggi dell'Autoconfigurazione

- **Zero configurazione**: l'utente non deve eseguire manualmente alcun comando per configurare il sistema.
- **Consistenza**: tutti i sistemi di monitoraggio e correzione sono configurati in modo uniforme.
- **Adattamento automatico**: il sistema si adatta automaticamente all'ambiente in cui viene eseguito.
- **Prevenzione errori**: evita errori umani nella configurazione manuale.

## Integrazione nel Backend

Il sistema di autoconfigurazione è integrato nel backend tramite il modulo `schema_autosetup.js`, che viene eseguito all'avvio del server:

```javascript
// Estratto dal file server.js
const schemaMonitor = require('./init/schema_autosetup');

async function startServer() {
  try {
    // Verifica e configura automaticamente il sistema di monitoraggio schema
    await schemaMonitor.configureMonitoringSystem();
    
    // Avvia il server
    // ...
  } catch (error) {
    // ...
  }
}
```

## Comportamento in Ambienti Diversi

- **Produzione**: Configura completamente il sistema, inclusi i job cron.
- **Sviluppo**: Configura il sistema di monitoraggio ma non i job cron automatici.

## Tracciamento e Logging

Tutte le operazioni di autoconfigurazione vengono registrate nel sistema di logging dell'applicazione, permettendo di tracciare l'esecuzione e identificare eventuali problemi:

- Creazione delle directory
- Generazione dei file di configurazione
- Inizializzazione delle tabelle nel database
- Popolamento dello schema di riferimento
- Configurazione dei job cron

## Conclusioni

Il sistema di autoconfigurazione garantisce che il monitoraggio dello schema sia sempre attivo e correttamente configurato, indipendentemente dal dispositivo o dall'ambiente in cui l'applicazione viene eseguita. Questo approccio "zero configurazione" migliora significativamente l'esperienza dell'utente e riduce il rischio di errori dovuti a una configurazione manuale errata o incompleta.

