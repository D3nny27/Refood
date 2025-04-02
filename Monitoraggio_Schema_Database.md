# Sistema di Monitoraggio dello Schema del Database Refood

## Panoramica

Il sistema Refood include un meccanismo automatico di monitoraggio dello schema del database che consente di:
- Rilevare modifiche non autorizzate allo schema
- Tenere traccia dei cambiamenti allo schema nel tempo
- Eseguire backup automatici in caso di modifiche
- Notificare potenziali problemi agli amministratori

Questo documento spiega come il sistema funziona su diverse piattaforme.

## Implementazione Multi-piattaforma

Il sistema di monitoraggio è stato progettato per funzionare sia su Linux/macOS che su Windows, utilizzando gli strumenti di pianificazione appropriati per ogni sistema operativo:

- **Linux/macOS**: Utilizza `crontab` per pianificare l'esecuzione periodica
- **Windows**: Utilizza `Task Scheduler` (Pianificazione attività) per lo stesso scopo

## Componenti del Sistema

Il sistema di monitoraggio è composto da:

1. **Tabelle di monitoraggio**:
   - `SchemaRiferimento`: Memorizza lo schema di riferimento atteso
   - `SchemaDiscrepanze`: Registra le discrepanze rilevate
   - `SchemaModifiche`: Tiene traccia delle modifiche allo schema

2. **Script di verifica**:
   - Linux/macOS: `maintenance_scripts/verify_schema.sh`
   - Windows: `maintenance_scripts/verify_schema.bat`

3. **Script SQL**:
   - `schema_monitor.sql`: Verifica lo schema e rileva discrepanze
   - `schema_fix.sql`: Corregge automaticamente discrepanze note

4. **Job pianificati**:
   - Linux/macOS: Job cron eseguito ogni domenica alle 2:30
   - Windows: Attività pianificata eseguita ogni domenica alle 2:30

## Configurazione Automatica su Windows

Durante l'inizializzazione del database con `setup_db_refood.bat`, il sistema:

1. Crea le directory necessarie (`maintenance_scripts`, `maintenance_scripts\logs`)
2. Genera lo script di verifica `verify_schema.bat`
3. Crea un file XML di configurazione per Task Scheduler
4. Configura un'attività pianificata chiamata `Refood_Schema_Monitor`

Questa configurazione assicura che lo schema del database venga verificato regolarmente senza richiedere l'intervento manuale dell'utente.

## Configurazione Automatica su Linux/macOS

Su sistemi Linux/macOS, il processo è simile ma utilizza crontab:

1. Crea lo script di verifica `verify_schema.sh`
2. Rende lo script eseguibile
3. Aggiunge un job cron per l'esecuzione settimanale

## Verifica Manuale dello Schema

Per verificare manualmente lo schema del database:

### Su Windows:
```batch
cd [percorso_progetto]
maintenance_scripts\verify_schema.bat
```

### Su Linux/macOS:
```bash
cd [percorso_progetto]
./maintenance_scripts/verify_schema.sh
```

I log della verifica saranno disponibili nella directory `maintenance_scripts/logs`.

## Configurazione Manuale (se necessario)

### Windows (Task Scheduler):

1. Aprire Task Scheduler (taskschd.msc)
2. Fare clic su "Crea attività..."
3. Nella scheda "Generale":
   - Nome: `Refood_Schema_Monitor`
   - Eseguire con privilegi più elevati: Sì
4. Nella scheda "Trigger":
   - Nuovo > Settimanale > Domenica > 02:30
5. Nella scheda "Azioni":
   - Azione: Avvia un programma
   - Programma/script: percorso completo a `verify_schema.bat`
   - Directory di avvio: directory del progetto

### Linux/macOS (crontab):

1. Aprire il terminale e digitare `crontab -e`
2. Aggiungere la riga seguente:
   ```
   30 2 * * 0 /percorso/completo/maintenance_scripts/verify_schema.sh >> /percorso/completo/maintenance_scripts/logs/cron_verify_schema.log 2>&1
   ```
3. Salvare e uscire

## Risoluzione dei Problemi

### Windows:
- Se Task Scheduler non può essere configurato automaticamente, controllare che l'utente abbia i privilegi di amministratore
- Verificare che lo script `verify_schema.bat` sia nel percorso corretto
- Controllare i log di Task Scheduler in "Visualizzatore eventi" > "Log di Windows" > "Applicazione"

### Linux/macOS:
- Verificare che lo script `verify_schema.sh` abbia i permessi di esecuzione (`chmod +x`)
- Controllare i log in `/var/log/syslog` o `/var/log/cron`
- Verificare la configurazione crontab con `crontab -l`

## Disattivazione Temporanea

### Windows:
1. Aprire Task Scheduler
2. Trovare l'attività `Refood_Schema_Monitor`
3. Fare clic con il pulsante destro e selezionare "Disabilita"

### Linux/macOS:
1. Aprire il terminale e digitare `crontab -e`
2. Commentare la riga relativa a `verify_schema.sh` aggiungendo `#` all'inizio
3. Salvare e uscire 