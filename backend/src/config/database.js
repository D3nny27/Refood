const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Percorso del file database
const dbPath = process.env.DB_PATH 
  ? path.resolve(process.env.DB_PATH)  // Converto in percorso assoluto
  : path.join(__dirname, '..', '..', '..', 'database', 'refood.db');

console.log(`Percorso assoluto del database: ${dbPath}`);

// Assicurati che la directory esista
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  logger.info(`Directory database creata: ${dbDir}`);
}

// Crea/connetti al database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error(`Errore di connessione al database: ${err.message}`);
    process.exit(1);
  }
  logger.info(`Connesso al database SQLite: ${dbPath}`);
  
  // Abilita le chiavi esterne
  db.run('PRAGMA foreign_keys = ON');
});

/**
 * Classe per gestire una connessione al database con supporto per le transazioni
 */
class Connection {
  constructor(db) {
    this.db = db;
    this.inTransaction = false;
  }

  /**
   * Inizia una transazione
   */
  async beginTransaction() {
    if (this.inTransaction) {
      throw new Error('Transazione già iniziata');
    }
    
    await this.run('BEGIN TRANSACTION');
    this.inTransaction = true;
    logger.debug('Transazione iniziata');
  }

  /**
   * Conferma una transazione
   */
  async commit() {
    if (!this.inTransaction) {
      throw new Error('Nessuna transazione attiva da confermare');
    }
    
    await this.run('COMMIT');
    this.inTransaction = false;
    logger.debug('Transazione confermata (commit)');
  }

  /**
   * Annulla una transazione
   */
  async rollback() {
    if (!this.inTransaction) {
      return; // Ignora se non c'è una transazione attiva
    }
    
    await this.run('ROLLBACK');
    this.inTransaction = false;
    logger.debug('Transazione annullata (rollback)');
  }

  /**
   * Esegue una query che non restituisce righe (INSERT, UPDATE, DELETE)
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      logger.debug(`SQL run (transazione=${this.inTransaction}): ${sql}`);
      if (params && params.length > 0) {
        logger.debug(`Parametri: ${JSON.stringify(params)}`);
      }

      this.db.run(sql, params, function(err) {
        const duration = Date.now() - startTime;
        if (err) {
          logger.error(`Errore SQL run (${duration}ms): ${err.message}`, { sql, params });
          return reject(err);
        }
        logger.debug(`Query completata (${duration}ms) con lastID: ${this.lastID}, changes: ${this.changes}`);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Ottiene una singola riga
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      logger.debug(`SQL get (transazione=${this.inTransaction}): ${sql}`);
      if (params && params.length > 0) {
        logger.debug(`Parametri: ${JSON.stringify(params)}`);
      }

      this.db.get(sql, params, (err, row) => {
        const duration = Date.now() - startTime;
        if (err) {
          logger.error(`Errore SQL get (${duration}ms): ${err.message}`, { sql, params });
          return reject(err);
        }
        logger.debug(`Query get completata (${duration}ms), risultato: ${row ? 'trovato' : 'vuoto'}`);
        resolve(row);
      });
    });
  }

  /**
   * Ottiene tutte le righe
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      logger.debug(`SQL all (transazione=${this.inTransaction}): ${sql}`);
      if (params && params.length > 0) {
        logger.debug(`Parametri: ${JSON.stringify(params)}`);
      }

      this.db.all(sql, params, (err, rows) => {
        const duration = Date.now() - startTime;
        if (err) {
          logger.error(`Errore SQL all (${duration}ms): ${err.message}`, { sql, params });
          return reject(err);
        }
        logger.debug(`Query all completata (${duration}ms), righe restituite: ${rows ? rows.length : 0}`);
        resolve(rows || []);
      });
    });
  }

  /**
   * Rilascia la connessione
   */
  release() {
    // Nulla da fare per SQLite in-process
    logger.debug('Connessione rilasciata (no-op per SQLite)');
  }
}

// Metodi wrapper per promisify le operazioni del database
const dbAsync = {
  // Funzione per testare la connessione al database
  testConnection: async () => {
    try {
      await new Promise((resolve, reject) => {
        db.get('SELECT 1', [], (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });
      logger.info('Test di connessione al database completato con successo');
      return true;
    } catch (error) {
      logger.error(`Test di connessione al database fallito: ${error.message}`);
      return false;
    }
  },

  // Esegue una query che non restituisce righe (INSERT, UPDATE, DELETE)
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      logger.debug(`SQL run: ${sql}`);
      if (params && params.length > 0) {
        logger.debug(`Parametri: ${JSON.stringify(params)}`);
      }

      db.run(sql, params, function(err) {
        const duration = Date.now() - startTime;
        if (err) {
          logger.error(`Errore SQL run (${duration}ms): ${err.message}`, { sql, params });
          return reject(err);
        }
        logger.debug(`Query completata (${duration}ms) con lastID: ${this.lastID}, changes: ${this.changes}`);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  
  // Ottiene una singola riga
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      logger.debug(`SQL get: ${sql}`);
      if (params && params.length > 0) {
        logger.debug(`Parametri: ${JSON.stringify(params)}`);
      }

      db.get(sql, params, (err, row) => {
        const duration = Date.now() - startTime;
        if (err) {
          logger.error(`Errore SQL get (${duration}ms): ${err.message}`, { sql, params });
          return reject(err);
        }
        logger.debug(`Query get completata (${duration}ms), risultato: ${row ? 'trovato' : 'vuoto'}`);
        resolve(row);
      });
    });
  },
  
  // Ottiene tutte le righe
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      logger.debug(`SQL all: ${sql}`);
      if (params && params.length > 0) {
        logger.debug(`Parametri: ${JSON.stringify(params)}`);
      }

      db.all(sql, params, (err, rows) => {
        const duration = Date.now() - startTime;
        if (err) {
          logger.error(`Errore SQL all (${duration}ms): ${err.message}`, { sql, params });
          return reject(err);
        }
        logger.debug(`Query all completata (${duration}ms), righe restituite: ${rows ? rows.length : 0}`);
        resolve(rows || []);
      });
    });
  },
  
  // Esegue query multiple o script SQL
  exec: (sql) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      logger.debug(`SQL exec: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);

      db.exec(sql, (err) => {
        const duration = Date.now() - startTime;
        if (err) {
          logger.error(`Errore SQL exec (${duration}ms): ${err.message}`, { sql: sql.substring(0, 200) });
          return reject(err);
        }
        logger.debug(`Exec completato (${duration}ms)`);
        resolve();
      });
    });
  },

  /**
   * Ottiene una connessione dedicata per operazioni con transazioni
   */
  getConnection: async () => {
    return new Connection(db);
  },

  // Alias per mantenere compatibilità con il codice esistente
  query: function(sql, params = []) {
    logger.debug(`SQL query chiamata (deprecata), usando 'all' come fallback`);
    return this.all(sql, params);
  }
};

// Funzione per chiudere la connessione al database (utile per test)
const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        logger.error(`Errore chiusura database: ${err.message}`);
        return reject(err);
      }
      logger.info('Connessione al database chiusa');
      resolve();
    });
  });
};

module.exports = {
  ...db, // Esporta metodi originali
  ...dbAsync, // Esporta metodi promisified
  closeDatabase
}; 