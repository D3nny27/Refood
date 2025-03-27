/**
 * Uso: node run_migration.js <path-to-sql-file>
 * 
 * Script per eseguire migrazioni SQL sul database SQLite
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');

// Carica variabili d'ambiente
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Verifica che sia stato specificato un file di migrazione
if (process.argv.length < 3) {
  console.error('Specificare il file di migrazione: node run_migration.js <path-to-sql-file>');
  process.exit(1);
}

// Percorso del file di migrazione
const migrationFilePath = path.resolve(process.cwd(), process.argv[2]);

// Verifica che il file esista
if (!fs.existsSync(migrationFilePath)) {
  console.error(`File di migrazione non trovato: ${migrationFilePath}`);
  process.exit(1);
}

// Leggi il contenuto del file di migrazione
const migrationSQL = fs.readFileSync(migrationFilePath, 'utf8');

// Leggi il percorso del database dal file .env o usa un valore predefinito
const dbPath = process.env.DB_PATH || '../database/refood.db';
const absoluteDbPath = path.resolve(__dirname, '..', dbPath);

console.log(`Database path: ${absoluteDbPath}`);

// Verifica che il database esista
if (!fs.existsSync(absoluteDbPath)) {
  console.error(`Database non trovato: ${absoluteDbPath}`);
  process.exit(1);
}

// Crea una connessione al database
const db = new sqlite3.Database(absoluteDbPath);

// Esegui la migrazione
async function runMigration() {
  return new Promise((resolve, reject) => {
    // Abilita il supporto per le transazioni e le istruzioni multiple
    db.serialize(() => {
      // Inizia una transazione
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('Errore nell\'avvio della transazione:', err.message);
          return reject(err);
        }
        
        console.log('Migrazione in corso...');
        
        // Esegui la migrazione
        db.exec(migrationSQL, (err) => {
          if (err) {
            console.error('Errore durante l\'esecuzione della migrazione:', err.message);
            
            // Rollback in caso di errore
            db.run('ROLLBACK', () => {
              console.log('Eseguito rollback della transazione');
              reject(err);
            });
          } else {
            // Commit in caso di successo
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('Errore durante il commit della transazione:', err.message);
                reject(err);
              } else {
                console.log('Migrazione completata con successo');
                resolve();
              }
            });
          }
        });
      });
    });
  });
}

// Esegui la migrazione e gestisci la chiusura del database
runMigration()
  .then(() => {
    // Chiudi la connessione al database
    db.close((err) => {
      if (err) {
        console.error('Errore durante la chiusura del database:', err.message);
        process.exit(1);
      }
      console.log('Connessione al database chiusa');
    });
  })
  .catch((err) => {
    // Chiudi la connessione al database in caso di errore
    db.close((closeErr) => {
      if (closeErr) {
        console.error('Errore durante la chiusura del database:', closeErr.message);
      }
      console.log('Connessione al database chiusa');
      process.exit(1);
    });
  }); 