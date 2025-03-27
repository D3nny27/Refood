/**
 * Script per ispezionare il database e identificare problemi di migrazione
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

// Funzione principale asincrona
async function checkDatabase() {
  try {
    // Lista tutte le tabelle nel database
    const tables = await query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    console.log('Tabelle presenti nel database:');
    tables.forEach(table => console.log(`- ${table.name}`));
    console.log();
    
    // Controlla tabella Utenti
    if (tables.some(table => table.name === 'Utenti')) {
      console.log('Contenuto della tabella Utenti:');
      const utenti = await query('SELECT id, email, nome, cognome, ruolo FROM Utenti LIMIT 10');
      console.log(utenti);
      
      // Controlla se ci sono email duplicate
      const duplicateEmails = await query(`
        SELECT email, COUNT(*) as count
        FROM Utenti
        GROUP BY email
        HAVING COUNT(*) > 1
      `);
      
      if (duplicateEmails.length > 0) {
        console.log('\nEmail duplicate in Utenti:');
        console.log(duplicateEmails);
      }
    }
    
    // Controlla tabella Centri
    if (tables.some(table => table.name === 'Centri')) {
      console.log('\nContenuto della tabella Centri:');
      const centri = await query('SELECT id, nome, tipo, email FROM Centri LIMIT 10');
      console.log(centri);
      
      // Conta centri con email NULL o vuota
      const noEmail = await query(`
        SELECT COUNT(*) as count
        FROM Centri
        WHERE email IS NULL OR email = ''
      `);
      
      console.log(`\nCentri senza email: ${noEmail[0].count}`);
      
      // Trova email duplicate tra Utenti e Centri
      const duplicateEmailsAcrossTables = await query(`
        SELECT c.id as centro_id, c.email, u.id as utente_id
        FROM Centri c
        JOIN Utenti u ON c.email = u.email
        WHERE c.email IS NOT NULL AND c.email != ''
        LIMIT 20
      `);
      
      if (duplicateEmailsAcrossTables.length > 0) {
        console.log('\nEmail duplicate tra Utenti e Centri:');
        console.log(duplicateEmailsAcrossTables);
      }
    }
    
    // Verifica altre informazioni utili per la migrazione
    console.log('\nInformazioni utili per la migrazione:');
    
    // Controlla TokenAutenticazione
    if (tables.some(table => table.name === 'TokenAutenticazione')) {
      const tokenCount = await query('SELECT COUNT(*) as count FROM TokenAutenticazione');
      console.log(`Token di autenticazione: ${tokenCount[0].count}`);
      
      // Mostra un esempio di token
      const tokenExample = await query('SELECT * FROM TokenAutenticazione LIMIT 1');
      if (tokenExample.length > 0) {
        console.log('Esempio di token:');
        console.log(tokenExample[0]);
      }
    }
    
    // Controlla Notifiche
    if (tables.some(table => table.name === 'Notifiche')) {
      const notificheCount = await query('SELECT COUNT(*) as count FROM Notifiche');
      console.log(`Notifiche: ${notificheCount[0].count}`);
      
      // Conteggio notifiche con destinatario_id NULL
      const nullDestCount = await query('SELECT COUNT(*) as count FROM Notifiche WHERE destinatario_id IS NULL');
      console.log(`Notifiche con destinatario_id NULL: ${nullDestCount[0].count}`);
    }

  } catch (error) {
    console.error('Errore durante il controllo del database:', error);
  } finally {
    // Chiudi la connessione al database
    db.close();
  }
}

// Esegui lo script
checkDatabase().catch(err => {
  console.error('Errore durante l\'esecuzione dello script:', err);
  db.close();
}); 