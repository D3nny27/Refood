#!/bin/bash

# Script per completare la migrazione da Centri a Tipo_Utente
# Utilizzo: ./complete_migration.sh

echo "Script di migrazione automatica da Centri a Tipo_Utente"
echo "-------------------------------------------------------"
echo

# Verifica se siamo nella directory corretta
if [ ! -d "backend" ] || [ ! -d "migrations" ]; then
  echo "Errore: Questo script deve essere eseguito dalla directory principale del progetto"
  exit 1
fi

# Crea un backup di tutti i file che verranno modificati
echo "Creazione backup dei file..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="migrations/backup_${TIMESTAMP}"
mkdir -p "$BACKUP_DIR/controllers" "$BACKUP_DIR/routes" "$BACKUP_DIR/middlewares"

# Backup dei file controller
cp backend/src/controllers/notifiche.controller.js "$BACKUP_DIR/controllers/"
cp backend/src/controllers/lotti.controller.js "$BACKUP_DIR/controllers/"
cp backend/src/controllers/prenotazioni.controller.js "$BACKUP_DIR/controllers/"
cp backend/src/controllers/statistiche.controller.js "$BACKUP_DIR/controllers/"
cp backend/src/controllers/attore.controller.js "$BACKUP_DIR/controllers/"

# Backup dei file route
cp backend/src/routes/notifiche.routes.js "$BACKUP_DIR/routes/"
cp backend/src/routes/prenotazioni.routes.js "$BACKUP_DIR/routes/"
cp backend/src/routes/lotti.routes.js "$BACKUP_DIR/routes/"

echo "Backup completato in ${BACKUP_DIR}"
echo

# Aggiorna i riferimenti nei controller
echo "Aggiornamento dei controller..."

# Funzione per sostituire i riferimenti in un file
update_file() {
  local file=$1
  echo "  Aggiornamento $file..."
  
  # Sostituzioni di base
  sed -i 's/Centri/Tipo_Utente/g' "$file"
  sed -i 's/AttoriCentri/AttoriTipoUtente/g' "$file"
  sed -i 's/CentriTipi/TipoUtenteTipi/g' "$file"
  
  # Sostituzioni in camelCase
  sed -i 's/centro_id/tipo_utente_id/g' "$file"
  sed -i 's/centro_origine_id/tipo_utente_origine_id/g' "$file"
  sed -i 's/centro_ricevente_id/tipo_utente_ricevente_id/g' "$file"
  sed -i 's/centro_trasformazione_id/tipo_utente_trasformazione_id/g' "$file"
  sed -i 's/centro_destinazione_id/tipo_utente_destinazione_id/g' "$file"
  
  # Sostituzioni in PascalCase
  sed -i 's/Centro/TipoUtente/g' "$file"
  
  # Sostituzioni nei valori enum
  sed -i 's/"Distribuzione"/"Privato"/g' "$file"
  sed -i 's/"Sociale"/"Canale sociale"/g' "$file"
  sed -i 's/"Riciclaggio"/"centro riciclo"/g' "$file"
  
  # Aggiorna i messaggi di errore
  sed -i 's/centro non trovato/tipo utente non trovato/g' "$file"
  sed -i 's/Centro non trovato/Tipo utente non trovato/g' "$file"
}

# Aggiorna tutti i controller
update_file "backend/src/controllers/notifiche.controller.js"
update_file "backend/src/controllers/lotti.controller.js"
update_file "backend/src/controllers/prenotazioni.controller.js"
update_file "backend/src/controllers/statistiche.controller.js"
update_file "backend/src/controllers/attore.controller.js"

# Aggiorna le routes
echo "Aggiornamento delle route..."
update_file "backend/src/routes/notifiche.routes.js"
update_file "backend/src/routes/prenotazioni.routes.js"
update_file "backend/src/routes/lotti.routes.js"

# Aggiorna i riferimenti alle funzioni middleware
echo "Aggiornamento riferimenti a middleware..."
find backend/src/routes -name "*.js" -exec sed -i 's/belongsToCenter/belongsToTipoUtente/g' {} \;

echo "Creazione reindirizzamento temporaneo da /centri a /tipi-utente..."

# Crea un file temporaneo
cat > backend/src/routes/centri_redirect.js << 'EOF'
/**
 * Redirect temporaneo dalle vecchie rotte /centri alle nuove /tipi-utente
 * Da rimuovere quando tutti i client sono stati aggiornati
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Log di redirect per tutte le richieste a /centri
router.use((req, res, next) => {
  const originalUrl = req.originalUrl;
  const newUrl = originalUrl.replace('/centri', '/tipi-utente');
  
  logger.info(`Redirecting deprecated route: ${originalUrl} -> ${newUrl}`);
  
  // Mantieni il metodo HTTP originale
  res.redirect(307, newUrl);
});

module.exports = router;
EOF

# Aggiungi il reindirizzamento a index.js
echo "Aggiornamento index.js per reindirizzamento..."
sed -i '/router.use\(\'\/tipi-utente\'/a // Reindirizzamento temporaneo dalle vecchie rotte\nrouter.use(\'\/centri\', require(\'./centri_redirect.js\'));' backend/src/routes/index.js

echo
echo "Migrazione completata! Verifica i file modificati e testa l'applicazione."
echo "In caso di problemi, puoi ripristinare i backup da ${BACKUP_DIR}"
echo
echo "NOTA: È necessario aggiornare manualmente tutte le implementazioni specifiche"
echo "      e verificare ciascuna funzionalità." 