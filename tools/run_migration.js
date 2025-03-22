/**
 * Script per eseguire migrazioni sul database
 * Uso: node run_migration.js <path-to-sql-file>
 */

const fs = require('fs');
const path = require('path');
const db = require('../backend/src/config/database');
const logger = require('../backend/src/utils/logger');

// Verifica se è stato fornito un file di migrazione
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Specificare il file di migrazione: node run_migration.js <path-to-sql-file>');
  process.exit(1);
}

// Percorso completo del file di migrazione
const migrationPath = path.resolve(process.cwd(), migrationFile);
if (!fs.existsSync(migrationPath)) {
  console.error(`Il file di migrazione non esiste: ${migrationPath}`);
  process.exit(1);
}

// Leggi il contenuto del file SQL
console.log(`Esecuzione della migrazione: ${migrationPath}`);
const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

// Esegui la migrazione
async function runMigration() {
  try {
    // Verifica la connessione al database
    const connected = await db.testConnection();
    if (!connected) {
      console.error('Impossibile connettersi al database.');
      process.exit(1);
    }
    
    // Inizia una transazione
    await db.run('BEGIN TRANSACTION');
    
    // Esegui le query della migrazione
    console.log('Esecuzione delle query di migrazione...');
    await db.exec(sqlContent);
    
    // Commit della transazione
    await db.run('COMMIT');
    
    console.log('Migrazione completata con successo!');
  } catch (error) {
    // Rollback in caso di errore
    console.error(`Errore durante la migrazione: ${error.message}`);
    try {
      await db.run('ROLLBACK');
      console.log('Transazione annullata.');
    } catch (rollbackError) {
      console.error(`Errore durante il rollback: ${rollbackError.message}`);
    }
    process.exit(1);
  }
}

// Esegui la migrazione e poi chiudi il processo
runMigration().finally(() => {
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}); 