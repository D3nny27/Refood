/**
 * Script di test per verificare la connessione al database
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

// Query di test
db.all('SELECT name FROM sqlite_master WHERE type="table" AND name NOT LIKE "sqlite_%"', [], (err, rows) => {
  if (err) {
    console.error(`Errore nell'esecuzione della query: ${err.message}`);
  } else {
    console.log('Tabelle nel database:');
    rows.forEach(row => {
      console.log(`- ${row.name}`);
    });
  }
  
  // Chiudi la connessione al database
  db.close((err) => {
    if (err) {
      console.error(`Errore nella chiusura della connessione: ${err.message}`);
    } else {
      console.log('Connessione al database chiusa');
    }
  });
}); 