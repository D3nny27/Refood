const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const logger = require('../utils/logger');

// Percorso del file di migrazione
const migrationFilePath = path.join(__dirname, 'remove_tipo_utente_origine_id.sql');

// Percorso del database
const dbPath = process.env.DB_PATH 
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', '..', '..', 'database', 'refood.db');

console.log(`Percorso del database: ${dbPath}`);

// Leggi il file di migrazione
fs.readFile(migrationFilePath, 'utf8', (err, migrationSql) => {
  if (err) {
    console.error(`Errore nella lettura del file di migrazione: ${err.message}`);
    process.exit(1);
  }

  // Connessione al database
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      console.error(`Errore nella connessione al database: ${err.message}`);
      process.exit(1);
    }
    console.log('Connesso al database SQLite');
    
    // Esegui la migrazione in una transazione
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      console.log('Inizio migrazione...');
      
      // Esegui le istruzioni SQL della migrazione
      db.exec(migrationSql, (err) => {
        if (err) {
          console.error(`Errore nell'esecuzione della migrazione: ${err.message}`);
          db.run('ROLLBACK');
          db.close();
          process.exit(1);
        }
        
        // Commit della transazione
        db.run('COMMIT', (err) => {
          if (err) {
            console.error(`Errore nel commit della transazione: ${err.message}`);
            db.close();
            process.exit(1);
          }
          
          console.log('Migrazione completata con successo');
          
          // Chiudi la connessione al database
          db.close((err) => {
            if (err) {
              console.error(`Errore nella chiusura della connessione: ${err.message}`);
              process.exit(1);
            }
            console.log('Connessione al database chiusa');
          });
        });
      });
    });
  });
}); 