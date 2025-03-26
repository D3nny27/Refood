/**
 * Registra un nuovo utente
 * @route POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  const { nome, cognome, email, password, ruolo = 'Operatore' } = req.body;

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
    let ruoloEffettivo = 'Operatore';
    if (ruolo) {
      // Mappa i ruoli dal formato API al formato database
      const ruoloMap = {
        'UTENTE': 'Operatore',
        'CENTRO_SOCIALE': 'CentroSociale',
        'CENTRO_RICICLAGGIO': 'CentroRiciclaggio',
        'Operatore': 'Operatore',
        'CentroSociale': 'CentroSociale',
        'CentroRiciclaggio': 'CentroRiciclaggio'
      };
      
      if (ruoloMap[ruolo]) {
        ruoloEffettivo = ruoloMap[ruolo];
      }
    }

    // Inserisci l'utente nel database
    const result = await db.run(
      `INSERT INTO Utenti (nome, cognome, email, password, ruolo, creato_da, creato_il, ultimo_accesso) 
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