# Istruzioni per l'aggiornamento manuale del frontend

Per completare la migrazione del frontend da "Centri" a "Tipi Utente", è necessario eseguire una serie di sostituzioni nei file del frontend. Di seguito sono riportati i comandi da eseguire dalla directory principale del progetto.

## Preparazione

1. **Backup dei file frontend**:
   ```bash
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   BACKUP_DIR="migrations/backup_frontend_${TIMESTAMP}"
   mkdir -p "$BACKUP_DIR"
   cp -r refood-mobile "$BACKUP_DIR/"
   ```

## Aggiornamento dei file

### 1. Aggiornamento degli endpoint API
```bash
find refood-mobile -type f -name "*.tsx" -exec sed -i 's|/centri|/tipi-utente|g' {} \;
find refood-mobile -type f -name "*.ts" -exec sed -i 's|/centri|/tipi-utente|g' {} \;
```

### 2. Aggiornamento delle variabili e stati
```bash
find refood-mobile -type f -name "*.tsx" -exec sed -i 's/\bcentri\b/tipiUtente/g; s/\bCentri\b/TipiUtente/g; s/\bcentro\b/tipoUtente/g; s/\bCentro\b/TipoUtente/g' {} \;
find refood-mobile -type f -name "*.ts" -exec sed -i 's/\bcentri\b/tipiUtente/g; s/\bCentri\b/TipiUtente/g; s/\bcentro\b/tipoUtente/g; s/\bCentro\b/TipoUtente/g' {} \;
```

### 3. Aggiornamento dei campi negli oggetti
```bash
find refood-mobile -type f -name "*.tsx" -exec sed -i 's/centro_id/tipo_utente_id/g' {} \;
find refood-mobile -type f -name "*.ts" -exec sed -i 's/centro_id/tipo_utente_id/g' {} \;
```

### 4. Aggiornamento dei percorsi di routing
```bash
find refood-mobile -type f -name "*.tsx" -exec sed -i 's|/admin/centri|/admin/tipi-utente|g' {} \;
```

### 5. Aggiornamento dei testi nell'UI
```bash
find refood-mobile -type f -name "*.tsx" -exec sed -i 's/"Gestione Centri"/"Gestione Tipi Utente"/g; s/"I Miei Centri"/"I Miei Tipi Utente"/g' {} \;
```

### 6. Aggiornamento dei valori dei tipi
```bash
find refood-mobile -type f -name "*.tsx" -exec sed -i 's/"Distribuzione"/"Privato"/g; s/"Sociale"/"Canale sociale"/g; s/"Riciclaggio"/"centro riciclo"/g' {} \;
```

## Verifica

Dopo aver eseguito queste sostituzioni, è importante verificare manualmente i file principali per assicurarsi che le sostituzioni siano state eseguite correttamente e non abbiano introdotto errori.

In particolare, controllare:

1. I file nella directory `refood-mobile/app/admin`
2. I componenti che gestiscono i lotti e le prenotazioni
3. La struttura delle interfacce e dei tipi

Se necessario, ripristinare i file dalla directory di backup. 