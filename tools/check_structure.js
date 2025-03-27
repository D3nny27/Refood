/**
 * Script per verificare la STRUTTURA del database
 * Questo script è DIVERSO da check_database.js
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');

// Carica variabili d'ambiente
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

// Funzione per eseguire una query e restituire i risultati come Promise
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Funzione per ottenere la definizione di una tabella
function getTableDefinition(tableName) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row ? row.sql : null);
      }
    });
  });
}

// Funzione principale asincrona
async function checkDatabaseStructure() {
  try {
    console.log("***** VERIFICA STRUTTURA POST MIGRAZIONE *****");
    console.log("============================================");
    console.log("NOTA: Questo è lo script check_structure.js");
    
    // Lista tutte le tabelle nel database
    const tables = await query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    console.log('\nTabelle presenti nel database:');
    tables.forEach(table => console.log(`- ${table.name}`));
    
    // Verifica se la tabella Attori esiste
    const attoriExists = tables.some(table => table.name === 'Attori');
    console.log(`\nLa tabella Attori ${attoriExists ? 'ESISTE' : 'NON ESISTE'}`);
    
    if (attoriExists) {
      // Mostra la definizione della tabella Attori
      const attoriDefinition = await getTableDefinition('Attori');
      console.log('\nDefinizione della tabella Attori:');
      console.log(attoriDefinition);
      
      // Elenca colonne della tabella Attori
      const attoriColumns = await query(`PRAGMA table_info(Attori)`);
      console.log('\nColonne della tabella Attori:');
      attoriColumns.forEach(col => console.log(`- ${col.name} (${col.type})`));
      
      // Mostra i primi record della tabella Attori
      const attori = await query('SELECT * FROM Attori LIMIT 3');
      console.log('\nPrimi 3 record della tabella Attori:');
      console.log(attori);
    }
    
    // Verifica se la tabella Utenti esiste
    const utentiExists = tables.some(table => table.name === 'Utenti');
    console.log(`\nLa tabella Utenti ${utentiExists ? 'ESISTE' : 'NON ESISTE'}`);
    
    if (utentiExists) {
      // Mostra la definizione della tabella Utenti
      const utentiDefinition = await getTableDefinition('Utenti');
      console.log('\nDefinizione della tabella Utenti:');
      console.log(utentiDefinition);
      
      // Elenca colonne della tabella Utenti
      const utentiColumns = await query(`PRAGMA table_info(Utenti)`);
      console.log('\nColonne della tabella Utenti:');
      utentiColumns.forEach(col => console.log(`- ${col.name} (${col.type})`));
      
      // Verifica tipo struttura Utenti
      const hasRuoloColumn = utentiColumns.some(col => col.name === 'ruolo');
      const hasTipoColumn = utentiColumns.some(col => col.name === 'tipo');
      
      console.log(`\nLa tabella Utenti ha la colonna 'ruolo': ${hasRuoloColumn ? 'SÌ' : 'NO'}`);
      console.log(`La tabella Utenti ha la colonna 'tipo': ${hasTipoColumn ? 'SÌ' : 'NO'}`);
      console.log(`Conclusione: La tabella Utenti ha ${hasRuoloColumn ? 'la vecchia struttura' : hasTipoColumn ? 'la nuova struttura (ex Centri)' : 'una struttura sconosciuta'}`);
    }
    
    // Verifica se la tabella Centri esiste ancora
    const centriExists = tables.some(table => table.name === 'Centri');
    console.log(`\nLa tabella Centri ${centriExists ? 'ESISTE ANCORA' : 'è stata ELIMINATA'}`);
    
    if (centriExists) {
      // Elenca colonne della tabella Centri
      const centriColumns = await query(`PRAGMA table_info(Centri)`);
      console.log('\nColonne della tabella Centri:');
      centriColumns.forEach(col => console.log(`- ${col.name} (${col.type})`));
    }

  } catch (error) {
    console.error('Errore durante la verifica della struttura del database:', error);
  } finally {
    // Chiudi la connessione al database
    db.close();
  }
}

// Esegui lo script
checkDatabaseStructure().catch(err => {
  console.error('Errore durante l\'esecuzione dello script:', err);
  db.close();
}); 