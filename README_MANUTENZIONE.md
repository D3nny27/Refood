# Sistema di Manutenzione Automatica Database ReFood

Questo documento descrive il sistema di manutenzione automatica implementato per il database ReFood, spiegando le procedure configurate, la loro frequenza e come gestirle.

## Panoramica

Il database ReFood richiede manutenzione periodica per garantire l'integrità dei dati, aggiornare lo stato dei lotti in base alla loro scadenza, gestire i token scaduti e raccogliere statistiche. Queste operazioni sono state automatizzate tramite job cron che eseguono specifici script SQL.

## Struttura del Sistema

Il sistema di manutenzione automatica è composto da:

- **Script SQL individuali**: Ogni procedura di manutenzione è implementata come uno script SQL separato
- **Script shell di supporto**: Script che si occupa di eseguire le query SQL e registrare i risultati
- **Job cron**: Configurazione per l'esecuzione periodica degli script
- **Sistema di logging**: Ogni esecuzione viene documentata in file di log specifici

### Directory Principali

- **Directory base**: `/home/denny/Documenti/Tesi`
- **Database**: `/home/denny/Documenti/Tesi/database/refood.db`
- **Script di manutenzione**: `/home/denny/Documenti/Tesi/maintenance_scripts/`
- **Log**: `/home/denny/Documenti/Tesi/maintenance_scripts/logs/`

## Procedure di Manutenzione

Sono state implementate le seguenti procedure di manutenzione automatica:

### 1. Aggiornamento Stato Lotti (`update_lotti_status.sql`)

- **Frequenza**: Giornaliera (00:10)
- **Descrizione**: Aggiorna lo stato dei lotti da "Verde" a "Arancione" e da "Arancione" a "Rosso" in base alla loro data di scadenza
- **Parametri usati**: `soglia_stato_arancione` e `soglia_stato_rosso` dalla tabella `ParametriSistema`
- **Note**: Genera automaticamente un log delle modifiche nella tabella `LogCambioStato`

### 2. Pulizia Token Scaduti (`cleanup_tokens.sql`)

- **Frequenza**: Giornaliera (02:00)
- **Descrizione**: Identifica i token di autenticazione scaduti, li marca come revocati nella tabella `TokenAutenticazione` e li aggiunge alla tabella `TokenRevocati`
- **Note**: Utilizza un ID amministratore valido per la revoca

### 3. Statistiche Settimanali (`weekly_statistics.sql`)

- **Frequenza**: Settimanale (lunedì alle 01:00)
- **Descrizione**: Calcola e aggiorna le statistiche settimanali per ogni tipo di utente
- **Dati raccolti**: Quantità salvata, peso totale, CO2 risparmiata, valore economico, numero di lotti
- **Note**: Utilizza la settimana ISO (1-53) per l'identificazione

### 4. Aggiornamento Stato Prenotazioni (`update_prenotazioni_status.sql`)

- **Frequenza**: Ogni ora
- **Descrizione**: Rifiuta automaticamente le prenotazioni in stato "InAttesa" da più di 48 ore
- **Note**: Aggiorna anche il log delle transizioni di stato nella prenotazione

### 5. Verifica Integrità Database (`db_integrity.sql`)

- **Frequenza**: Settimanale (domenica alle 03:00)
- **Descrizione**: Verifica e corregge problemi di integrità referenziale nel database
- **Operazioni**:
  - Corregge riferimenti non validi nelle tabelle principali
  - Aggiorna lo stato dei lotti se necessario
  - Genera un rapporto dettagliato delle correzioni effettuate
- **Note**: Usa una strategia di fallback per identificare un ID amministratore valido

## Come Installare/Configurare

Il sistema di manutenzione può essere installato eseguendo lo script `install_maintenance_cron.sh`:

```bash
cd /home/denny/Documenti/Tesi
./install_maintenance_cron.sh
```

Questo script:
1. Crea la directory per gli script di manutenzione
2. Genera tutti gli script SQL necessari
3. Crea lo script shell per l'esecuzione
4. Prepara e offre di installare i job cron
5. Offre di eseguire immediatamente una verifica dell'integrità

## Gestione e Monitoraggio

### Visualizzare i job configurati

Per visualizzare i job cron configurati:

```bash
crontab -l
```

### Modificare la schedulazione

Per modificare la frequenza o i tempi di esecuzione:

```bash
crontab -e
```

### Esecuzione manuale

Per eseguire manualmente una procedura di manutenzione:

```bash
cd /home/denny/Documenti/Tesi
maintenance_scripts/run_maintenance.sh <nome_script.sql>
```

Ad esempio:
```bash
maintenance_scripts/run_maintenance.sh db_integrity.sql
```

### Controllare i log

I log di ogni esecuzione sono salvati in file separati nella directory:
```
/home/denny/Documenti/Tesi/maintenance_scripts/logs/
```

Con il formato: `<nome_script>_<data>.log`

## Risoluzione dei Problemi

In caso di errori durante l'esecuzione degli script di manutenzione:

1. Verificare i file di log per identificare il problema specifico
2. Controllare che il database esista e sia accessibile
3. Verificare che gli script SQL e lo script shell abbiano i permessi corretti
4. In caso di errori SQL, verificare che la struttura del database sia compatibile con gli script

## Personalizzazione

Per modificare la logica di una procedura di manutenzione:

1. Modificare il relativo file SQL in `/home/denny/Documenti/Tesi/maintenance_scripts/`
2. Eventualmente eseguire manualmente la procedura per verificare il funzionamento

## Backup e Ripristino

Prima di qualsiasi modifica importante alle procedure o al database, è consigliabile effettuare un backup:

```bash
sqlite3 /home/denny/Documenti/Tesi/database/refood.db .dump > /home/denny/Documenti/Tesi/backup/refood_backup_$(date +%Y%m%d).sql
```

Per ripristinare il database da un backup:

```bash
sqlite3 /home/denny/Documenti/Tesi/database/refood.db < /home/denny/Documenti/Tesi/backup/refood_backup_<data>.sql
```

## Note Finali

Il sistema di manutenzione è progettato per funzionare in modo autonomo, ma è consigliabile controllare periodicamente i log per verificare che tutto funzioni correttamente. In particolare, dopo aggiornamenti importanti del database è opportuno eseguire manualmente una verifica dell'integrità. 