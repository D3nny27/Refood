/**
 * Script per verificare lo schema delle tabelle nel database
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Percorso del database
const dbPath = '../database/refood.db';
const absoluteDbPath = path.resolve(__dirname, '..', dbPath);

console.log(`Database path: ${absoluteDbPath}`);

// Verifica che il database esista
if (!fs.existsSync(absoluteDbPath)) {
  console.error(`Database non trovato: ${absoluteDbPath}`);
  process.exit(1);
}

// Crea una connessione al database
const db = new sqlite3.Database(absoluteDbPath, (err) => {
  if (err) {
    console.error(`Errore nella connessione al database: ${err.message}`);
    process.exit(1);
  }
  console.log('Connessione al database SQLite stabilita');
});

// Tabelle da esaminare
const tablesToCheck = ['Utenti', 'Centri', 'TokenAutenticazione', 'TokenRevocati', 'Prenotazioni', 'Notifiche', 'LogCambioStato'];

// Funzione per ottenere le informazioni sulle colonne di una tabella
function getTableSchema(tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        console.log(`\nSchema della tabella ${tableName}:`);
        rows.forEach(column => {
          console.log(`- ${column.name} (${column.type}) ${column.notnull ? 'NOT NULL' : ''} ${column.pk ? 'PRIMARY KEY' : ''}`);
        });
        resolve(rows);
      }
    });
  });
}

// Verifica ogni tabella
async function checkTables() {
  try {
    for (const tableName of tablesToCheck) {
      await getTableSchema(tableName);
    }
  } catch (error) {
    console.error(`Errore nella verifica degli schemi: ${error.message}`);
  } finally {
    // Chiudi la connessione al database
    db.close((err) => {
      if (err) {
        console.error(`Errore nella chiusura della connessione: ${err.message}`);
      } else {
        console.log('\nConnessione al database chiusa');
      }
    });
  }
}

// Esegui la verifica
checkTables(); 