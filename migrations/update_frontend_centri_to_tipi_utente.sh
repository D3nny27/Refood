#!/bin/bash

# Script per aggiornare automaticamente il frontend da Centri a Tipo_Utente
# Questo script trova e sostituisce tutte le occorrenze di centri/Centri con tipi-utente/TipiUtente nei file di frontend
# Utilizzo: ./update_frontend_centri_to_tipi_utente.sh

echo "Script di aggiornamento frontend da Centri a Tipo_Utente"
echo "-------------------------------------------------------"
echo

# Verifica se siamo nella directory corretta
if [ ! -d "refood-mobile" ]; then
  echo "Errore: Questo script deve essere eseguito dalla directory principale del progetto"
  exit 1
fi

# Crea un backup di tutti i file che verranno modificati
echo "Creazione backup dei file frontend..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="migrations/backup_frontend_${TIMESTAMP}"
mkdir -p "$BACKUP_DIR/refood-mobile"

# Backup dei file dell'app mobile
cp -r refood-mobile "$BACKUP_DIR/"

echo "Backup completato in ${BACKUP_DIR}"
echo

# Funzione per aggiornare le API
update_api_endpoints() {
  echo "Aggiornamento degli endpoint API..."
  
  # Modifica gli endpoint API nelle chiamate fetch
  find refood-mobile -type f -name "*.tsx" -exec sed -i 's|/centri|/tipi-utente|g' {} \;
  find refood-mobile -type f -name "*.ts" -exec sed -i 's|/centri|/tipi-utente|g' {} \;
  
  echo "  Endpoint API aggiornati."
}

# Funzione per aggiornare i nomi delle variabili
update_variables() {
  echo "Aggiornamento delle variabili e stati..."
  
  # Modifica i nomi delle variabili
  find refood-mobile -type f -name "*.tsx" -exec sed -i 's/\bcentri\b/tipiUtente/g; s/\bCentri\b/TipiUtente/g; s/\bcentro\b/tipoUtente/g; s/\bCentro\b/TipoUtente/g' {} \;
  find refood-mobile -type f -name "*.ts" -exec sed -i 's/\bcentri\b/tipiUtente/g; s/\bCentri\b/TipiUtente/g; s/\bcentro\b/tipoUtente/g; s/\bCentro\b/TipoUtente/g' {} \;
  
  # Modifica i tipi nei campi
  find refood-mobile -type f -name "*.tsx" -exec sed -i 's/centro_id/tipo_utente_id/g' {} \;
  find refood-mobile -type f -name "*.ts" -exec sed -i 's/centro_id/tipo_utente_id/g' {} \;
  
  echo "  Variabili e stati aggiornati."
}

# Funzione per aggiornare i percorsi di routing
update_routes() {
  echo "Aggiornamento dei percorsi di routing..."
  
  # Modifica i percorsi nelle navigazioni
  find refood-mobile -type f -name "*.tsx" -exec sed -i 's|/admin/centri|/admin/tipi-utente|g' {} \;
  
  echo "  Percorsi di routing aggiornati."
}

# Funzione per aggiornare i testi UI
update_ui_texts() {
  echo "Aggiornamento dei testi nell'interfaccia utente..."
  
  # Modifica i testi visibili nell'UI
  find refood-mobile -type f -name "*.tsx" -exec sed -i 's/"Gestione Centri"/"Gestione Tipi Utente"/g; s/"I Miei Centri"/"I Miei Tipi Utente"/g' {} \;
  
  echo "  Testi UI aggiornati."
}

# Funzione per aggiornare i tipi di centri
update_types() {
  echo "Aggiornamento dei valori dei tipi..."
  
  # Modifica i valori dei tipi
  find refood-mobile -type f -name "*.tsx" -exec sed -i 's/"Distribuzione"/"Privato"/g; s/"Sociale"/"Canale sociale"/g; s/"Riciclaggio"/"centro riciclo"/g' {} \;
  
  echo "  Valori dei tipi aggiornati."
}

# Esegui tutte le funzioni di aggiornamento
update_api_endpoints
update_variables
update_routes
update_ui_texts
update_types

echo
echo "Migrazione del frontend completata! Verifica i file modificati e testa l'applicazione."
echo "In caso di problemi, puoi ripristinare i backup da ${BACKUP_DIR}"
echo