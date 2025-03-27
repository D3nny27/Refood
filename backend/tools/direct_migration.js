/**
 * Script per eseguire direttamente la migrazione con controlli dettagliati
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');

// Carica variabili d'ambiente
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

// Funzione per eseguire una query che non restituisce risultati
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

// Funzione principale per eseguire la migrazione passo dopo passo
async function executeDirectMigration() {
  // Abilita la transazione explicitamente
  let migrationSuccessful = false;
  
  try {
    // Disattiva la modalità di controllo delle chiavi esterne
    console.log("1. Disattivazione foreign keys");
    await run("PRAGMA foreign_keys = OFF");
    
    // Inizio della transazione
    console.log("2. Inizio transazione");
    await run("BEGIN TRANSACTION");
    
    // Verifica se le tabelle esistono prima della migrazione
    console.log("3. Verifica delle tabelle prima della migrazione");
    const tablesBefore = await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    console.log("Tabelle presenti prima della migrazione:");
    tablesBefore.forEach(table => console.log(`- ${table.name}`));
    
    // Step 1: Crea tabelle temporanee per i dati attuali
    console.log("\n4. Creazione tabelle temporanee");
    
    // Tabella temporanea per gli utenti attuali
    console.log("4.1. Creazione temp_utenti");
    await run("CREATE TABLE temp_utenti AS SELECT * FROM Utenti");
    
    // Tabella temporanea per i centri attuali
    console.log("4.2. Creazione temp_centri");
    await run("CREATE TABLE temp_centri AS SELECT * FROM Centri");
    
    // Tabella temporanea per token autenticazione
    console.log("4.3. Creazione temp_token_autenticazione");
    await run("CREATE TABLE temp_token_autenticazione AS SELECT * FROM TokenAutenticazione");
    
    // Tabella temporanea per token revocati
    console.log("4.4. Creazione temp_token_revocati");
    await run("CREATE TABLE temp_token_revocati AS SELECT * FROM TokenRevocati");
    
    // Backup di altre tabelle con relazioni
    console.log("4.5. Creazione temp_log_cambio_stato");
    await run("CREATE TABLE temp_log_cambio_stato AS SELECT * FROM LogCambioStato");
    
    console.log("4.6. Creazione temp_prenotazioni");
    await run("CREATE TABLE temp_prenotazioni AS SELECT * FROM Prenotazioni");
    
    console.log("4.7. Creazione temp_notifiche");
    await run("CREATE TABLE temp_notifiche AS SELECT * FROM Notifiche");
    
    console.log("4.8. Creazione temp_utenti_centri");
    await run("CREATE TABLE temp_utenti_centri AS SELECT * FROM UtentiCentri");
    
    // Step 2: Eliminare tabelle esistenti che dipendono dalle tabelle principali
    console.log("\n5. Eliminazione tabelle dipendenti");
    
    console.log("5.1. Eliminazione TokenAutenticazione");
    await run("DROP TABLE IF EXISTS TokenAutenticazione");
    
    console.log("5.2. Eliminazione TokenRevocati");
    await run("DROP TABLE IF EXISTS TokenRevocati");
    
    console.log("5.3. Eliminazione LogCambioStato");
    await run("DROP TABLE IF EXISTS LogCambioStato");
    
    console.log("5.4. Eliminazione Prenotazioni");
    await run("DROP TABLE IF EXISTS Prenotazioni");
    
    console.log("5.5. Eliminazione Notifiche");
    await run("DROP TABLE IF EXISTS Notifiche");
    
    console.log("5.6. Eliminazione UtentiCentri");
    await run("DROP TABLE IF EXISTS UtentiCentri");
    
    // Step 3: Eliminare tabelle principali
    console.log("\n6. Eliminazione tabelle principali");
    
    console.log("6.1. Eliminazione Utenti");
    await run("DROP TABLE IF EXISTS Utenti");
    
    console.log("6.2. Eliminazione Centri");
    await run("DROP TABLE IF EXISTS Centri");
    
    // Step 4: Creare le nuove tabelle con la struttura aggiornata
    console.log("\n7. Creazione nuove tabelle");
    
    // Creare tabella Utenti (ex Centri) - La creiamo prima perché Attori ha una FK verso Utenti
    console.log("7.1. Creazione Utenti (ex Centri)");
    await run(`
      CREATE TABLE Utenti (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          indirizzo TEXT,
          latitudine REAL,
          longitudine REAL,
          telefono TEXT,
          tipo TEXT NOT NULL CHECK(tipo IN ('Privato', 'Canale sociale', 'Centro riciclo')),
          attivo INTEGER DEFAULT 1,
          creato_il TEXT DEFAULT (datetime('now', 'localtime')),
          tipo_id INTEGER,
          email TEXT
      )
    `);
    
    // Creare nuova tabella Attori (ex Utenti)
    console.log("7.2. Creazione Attori (ex Utenti)");
    await run(`
      CREATE TABLE Attori (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          nome TEXT NOT NULL,
          cognome TEXT NOT NULL,
          ruolo TEXT NOT NULL CHECK(ruolo IN ('Operatore', 'Amministratore', 'Utente')),
          attivo INTEGER DEFAULT 1,
          creato_il TEXT DEFAULT (datetime('now', 'localtime')),
          ultimo_accesso TEXT,
          utente_id INTEGER,
          FOREIGN KEY (utente_id) REFERENCES Utenti(id) ON DELETE CASCADE
      )
    `);
    
    // Ricreare tabelle di supporto
    console.log("7.3. Creazione TokenAutenticazione");
    await run(`
      CREATE TABLE TokenAutenticazione (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attore_id INTEGER NOT NULL,
          access_token TEXT,
          refresh_token TEXT,
          access_token_scadenza TEXT NOT NULL,
          refresh_token_scadenza TEXT NOT NULL,
          device_info TEXT,
          ip_address TEXT,
          revocato INTEGER DEFAULT 0,
          revocato_il TEXT,
          creato_il TEXT DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (attore_id) REFERENCES Attori(id) ON DELETE CASCADE
      )
    `);
    
    console.log("7.4. Creazione TokenRevocati");
    await run(`
      CREATE TABLE TokenRevocati (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_hash TEXT NOT NULL,
          attore_id INTEGER,
          revocato_il TEXT DEFAULT (datetime('now', 'localtime')),
          motivo TEXT,
          scadenza_originale TEXT NOT NULL,
          FOREIGN KEY (attore_id) REFERENCES Attori(id) ON DELETE SET NULL
      )
    `);
    
    console.log("7.5. Creazione LogCambioStato");
    await run(`
      CREATE TABLE LogCambioStato (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lotto_id INTEGER NOT NULL,
          stato_precedente TEXT NOT NULL,
          stato_nuovo TEXT NOT NULL,
          timestamp TEXT DEFAULT (datetime('now', 'localtime')),
          attore_id INTEGER,
          FOREIGN KEY (lotto_id) REFERENCES Lotti(id) ON DELETE CASCADE,
          FOREIGN KEY (attore_id) REFERENCES Attori(id) ON DELETE SET NULL
      )
    `);
    
    console.log("7.6. Creazione Prenotazioni");
    await run(`
      CREATE TABLE Prenotazioni (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lotto_id INTEGER NOT NULL,
          utente_id INTEGER NOT NULL,
          stato TEXT NOT NULL,
          attore_id INTEGER,
          data_creazione TEXT DEFAULT (datetime('now', 'localtime')),
          data_modifica TEXT,
          note TEXT,
          FOREIGN KEY (lotto_id) REFERENCES Lotti(id) ON DELETE CASCADE,
          FOREIGN KEY (utente_id) REFERENCES Utenti(id) ON DELETE CASCADE,
          FOREIGN KEY (attore_id) REFERENCES Attori(id) ON DELETE SET NULL
      )
    `);
    
    console.log("7.7. Creazione Notifiche");
    await run(`
      CREATE TABLE Notifiche (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          titolo TEXT NOT NULL,
          messaggio TEXT NOT NULL,
          tipo TEXT NOT NULL,
          priorita TEXT NOT NULL DEFAULT 'Media',
          destinatario_id INTEGER,
          letto INTEGER DEFAULT 0,
          data_lettura TEXT,
          eliminato INTEGER DEFAULT 0,
          riferimento_id INTEGER,
          riferimento_tipo TEXT,
          origine_id INTEGER,
          centro_id INTEGER,
          creato_il TEXT DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (destinatario_id) REFERENCES Attori(id) ON DELETE CASCADE,
          FOREIGN KEY (origine_id) REFERENCES Attori(id) ON DELETE SET NULL,
          FOREIGN KEY (centro_id) REFERENCES Utenti(id) ON DELETE SET NULL
      )
    `);
    
    console.log("7.8. Creazione UtentiCentri");
    await run(`
      CREATE TABLE UtentiCentri (
          utente_id INTEGER NOT NULL,
          centro_id INTEGER NOT NULL,
          ruolo_specifico TEXT,
          data_inizio TEXT DEFAULT (datetime('now', 'localtime')),
          PRIMARY KEY (utente_id, centro_id),
          FOREIGN KEY (utente_id) REFERENCES Attori(id) ON DELETE CASCADE,
          FOREIGN KEY (centro_id) REFERENCES Utenti(id) ON DELETE CASCADE
      )
    `);
    
    // Step 5: Migrare i dati alle nuove tabelle
    console.log("\n8. Migrazione dati");
    
    // Inserire i dati in Utenti (ex Centri)
    console.log("8.1. Inserimento dati in Utenti (ex Centri)");
    await run(`
      INSERT INTO Utenti (id, nome, indirizzo, latitudine, longitudine, telefono, tipo, creato_il, tipo_id, email)
      SELECT 
          id, 
          nome, 
          indirizzo, 
          latitudine,
          longitudine,
          telefono, 
          CASE 
              WHEN tipo = 'Sociale' THEN 'Canale sociale'
              WHEN tipo = 'Riciclo' THEN 'Centro riciclo'
              ELSE 'Privato'
          END as tipo,
          creato_il, 
          tipo_id,
          email
      FROM temp_centri
    `);
    
    // Conserviamo in una tabella temporanea gli email duplicati
    console.log("8.2. Creazione tabella temporanea per email duplicate");
    await run(`
      CREATE TABLE temp_email_duplicate AS
      SELECT email, COUNT(*) as count
      FROM (
          SELECT email FROM temp_utenti WHERE email IS NOT NULL AND email != ''
          UNION ALL
          SELECT email FROM temp_centri WHERE email IS NOT NULL AND email != ''
      ) 
      GROUP BY email
      HAVING COUNT(*) > 1
    `);
    
    // Inserire i dati da Utenti a Attori
    console.log("8.3. Inserimento dati da Utenti a Attori");
    try {
      await run(`
        INSERT INTO Attori (id, email, password, nome, cognome, ruolo, attivo, creato_il, ultimo_accesso, utente_id)
        SELECT 
            u.id, 
            u.email,
            u.password, 
            u.nome, 
            u.cognome, 
            CASE 
                WHEN u.ruolo = 'CentroSociale' THEN 'Utente'
                WHEN u.ruolo = 'CentroRiciclaggio' THEN 'Utente'
                ELSE u.ruolo
            END as ruolo,
            1 as attivo, 
            u.creato_il, 
            u.ultimo_accesso,
            NULL as utente_id
        FROM temp_utenti u
        WHERE NOT EXISTS (
            SELECT 1 FROM Attori WHERE email = u.email
        )
      `);
    } catch (error) {
      console.error("Errore nell'inserimento dati da Utenti a Attori:", error.message);
      throw error;
    }
    
    // Migrazione da Centri a Attori per i centri che hanno un'email ma non corrispondono a utenti esistenti
    console.log("8.4. Migrazione Centri a Attori per centri con email");
    try {
      await run(`
        INSERT INTO Attori (email, password, nome, cognome, ruolo, utente_id)
        SELECT 
            CASE 
                WHEN EXISTS (SELECT 1 FROM temp_email_duplicate d WHERE d.email = c.email) THEN
                    c.email || '_centro_' || c.id -- Aggiungiamo un suffisso all'email duplicata
                ELSE c.email
            END as email,
            '$2a$10$RANDOM_HASH_FOR_SECURITY', -- Hash di password temporanea
            c.nome, 
            'Centro', -- Cognome generico
            'Utente', -- Ruolo: Utente
            c.id -- Collegamento al centro
        FROM temp_centri c
        WHERE c.email IS NOT NULL AND c.email != ''
            AND NOT EXISTS (SELECT 1 FROM Attori a WHERE a.email = c.email)
      `);
    } catch (error) {
      console.error("Errore nella migrazione da Centri a Attori:", error.message);
      throw error;
    }
    
    // Step 6: Aggiornare le relazioni nelle altre tabelle
    console.log("\n9. Aggiornamento relazioni");
    
    // Aggiornare TokenAutenticazione per riferirsi a Attori invece di Utenti
    console.log("9.1. Aggiornamento TokenAutenticazione");
    await run(`
      INSERT INTO TokenAutenticazione (id, attore_id, access_token, refresh_token, access_token_scadenza, 
          refresh_token_scadenza, device_info, ip_address, revocato, revocato_il, creato_il)
      SELECT id, utente_id, access_token, refresh_token, access_token_scadenza, 
          refresh_token_scadenza, device_info, ip_address, revocato, revocato_il, creato_il
      FROM temp_token_autenticazione
    `);
    
    // Aggiornare TokenRevocati per riferirsi a Attori invece di Utenti
    console.log("9.2. Aggiornamento TokenRevocati");
    await run(`
      INSERT INTO TokenRevocati (id, token_hash, attore_id, revocato_il, motivo, scadenza_originale)
      SELECT id, token_hash, revocato_da as attore_id, revocato_il, motivo, scadenza_originale
      FROM temp_token_revocati
    `);
    
    // Aggiornare LogCambioStato per riferirsi a Attori invece di Utenti
    console.log("9.3. Aggiornamento LogCambioStato");
    await run(`
      INSERT INTO LogCambioStato (id, lotto_id, stato_precedente, stato_nuovo, timestamp, attore_id)
      SELECT id, lotto_id, stato_precedente, stato_nuovo, cambiato_il as timestamp, cambiato_da as attore_id
      FROM temp_log_cambio_stato
    `);
    
    // Aggiornare Prenotazioni per riferirsi sia a Attori che a Utenti
    console.log("9.4. Aggiornamento Prenotazioni");
    await run(`
      INSERT INTO Prenotazioni (id, lotto_id, utente_id, stato, attore_id, data_creazione, data_modifica, note)
      SELECT 
          id, 
          lotto_id, 
          centro_ricevente_id as utente_id, 
          stato, 
          NULL as attore_id, 
          data_prenotazione as data_creazione, 
          data_ritiro as data_modifica, 
          note
      FROM temp_prenotazioni
    `);
    
    // Aggiornare Notifiche per riferirsi a Attori
    console.log("9.5. Aggiornamento Notifiche");
    await run(`
      INSERT INTO Notifiche (id, tipo, messaggio, destinatario_id, letto, creato_il, titolo, priorita, 
        origine_id, riferimento_id, riferimento_tipo, centro_id, eliminato, data_lettura)
      SELECT id, tipo, messaggio, destinatario_id, letto, creato_il, titolo, priorita, 
        NULL as origine_id, riferimento_id, riferimento_tipo, centro_id, eliminato, data_lettura
      FROM temp_notifiche
    `);
    
    // Aggiornare UtentiCentri per riferirsi a Attori e Utenti
    console.log("9.6. Aggiornamento UtentiCentri");
    await run(`
      INSERT INTO UtentiCentri (utente_id, centro_id, ruolo_specifico, data_inizio)
      SELECT utente_id, centro_id, ruolo_specifico, data_inizio
      FROM temp_utenti_centri
    `);
    
    // Step 7: Creare indici per migliorare le prestazioni
    console.log("\n10. Creazione indici");
    
    console.log("10.1. Creazione indice idx_attori_email");
    await run("CREATE INDEX idx_attori_email ON Attori(email)");
    
    console.log("10.2. Creazione indice idx_attori_ruolo");
    await run("CREATE INDEX idx_attori_ruolo ON Attori(ruolo)");
    
    console.log("10.3. Creazione indice idx_attori_utente_id");
    await run("CREATE INDEX idx_attori_utente_id ON Attori(utente_id)");
    
    console.log("10.4. Creazione indice idx_utenti_tipo");
    await run("CREATE INDEX idx_utenti_tipo ON Utenti(tipo)");
    
    console.log("10.5. Creazione indice idx_token_autenticazione_attore_id");
    await run("CREATE INDEX idx_token_autenticazione_attore_id ON TokenAutenticazione(attore_id)");
    
    console.log("10.6. Creazione indice idx_token_revocati_attore_id");
    await run("CREATE INDEX idx_token_revocati_attore_id ON TokenRevocati(attore_id)");
    
    console.log("10.7. Creazione indice idx_log_cambio_stato_attore_id");
    await run("CREATE INDEX idx_log_cambio_stato_attore_id ON LogCambioStato(attore_id)");
    
    console.log("10.8. Creazione indice idx_prenotazioni_utente_id");
    await run("CREATE INDEX idx_prenotazioni_utente_id ON Prenotazioni(utente_id)");
    
    console.log("10.9. Creazione indice idx_prenotazioni_attore_id");
    await run("CREATE INDEX idx_prenotazioni_attore_id ON Prenotazioni(attore_id)");
    
    console.log("10.10. Creazione indice idx_notifiche_destinatario_id");
    await run("CREATE INDEX idx_notifiche_destinatario_id ON Notifiche(destinatario_id)");
    
    console.log("10.11. Creazione indice idx_notifiche_origine_id");
    await run("CREATE INDEX idx_notifiche_origine_id ON Notifiche(origine_id)");
    
    console.log("10.12. Creazione indice idx_utenti_centri_utente_id");
    await run("CREATE INDEX idx_utenti_centri_utente_id ON UtentiCentri(utente_id)");
    
    console.log("10.13. Creazione indice idx_utenti_centri_centro_id");
    await run("CREATE INDEX idx_utenti_centri_centro_id ON UtentiCentri(centro_id)");
    
    // Step 8: Eliminare le tabelle temporanee
    console.log("\n11. Eliminazione tabelle temporanee");
    
    console.log("11.1. Eliminazione temp_utenti");
    await run("DROP TABLE temp_utenti");
    
    console.log("11.2. Eliminazione temp_centri");
    await run("DROP TABLE temp_centri");
    
    console.log("11.3. Eliminazione temp_token_autenticazione");
    await run("DROP TABLE temp_token_autenticazione");
    
    console.log("11.4. Eliminazione temp_token_revocati");
    await run("DROP TABLE temp_token_revocati");
    
    console.log("11.5. Eliminazione temp_log_cambio_stato");
    await run("DROP TABLE temp_log_cambio_stato");
    
    console.log("11.6. Eliminazione temp_prenotazioni");
    await run("DROP TABLE temp_prenotazioni");
    
    console.log("11.7. Eliminazione temp_notifiche");
    await run("DROP TABLE temp_notifiche");
    
    console.log("11.8. Eliminazione temp_utenti_centri");
    await run("DROP TABLE temp_utenti_centri");
    
    console.log("11.9. Eliminazione temp_email_duplicate");
    await run("DROP TABLE temp_email_duplicate");
    
    // Step 9: Inserire parametri di sistema predefiniti
    console.log("\n12. Inserimento parametri di sistema predefiniti");
    
    await run(`
      INSERT INTO ParametriSistema (chiave, valore, descrizione, modificabile)
      VALUES 
      ('DEFAULT_USER_ROLE', 'Utente', 'Ruolo predefinito per i nuovi utenti', 1),
      ('DEFAULT_ADMIN_ROLE', 'Amministratore', 'Ruolo amministratore', 0),
      ('DEFAULT_OPERATOR_ROLE', 'Operatore', 'Ruolo operatore', 0)
      ON CONFLICT(chiave) DO UPDATE SET
      valore = excluded.valore,
      descrizione = excluded.descrizione
    `);
    
    // Concludi la transazione
    console.log("\n13. Commit della transazione");
    await run("COMMIT");
    
    // Riattiva le chiavi esterne
    console.log("14. Riattivazione foreign keys");
    await run("PRAGMA foreign_keys = ON");
    
    // Verifica se la migrazione è riuscita
    console.log("\n15. Verifica del risultato della migrazione");
    const tablesAfter = await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    console.log("Tabelle presenti dopo la migrazione:");
    tablesAfter.forEach(table => console.log(`- ${table.name}`));
    
    const attoriExists = tablesAfter.some(table => table.name === 'Attori');
    const utentiExists = tablesAfter.some(table => table.name === 'Utenti');
    const centriExists = tablesAfter.some(table => table.name === 'Centri');
    
    console.log(`\nLa tabella Attori ${attoriExists ? 'esiste' : 'NON esiste'}`);
    console.log(`La tabella Utenti ${utentiExists ? 'esiste' : 'NON esiste'}`);
    console.log(`La tabella Centri ${centriExists ? 'esiste ancora' : 'è stata eliminata'}`);
    
    if (attoriExists) {
      const attoriCount = await query("SELECT COUNT(*) as count FROM Attori");
      console.log(`Numero di record nella tabella Attori: ${attoriCount[0].count}`);
    }
    
    if (utentiExists) {
      const utentiCount = await query("SELECT COUNT(*) as count FROM Utenti");
      console.log(`Numero di record nella tabella Utenti: ${utentiCount[0].count}`);
    }
    
    migrationSuccessful = attoriExists && !centriExists;
    
    if (migrationSuccessful) {
      console.log("\n✅ Migrazione completata con successo!");
    } else {
      console.log("\n❌ Migrazione NON completata correttamente!");
    }
    
  } catch (error) {
    console.error(`Errore durante la migrazione: ${error.message}`);
    // In caso di errore, esegui il rollback della transazione
    console.log("\nEsecuzione rollback della transazione...");
    try {
      await run("ROLLBACK");
      console.log("Rollback completato.");
    } catch (rollbackError) {
      console.error(`Errore durante il rollback: ${rollbackError.message}`);
    }
  } finally {
    // Chiudi la connessione al database
    console.log("\nChiusura connessione al database");
    db.close();
  }
  
  return migrationSuccessful;
}

// Esegui lo script
executeDirectMigration().then(success => {
  console.log(`\nRisultato finale della migrazione: ${success ? 'Successo' : 'Fallimento'}`);
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Errore fatale durante l\'esecuzione della migrazione diretta:', err);
  process.exit(1);
});
