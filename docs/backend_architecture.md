# Architettura del Backend ReFood

## Panoramica

Questo documento descrive l'architettura del backend per l'app ReFood, sviluppato utilizzando Node.js, Express e SQLite. Il backend è progettato per supportare tutte le funzionalità dell'app mobile, fornendo API RESTful per la gestione dei lotti, prenotazioni, centri, utenti e statistiche.

## Struttura del Progetto

L'architettura del backend segue un modello MVC (Model-View-Controller) modificato per API, organizzato nelle seguenti directory:

```
backend/
├── src/
│   ├── config/           # Configurazione (database, variabili d'ambiente)
│   ├── controllers/      # Logica di business per le routes
│   ├── middlewares/      # Middleware (auth, validazione, errori)
│   ├── routes/           # Definizione delle routes dell'API
│   ├── utils/            # Utility (logger, scheduler, swagger)
│   └── server.js         # Punto di ingresso dell'applicazione
├── public/               # File statici
├── logs/                 # Log dell'applicazione
├── database/             # File database SQLite
└── package.json          # Dipendenze e script
```

## Componenti Principali

### 1. Server e Middleware

Il file `server.js` è il punto di ingresso dell'applicazione. Configura:
- Express e i suoi middleware essenziali
- Sicurezza con Helmet
- CORS
- Compressione delle risposte
- Logging con Morgan e Winston
- Gestione centralizzata degli errori
- Avvio dello scheduler per attività pianificate

```javascript
// Esempio di configurazione del server
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const { errorHandler } = require('./middlewares/errorHandler');
const routes = require('./routes');
const scheduler = require('./utils/scheduler');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(compression());
app.use(morgan('combined', { stream: logger.stream }));

// Routes
app.use('/api/v1', routes);

// Error handler
app.use(errorHandler);

// Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server avviato sulla porta ${PORT}`);
  scheduler.init();
});
```

### 2. Configurazione del Database

La directory `config` contiene:
- `database.js`: Gestione della connessione SQLite con metodi async/await
- Caricamento delle variabili d'ambiente tramite dotenv

```javascript
// Esempio di database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

const dbPath = process.env.DB_PATH 
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', '..', '..', 'database', 'refood.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error(`Errore di connessione al database: ${err.message}`);
    process.exit(1);
  }
  logger.info(`Connesso al database SQLite: ${dbPath}`);
  
  // Abilita le chiavi esterne
  db.run('PRAGMA foreign_keys = ON');
});

// Metodi promisificati per lavorare con async/await
const dbAsync = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  },
  
  exec: (sql) => {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
};

module.exports = {
  ...db,        // Metodi originali
  ...dbAsync,   // Metodi promisificati
  closeDatabase: () => {
    return new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
};
```

### 3. Routes

Le routes sono organizzate in moduli separati e centralizzate in un file `index.js`:

```javascript
// routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const lottiRoutes = require('./lotti.routes');
const prenotazioniRoutes = require('./prenotazioni.routes');
const centriRoutes = require('./centri.routes');
const statisticheRoutes = require('./statistiche.routes');
const notificheRoutes = require('./notifiche.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/lotti', lottiRoutes);
router.use('/prenotazioni', prenotazioniRoutes);
router.use('/centri', centriRoutes);
router.use('/statistiche', statisticheRoutes);
router.use('/notifiche', notificheRoutes);

module.exports = router;
```

Ogni file di routes definisce gli endpoint per una specifica risorsa:

```javascript
// Esempio di routes/lotti.routes.js
const express = require('express');
const router = express.Router();
const lottiController = require('../controllers/lotti.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate, lottoSchema } = require('../middlewares/validator');

// Route pubbliche
router.get('/disponibili', lottiController.getLottiDisponibili);

// Route protette
router.get('/', authenticate, lottiController.getLotti);
router.get('/:id', authenticate, lottiController.getLottoById);
router.post('/', 
  authenticate, 
  authorize(['Operatore', 'Amministratore']), 
  validate(lottoSchema.create), 
  lottiController.createLotto
);
router.put('/:id', 
  authenticate, 
  authorize(['Operatore', 'Amministratore']), 
  validate(lottoSchema.update), 
  lottiController.updateLotto
);
router.delete('/:id', 
  authenticate, 
  authorize(['Amministratore']), 
  lottiController.deleteLotto
);

module.exports = router;
```

### 4. Controllers

I controllers contengono la logica di business complessa:

```javascript
// Esempio di controllers/lotti.controller.js
const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

const getLotti = async (req, res, next) => {
  try {
    const { stato, centro_id, categoria, scadenza_min, scadenza_max, cerca } = req.query;
    
    // Costruisce query dinamica con filtri
    let sql = `
      SELECT l.*, c.nome as centro_nome
      FROM Lotti l
      JOIN Centri c ON l.centro_origine_id = c.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (stato) {
      sql += ` AND l.stato = ?`;
      params.push(stato);
    }
    
    if (centro_id) {
      sql += ` AND l.centro_origine_id = ?`;
      params.push(centro_id);
    }
    
    // Altri filtri...
    
    sql += ` ORDER BY l.data_scadenza ASC`;
    
    const lotti = await db.all(sql, params);
    
    // Recupera le categorie per ogni lotto
    for (const lotto of lotti) {
      const categorie = await db.all(`
        SELECT c.nome
        FROM LottiCategorie lc
        JOIN Categorie c ON lc.categoria_id = c.id
        WHERE lc.lotto_id = ?
      `, [lotto.id]);
      
      lotto.categorie = categorie.map(c => c.nome);
    }
    
    res.json({ lotti });
  } catch (error) {
    next(error);
  }
};

// Altri metodi del controller...

module.exports = {
  getLotti,
  getLottoById,
  createLotto,
  updateLotto,
  deleteLotto,
  getLottiDisponibili
};
```

### 5. Middleware

#### Middleware di Autenticazione

```javascript
// middlewares/auth.js
const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    // Ottiene il token dall'header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Autenticazione richiesta');
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verifica il token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verifica nel database
    const sql = `
      SELECT 
        u.id, u.email, u.nome, u.cognome, u.ruolo
      FROM TokenAutenticazione t
      JOIN Utenti u ON t.utente_id = u.id
      WHERE t.access_token = ?
      AND t.access_token_scadenza > datetime('now')
      AND t.revocato = 0
    `;
    
    const row = await db.get(sql, [token]);
    
    if (!row) {
      throw new ApiError(401, 'Token non valido o revocato');
    }
    
    // Salva l'utente nella request
    req.user = {
      id: row.id,
      email: row.email,
      nome: row.nome,
      cognome: row.cognome,
      ruolo: row.ruolo
    };
    
    next();
  } catch (err) {
    next(err);
  }
};

const authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }
  
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Utente non autenticato'));
    }
    
    if (roles.length && !roles.includes(req.user.ruolo)) {
      return next(new ApiError(403, 'Non autorizzato: ruolo non sufficiente'));
    }
    
    next();
  };
};

module.exports = {
  authenticate,
  authorize
};
```

#### Middleware di Gestione Errori

```javascript
// middlewares/errorHandler.js
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  console.error(err);
  
  // Errori JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Token non valido'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      message: 'Token scaduto'
    });
  }
  
  // Errori API
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
  }
  
  // Errori SQLite
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({
      status: 'error',
      message: 'Violazione di un vincolo database'
    });
  }
  
  // Errori generici
  return res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Si è verificato un errore interno'
      : err.message
  });
};

module.exports = {
  ApiError,
  errorHandler
};
```

### 6. Utilities

#### Scheduler

```javascript
// utils/scheduler.js
const cron = require('node-cron');
const db = require('../config/database');
const logger = require('./logger');

class Scheduler {
  constructor() {
    this.jobs = [];
  }

  init() {
    this.setupLottiStatusUpdate();
    this.setupExpiredLotsArchiving();
    this.setupSystemStatsCollection();
    
    logger.info('Scheduler inizializzato con successo');
  }

  // Aggiornamento automatico degli stati dei lotti ogni ora
  setupLottiStatusUpdate() {
    const job = cron.schedule('0 * * * *', async () => {
      logger.info('Avvio aggiornamento stato lotti');
      
      try {
        await db.exec('BEGIN TRANSACTION');
        
        const oggi = new Date().toISOString().split('T')[0];
        
        // Aggiorna stato da Verde a Arancione
        const lottiDaArancione = await db.all(`
          SELECT id, stato, data_scadenza, giorni_permanenza
          FROM Lotti 
          WHERE stato = 'Verde' 
          AND date(data_scadenza, '-' || giorni_permanenza || ' days') <= date(?)
          AND data_scadenza > date(?)
        `, [oggi, oggi]);
        
        // Aggiorna lotti a stato arancione...
        
        // Aggiorna stato da Arancione/Verde a Rosso
        const lottiDaRosso = await db.all(`
          SELECT id, stato 
          FROM Lotti 
          WHERE stato IN ('Verde', 'Arancione') 
          AND date(data_scadenza) <= date(?)
        `, [oggi]);
        
        // Aggiorna lotti a stato rosso...
        
        await db.exec('COMMIT');
        logger.info('Aggiornamento stato lotti completato');
      } catch (error) {
        await db.exec('ROLLBACK');
        logger.error(`Errore nell'aggiornamento: ${error.message}`);
      }
    });
    
    this.jobs.push(job);
  }
  
  // Altri metodi dello scheduler...
  
  stop() {
    this.jobs.forEach(job => job.stop());
    logger.info('Scheduler arrestato');
  }
}

module.exports = new Scheduler();
```

## Schema del Database

Lo schema SQLite comprende le seguenti tabelle principali:

- **Utenti**: Gestione degli account utente
- **Centri**: Luoghi fisici dove si gestiscono i lotti (sociali o riciclaggio)
- **UtentiCentri**: Relazione M:N tra utenti e centri
- **Lotti**: Lotti alimentari con stato (Verde, Arancione, Rosso)
- **Categorie**: Categorie per classificare i lotti
- **LottiCategorie**: Relazione M:N tra lotti e categorie
- **Prenotazioni**: Prenotazioni dei lotti da parte dei centri sociali
- **LogCambioStato**: Storico dei cambiamenti di stato dei lotti
- **TokenAutenticazione**: Gestione dei token JWT
- **TokenRevocati**: Blacklist di token revocati
- **Notifiche**: Sistema di notifiche per gli utenti
- **StatisticheGiornaliere**: Aggregazione di dati statistici

## APIs e Endpoints

Il sistema espone le seguenti API principali:

### Autenticazione

- `POST /api/v1/auth/login`: Login utente con generazione token
- `POST /api/v1/auth/logout`: Revoca del token corrente
- `POST /api/v1/auth/refresh`: Rinnovo token con refresh token
- `GET /api/v1/auth/me`: Ottiene dettagli utente corrente

### Lotti

- `GET /api/v1/lotti`: Lista lotti con filtri
- `GET /api/v1/lotti/:id`: Dettaglio singolo lotto
- `POST /api/v1/lotti`: Creazione nuovo lotto
- `PUT /api/v1/lotti/:id`: Aggiornamento lotto
- `DELETE /api/v1/lotti/:id`: Eliminazione lotto
- `GET /api/v1/lotti/disponibili`: Lotti disponibili per prenotazione

### Prenotazioni

- `GET /api/v1/prenotazioni`: Lista prenotazioni utente
- `POST /api/v1/prenotazioni`: Creazione nuova prenotazione
- `GET /api/v1/prenotazioni/:id`: Dettaglio singola prenotazione
- `PUT /api/v1/prenotazioni/:id/stato`: Aggiornamento stato prenotazione

### Centri

- `GET /api/v1/centri`: Lista centri
- `POST /api/v1/centri`: Creazione nuovo centro
- `GET /api/v1/centri/:id`: Dettaglio singolo centro
- `PUT /api/v1/centri/:id`: Aggiornamento centro
- `DELETE /api/v1/centri/:id`: Eliminazione centro
- `GET /api/v1/centri/:id/operatori`: Operatori assegnati al centro
- `POST /api/v1/centri/:id/operatori`: Assegnazione operatori

### Statistiche

- `GET /api/v1/statistiche/dashboard`: Statistiche per dashboard
- `GET /api/v1/statistiche/lotti`: Statistiche sui lotti
- `GET /api/v1/statistiche/prenotazioni`: Statistiche prenotazioni
- `GET /api/v1/statistiche/impatto`: Impatto ambientale ed economico

## Miglioramenti e Future Implementazioni

- **Cache Layer**: Implementazione di Redis per caching API
- **Queue System**: Aggiunta di un sistema di code per operazioni asincrone
- **Geospatial Query**: Miglioramenti ricerca basata sulla posizione
- **WebSocket**: Implementazione di notifiche real-time
- **Analytics**: Sistema avanzato di analisi dati
- **Multi-tenancy**: Supporto per organizzazioni multiple
- **Backup automatici**: Sistema di backup incrementali del database 