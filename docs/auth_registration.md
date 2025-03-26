# Sistema di Registrazione Utenti

Questo documento descrive l'implementazione del sistema di registrazione utenti in Refood, aggiunto il 26 marzo 2025.

## Panoramica

Il sistema di registrazione consente a nuovi utenti di creare un account nell'applicazione Refood specificando informazioni essenziali come nome, cognome, email e password. L'implementazione include validazione lato client e server, protezione contro registrazioni duplicate e gestione sicura delle password.

## Flusso di Registrazione

1. L'utente compila il form di registrazione con i seguenti dati:
   - Nome
   - Cognome
   - Email
   - Password
   - Conferma password (solo per validazione frontend)
   - Ruolo (opzionale, default: "UTENTE")

2. Il frontend valida i dati inseriti verificando:
   - Campi obbligatori
   - Formato email valido
   - Robustezza password (minimo 6 caratteri)
   - Corrispondenza tra password e conferma

3. I dati validati vengono inviati all'endpoint `/auth/register` tramite richiesta POST

4. Il backend elabora la richiesta:
   - Verifica che l'email non sia già registrata
   - Applica hashing alla password con bcrypt
   - Determina il ruolo effettivo (limitando le opzioni a UTENTE, CENTRO_SOCIALE, CENTRO_RICICLAGGIO)
   - Inserisce il nuovo utente nel database, impostando un amministratore come creatore
   - Restituisce i dati dell'utente appena creato (senza la password)

5. Il frontend gestisce la risposta:
   - In caso di successo, mostra un messaggio di conferma e reindirizza al login
   - In caso di errore, visualizza un messaggio appropriato all'utente

## Implementazione Backend

### Endpoint API

```javascript
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registra un nuovo utente
 *     tags: [Autenticazione]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - cognome
 *               - email
 *               - password
 *             properties:
 *               nome:
 *                 type: string
 *               cognome:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *               ruolo:
 *                 type: string
 *                 enum: [UTENTE, CENTRO_SOCIALE, CENTRO_RICICLAGGIO]
 *                 default: UTENTE
 *     responses:
 *       201:
 *         description: Utente registrato con successo
 *       400:
 *         description: Dati di registrazione non validi
 *       409:
 *         description: Email già registrata
 */
router.post('/register', [
  body('nome').notEmpty().withMessage('Nome richiesto'),
  body('cognome').notEmpty().withMessage('Cognome richiesto'),
  body('email').isEmail().withMessage('Email non valida'),
  body('password').isLength({ min: 6 }).withMessage('La password deve contenere almeno 6 caratteri'),
  body('ruolo').optional().isIn(['UTENTE', 'CENTRO_SOCIALE', 'CENTRO_RICICLAGGIO']).withMessage('Ruolo non valido'),
  validator.validate
], authController.register);
```

### Funzione Controller

```javascript
/**
 * Registra un nuovo utente
 * @route POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  const { nome, cognome, email, password, ruolo = 'UTENTE' } = req.body;

  try {
    // Verifica se l'email è già registrata
    const [existingUser] = await db.all(
      'SELECT * FROM Utenti WHERE email = ?',
      [email]
    );

    if (existingUser) {
      throw new ApiError(409, 'Email già registrata');
    }

    // Codifica la password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Trova l'amministratore di sistema per impostarlo come creatore dell'utente
    const [admin] = await db.all(
      'SELECT id FROM Utenti WHERE ruolo = ? LIMIT 1',
      ['Amministratore']
    );
    
    const creato_da = admin ? admin.id : null;

    // Determina il ruolo effettivo - limita i ruoli disponibili per la registrazione normale
    let ruoloEffettivo = 'UTENTE';
    if (ruolo && ['UTENTE', 'CENTRO_SOCIALE', 'CENTRO_RICICLAGGIO'].includes(ruolo.toUpperCase())) {
      ruoloEffettivo = ruolo.toUpperCase();
    }

    // Inserisci l'utente nel database
    const result = await db.run(
      `INSERT INTO Utenti (nome, cognome, email, password, ruolo, creato_da, data_creazione, ultimo_accesso) 
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), NULL)`,
      [nome, cognome, email, hashedPassword, ruoloEffettivo, creato_da]
    );

    if (!result.lastID) {
      throw new ApiError(500, 'Errore durante la registrazione');
    }

    // Leggi l'utente appena creato per includerlo nella risposta (senza la password)
    const [newUser] = await db.all(
      'SELECT id, nome, cognome, email, ruolo FROM Utenti WHERE id = ?',
      [result.lastID]
    );

    logger.info(`Nuovo utente registrato: ${email} (ID: ${result.lastID})`);

    // Restituisci la risposta di successo
    return res.status(201).json({
      status: 'success',
      message: 'Utente registrato con successo',
      success: true,
      data: {
        user: newUser
      }
    });
  } catch (error) {
    next(error);
  }
};
```

## Implementazione Frontend

### Servizio di Autenticazione

```typescript
export const registerUser = async (userData: {
  email: string;
  password: string;
  nome: string;
  cognome: string;
  ruolo: string;
}) => {
  try {
    // Log dei dati di registrazione (senza la password per sicurezza)
    logger.log(`Tentativo di registrazione per ${userData.email}`, {
      ...userData,
      password: '********'
    });

    const response = await api.post(
      `${API_URL}/auth/register`,
      userData,
      { timeout: API_CONFIG.REQUEST_TIMEOUT }
    );

    logger.log(`Risposta registrazione:`, response.data);

    if (response.data && response.data.success) {
      return {
        success: true,
        user: response.data.data.user
      };
    } else {
      return {
        success: false,
        error: response.data.message || 'Errore durante la registrazione'
      };
    }
  } catch (error) {
    const errorResponse = error.response?.data;
    const errorMessage = errorResponse?.message || 'Errore durante la registrazione';
    
    logger.error(`Errore registrazione: ${errorMessage}`, error);
    
    // Gestione errori specifici
    if (error.response?.status === 409) {
      return {
        success: false,
        error: 'Email già registrata. Prova con un altro indirizzo email.'
      };
    } else if (error.response?.status === 400) {
      // Errori di validazione
      return {
        success: false,
        error: errorMessage
      };
    } else if (error.response?.status === 404) {
      return { 
        success: false,
        error: 'Endpoint di registrazione non trovato. Verifica il server API.'
      };
    } else if (error.response?.status >= 500) {
      return {
        success: false,
        error: 'Errore sul server. Riprova più tardi.'
      };
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};
```

### Context per Autenticazione

```typescript
// Funzione di registrazione in AuthContext.tsx
const register = async (nome: string, cognome: string, email: string, password: string): Promise<boolean> => {
  try {
    setIsLoading(true);
    setError(null);

    const userData = {
      nome,
      cognome,
      email,
      password,
      ruolo: "UTENTE"
    };

    const result = await registerUser(userData);

    if (result.success) {
      setError(null);
      Toast.show({
        type: 'success',
        text1: 'Registrazione completata',
        text2: 'Account creato con successo. Ora puoi effettuare il login',
        position: 'bottom'
      });
      return true;
    } else {
      const errorMsg = result.error || 'Errore durante la registrazione';
      setError(errorMsg);
      
      Toast.show({
        type: 'error',
        text1: 'Errore registrazione',
        text2: errorMsg,
        position: 'bottom'
      });
      
      return false;
    }
  } catch (error) {
    const errorMsg = 
      error.response?.status === 409 ? 'Email già in uso. Prova con un altro indirizzo email.' :
      error.response?.status === 400 ? (error.response?.data?.message || 'Dati non validi. Verifica i campi inseriti.') :
      error.response?.status === 404 ? 'Servizio di registrazione non disponibile. Contatta l\'amministratore.' :
      error.response?.status >= 500 ? 'Errore sul server. Riprova più tardi o contatta l\'assistenza.' :
      'Errore durante la registrazione. Verifica la connessione di rete.';
    
    setError(errorMsg);
    
    Toast.show({
      type: 'error',
      text1: 'Errore registrazione',
      text2: errorMsg,
      position: 'bottom'
    });
    
    return false;
  } finally {
    setIsLoading(false);
  }
};
```

## Modello Dati

La registrazione utilizza la tabella `Utenti` nel database con la seguente struttura:

```sql
CREATE TABLE Utenti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  ruolo TEXT NOT NULL CHECK (ruolo IN ('UTENTE', 'Amministratore', 'CENTRO_SOCIALE', 'CENTRO_RICICLAGGIO')),
  creato_da INTEGER REFERENCES Utenti(id),
  data_creazione TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_accesso TIMESTAMP
);
```

## Protezione e Sicurezza

- Le password vengono sottoposte a hashing con bcrypt prima della memorizzazione
- Validazione dei dati sia lato client che lato server
- Controllo per prevenire registrazioni duplicate (email univoca)
- Limitazione sui ruoli assegnabili ai nuovi utenti
- Autenticazione JWT richiesta per accedere a risorse protette dopo il login

## Messaggi di Errore

| Codice | Descrizione | Causa |
|--------|-------------|-------|
| 400 | Dati di registrazione non validi | Form incompleto o campi non validi |
| 409 | Email già registrata | L'email è già presente nel database |
| 404 | Endpoint non trovato | Problema di configurazione del server |
| 500 | Errore del server | Problema interno del database o del server |

## Flusso Completo dell'Utente

1. L'utente accede alla schermata di registrazione dall'app mobile
2. Compila il form con i dati richiesti
3. Invia il modulo di registrazione
4. Riceve conferma della registrazione avvenuta
5. Viene reindirizzato alla schermata di login
6. Effettua l'accesso con le nuove credenziali
7. Accede all'app con il profilo creato

## Note Tecniche

- Il campo `creato_da` tiene traccia dell'amministratore che ha creato l'utente
- La `data_creazione` viene impostata automaticamente al momento dell'inserimento
- `ultimo_accesso` viene aggiornato durante il login
- Il ruolo predefinito è "UTENTE" ma può essere modificato in fase di registrazione 