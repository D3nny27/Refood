import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  loginUser, 
  logoutUser, 
  checkUserAuth, 
  registerUser, 
  getActiveToken, 
  saveUserSession 
} from '../services/authService';
import { setAuthToken } from '../services/api';
import { STORAGE_KEYS } from '../config/constants';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { Utente } from '../types/user';
import logger from '../utils/logger';
import Toast from 'react-native-toast-message';
import { listenEvent, APP_EVENTS } from '../utils/events';

// Definisci il tipo di resetAuthState nel global namespace
declare global {
  var resetAuthState: (() => void) | undefined;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: Utente | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    nome: string, 
    cognome: string, 
    email: string, 
    password: string, 
    tipologia: 'organizzazione' | 'utente' | null,
    ruoloOrganizzazione: string | null,
    tipoUtente: string | null,
    indirizzo?: string,
    telefono?: string
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUserStatus: () => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<Utente | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState<boolean>(false);
  
  // Log di stato per aiutare il debug
  useEffect(() => {
    console.log('AuthProvider - Stato autenticazione:', isAuthenticated ? 'autenticato' : 'non autenticato');
    console.log('AuthProvider - User:', user ? `${user.email} (${user.ruolo})` : 'null');
    
    // Verifica rapida che lo stato sia coerente
    const checkState = async () => {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      const userDataString = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      
      // Se abbiamo token e dati utente in storage ma isAuthenticated è false, ripristiniamo
      if (token && userDataString && !isAuthenticated) {
        console.log('CORREZIONE STATO: trovati dati in storage ma stato non autenticato');
        try {
          const userData = JSON.parse(userDataString);
          setUser(userData);
          setIsAuthenticated(true);
          setAuthToken(token);
        } catch (error) {
          console.error('Errore durante la correzione dello stato:', error);
        }
      }
      
      // Se non abbiamo né token né dati utente ma isAuthenticated è true, correggiamo
      if (!token && !userDataString && isAuthenticated) {
        console.log('CORREZIONE STATO: nessun dato in storage ma stato autenticato');
        setUser(null);
        setIsAuthenticated(false);
      }
    };
    
    checkState();
  }, [isAuthenticated, user]);
  
  // Funzione per resettare lo stato di autenticazione
  const resetAuthentication = useCallback(() => {
    logger.warn('Esecuzione reset autenticazione');
    setUser(null);
    setIsAuthenticated(false);
    setAuthToken(null);
  }, []);
  
  // Assegna la funzione al global object per permettere l'accesso da api.ts
  useEffect(() => {
    if (typeof global !== 'undefined') {
      global.resetAuthState = resetAuthentication;
    }
    
    return () => {
      if (typeof global !== 'undefined') {
        global.resetAuthState = undefined;
      }
    };
  }, [resetAuthentication]);
  
  // Listener per eventi jwt_expired usando EventEmitter invece di window
  useEffect(() => {
    const handleJwtExpiredEvent = () => {
      logger.warn('Evento JWT scaduto ricevuto');
      resetAuthentication();
    };
    
    // Usa il nostro sistema di eventi personalizzato
    const removeListener = listenEvent(APP_EVENTS.JWT_EXPIRED, handleJwtExpiredEvent);
    
    // Cleanup: rimuove il listener quando il componente si smonta
    return () => {
      removeListener();
    };
  }, [resetAuthentication]);

  // Funzione per aggiornare lo stato dell'autenticazione
  const refreshUserStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('AuthProvider - Inizio refresh dello stato utente');
      
      // Ottieni il token in modo sicuro
      const token = await getActiveToken();
      console.log('AuthProvider - Token trovato:', token ? 'presente' : 'assente');
      
      // Prima prova a ripristinare i dati utente locali, poi verifica con il server
      let localDataRestored = false;
      
      if (!Platform.isTV && typeof window !== 'undefined') {
        try {
          const userDataString = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
          if (userDataString && token) {
            const userData = JSON.parse(userDataString);
            console.log('Dati utente trovati in storage locale:', userData.email);
            
            // Imposta immediatamente lo stato con i dati locali
            setUser(userData);
            setIsAuthenticated(true);
            localDataRestored = true;
            
            // Configura l'header con il token
            setAuthToken(token);
          }
        } catch (storageError) {
          console.error('Errore nel ripristino dei dati locali:', storageError);
        }
      }
      
      // Se abbiamo un token, verifica l'autenticazione con il server
      if (token) {
        setAuthToken(token);
        console.log('Token esistente trovato, verifico autenticazione con il server...');
        try {
          const userData = await checkUserAuth();
          
          if (userData) {
            console.log('Utente autenticato confermato dal server:', userData.email);
            setUser(userData);
            setIsAuthenticated(true);
            
            // Aggiorna i dati utente in AsyncStorage
            if (!Platform.isTV && typeof window !== 'undefined') {
              await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
              console.log('Dati utente aggiornati in AsyncStorage dopo verifica server');
            }
          } else {
            // Solo se non abbiamo ripristinato dati locali, considera l'utente non autenticato
            if (!localDataRestored) {
              console.log('Server non conferma autenticazione e nessun dato locale valido');
              setUser(null);
              setIsAuthenticated(false);
              
              // Pulisci lo storage solo se non ci sono dati locali validi
              if (!Platform.isTV && typeof window !== 'undefined') {
                await AsyncStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
                await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
                await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
              }
            } else {
              console.log('Server non conferma autenticazione ma manteniamo i dati locali');
            }
          }
        } catch (apiError) {
          console.error('Errore API durante checkUserAuth:', apiError);
          // Se il server non è raggiungibile, manteniamo comunque i dati locali
          if (!localDataRestored) {
            try {
              const userDataString = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
              if (userDataString) {
                console.log('Server non raggiungibile, uso dati locali come fallback');
                setUser(JSON.parse(userDataString));
                setIsAuthenticated(true);
              }
            } catch (storageError) {
              console.error('Errore nel fallback a dati locali:', storageError);
            }
          }
        }
      } else if (!localDataRestored) {
        console.log('Nessun token trovato e nessun dato locale valido');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err: any) {
      console.error('Errore critico durante il refresh dello stato utente:', err);
      setError(err.message || 'Errore durante la verifica dell\'autenticazione');
      
      // Tentativo finale di ripristino da dati locali in caso di errore critico
      try {
        const userDataString = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
        const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
        
        if (userDataString && token) {
          console.log('Ripristino di emergenza dai dati locali');
          setUser(JSON.parse(userDataString));
          setIsAuthenticated(true);
          setAuthToken(token);
        }
      } catch (finalError) {
        console.error('Fallimento ripristino di emergenza:', finalError);
      }
    } finally {
      setIsLoading(false);
      setInitialCheckDone(true);
      console.log('AuthProvider - Fine refresh dello stato utente, autenticato:', isAuthenticated);
    }
  }, []);

  // Verifica iniziale dell'autenticazione quando l'app viene caricata
  useEffect(() => {
    // Evita controlli multipli
    if (initialCheckDone) return;
    
    console.log('Avvio controllo autenticazione iniziale...');
    
    // Aggiungi un timeout per prevenire il blocco del check
    const checkAuthWithTimeout = async () => {
      try {
        // Crea un timeout di 8 secondi (aumentato per consentire tempo per il refresh)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout during auth check')), 8000)
        );
        
        // Esegui il check con timeout
        await Promise.race([refreshUserStatus(), timeoutPromise]);
      } catch (error) {
        console.error('Errore o timeout durante il check iniziale:', error);
        // In caso di timeout, tenta comunque di ripristinare i dati locali
        try {
          const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
          const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
          if (userData && token) {
            console.log('Ripristino dati utente da storage dopo timeout');
            setUser(JSON.parse(userData));
            setIsAuthenticated(true);
            setAuthToken(token);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (localErr) {
          console.error('Errore ripristino dati locali dopo timeout:', localErr);
          setUser(null);
          setIsAuthenticated(false);
        } finally {
          setIsLoading(false);
          setInitialCheckDone(true);
        }
      }
    };
    
    checkAuthWithTimeout();
  }, [refreshUserStatus, initialCheckDone]);

  // Effetto per ripristinare dall'AsyncStorage
  useEffect(() => {
    const restoreUserFromStorage = async () => {
      try {
        // Solo se l'utente non è già caricato e non siamo in SSR
        if (!user && !isLoading && !Platform.isTV && typeof window !== 'undefined') {
          // Prima ottieni il token
          const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
          if (token) {
            console.log('Token trovato in storage, tentativo di ripristino sessione...');
            setAuthToken(token);
            
            // Poi prova a caricare i dati utente dal localStorage
            const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
            if (userData) {
              // Se abbiamo sia token che utente, ripristiniamo temporaneamente
              const parsedUserData = JSON.parse(userData);
              console.log('Dati utente trovati in storage:', parsedUserData.email);
              setUser(parsedUserData);
              setIsAuthenticated(true);
              
              // Poi verifichiamo in background col server
              refreshUserStatus().catch(err => {
                console.error('Errore durante il refresh in background:', err);
              });
            } else {
              // Abbiamo un token ma non dati utente, verifica col server
              refreshUserStatus().catch(err => {
                console.error('Errore durante il refresh dopo token trovato:', err);
              });
            }
          }
        }
      } catch (error) {
        console.error('Errore durante il ripristino dei dati utente:', error);
      }
    };
    
    restoreUserFromStorage();
  }, [user, isLoading, refreshUserStatus]);
  
  // Effetto per gestire cambiamenti di stato dell'app
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // L'app è tornata in primo piano, aggiorna lo stato dell'utente
        console.log('App tornata attiva, verifico autenticazione...');
        refreshUserStatus().catch(err => {
          console.error('Errore durante il refresh al ritorno attivo:', err);
        });
      }
    };
    
    // Aggiungi listener per i cambiamenti di stato dell'app
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Pulizia al dismount
    return () => {
      subscription.remove();
    };
  }, [refreshUserStatus]);

  // Funzione di login
  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await loginUser(email, password);
      
      if (response.token && response.utente) {
        // Imposta i dati nella sessione e nello stato
        setUser(response.utente);
        setIsAuthenticated(true);
        console.log('Login completato con successo per:', email);
        console.log('Stato autenticazione aggiornato - isAuthenticated:', true);
        console.log('Stato autenticazione aggiornato - user:', JSON.stringify(response.utente));
        return true;
      } else {
        throw new Error('Credenziali non valide');
      }
    } catch (err: any) {
      console.error('Errore durante il login:', err);
      
      // Gestione migliorata degli errori
      if (err.response && err.response.status === 401) {
        setError('Email o password non corretti. Riprova.');
      } else if (err.message && err.message.includes('Network Error')) {
        setError('Impossibile connettersi al server. Verifica la tua connessione internet.');
      } else if (err.code === 'ECONNABORTED') {
        setError('La richiesta è scaduta. Il server potrebbe essere sovraccarico.');
      } else if (err.message && err.message.toLowerCase().includes('credenziali')) {
        setError('Email o password non corretti. Riprova.');
      } else {
        setError('Si è verificato un errore durante il login. Riprova più tardi.');
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Effettua direttamente il login con credenziali
   * Utile per il login automatico dopo la registrazione
   */
  const loginWithCredentials = async (email: string, password: string): Promise<boolean> => {
    try {
      logger.log('Tentativo di login diretto con:', email);
      setIsLoading(true);
      clearError();
      
      // Esegui la richiesta di login
      const response = await loginUser(email, password);
      
      if (response && response.token && response.utente) {
        // Aggiorna lo stato dell'autenticazione
        setUser(response.utente);
        setIsAuthenticated(true);
        
        logger.log('Login diretto completato con successo');
        
        // Mostra un toast di successo
        Toast.show({
          type: 'success',
          text1: 'Accesso effettuato',
          text2: `Benvenuto, ${response.utente.nome}!`,
          visibilityTime: 3000,
        });
        
        return true;
      } else {
        throw new Error('Dati di autenticazione non validi.');
      }
    } catch (error: any) {
      logger.error('Errore durante il login diretto:', error);
      
      // Non mostrare errori all'utente per il login automatico
      // ma registra l'errore nei log
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione di logout
  const logout = async (): Promise<void> => {
    logger.log('AuthContext - Avvio processo di logout...');
    setIsLoading(true);
    
    try {
      // Usa la funzione centralizzata di reset autenticazione
      resetAuthentication();
      logger.log('Stato di autenticazione resettato');
      
      // Pulizia dello storage in modo protetto
      if (!Platform.isTV && typeof window !== 'undefined') {
        try {
          // Pulizia sincronizzata per assicurarsi che venga completata
          await Promise.all([
            AsyncStorage.removeItem(STORAGE_KEYS.USER_TOKEN),
            AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
            AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
          ]);
          logger.log('Token e dati utente rimossi da AsyncStorage');
        } catch (storageErr) {
          logger.error('Errore durante la pulizia di AsyncStorage:', storageErr);
        }
      }
      
      // Chiama il servizio di logout (in modo sicuro, catturo errori)
      try {
        await logoutUser();
        logger.log('Richiesta di logout al server completata');
      } catch (err) {
        logger.error('Errore durante la chiamata al servizio di logout:', err);
        // Continuiamo con il logout locale anche se il server dà errore
      }
      
      // Mostra una notifica di successo
      Toast.show({
        type: 'success',
        text1: 'Logout completato',
        text2: 'Hai effettuato il logout con successo',
        visibilityTime: 3000,
      });
      
      logger.log('Logout completato con successo');
      
    } catch (err: any) {
      logger.error('Errore critico durante il logout:', err);
      
      // Forza comunque il reset in caso di errore
      resetAuthentication();
      
      // Tenta nuovamente la pulizia dello storage
      try {
        if (!Platform.isTV && typeof window !== 'undefined') {
          await AsyncStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
          await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
          await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        }
      } catch (storageErr) {
        logger.error('Errore durante la pulizia di emergenza di AsyncStorage:', storageErr);
      }
      
      setError('Si è verificato un errore durante il logout, ma la sessione è stata chiusa correttamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione per registrare un nuovo utente
  const register = async (
    nome: string, 
    cognome: string | null, 
    email: string, 
    password: string,
    tipologia: 'organizzazione' | 'utente' | null,
    ruoloOrganizzazione: string | null,
    tipoUtente: string | null,
    indirizzo?: string,
    telefono?: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      clearError();
      
      // Log per debug
      console.log('DATI REGISTRAZIONE:');
      console.log('- nome:', nome);
      console.log('- cognome:', cognome, typeof cognome);
      console.log('- tipologia:', tipologia);
      console.log('- tipoUtente:', tipoUtente);
      
      // Gestione speciale per cognome in base al tipo utente
      let cognomeToSend = cognome;
      
      // Se il cognome è una stringa vuota o il tipoUtente è Canale sociale/centro riciclo, invialo come null
      if (!cognome || cognome === '' || 
          (tipologia === 'utente' && (tipoUtente === 'Canale sociale' || tipoUtente === 'centro riciclo'))) {
        cognomeToSend = null;
        console.log('Impostato cognome a null per tipo:', tipoUtente);
      }
      
      // Chiama il servizio di registrazione con i dati correttamente formattati
      const userData: any = {
        nome,
        cognome: cognomeToSend, // Usa il valore appropriato
        email,
        password,
        ruolo: tipologia === 'organizzazione' 
              ? (ruoloOrganizzazione || 'Operatore')  // Fallback a Operatore se non specificato
              : 'Utente'
      };
      
      // Aggiungi i dati specifici del tipo utente se sono disponibili
      if (tipologia === 'utente' && tipoUtente) {
        userData.tipoUtente = {
          tipo: tipoUtente,
          indirizzo: indirizzo || '',
          telefono: telefono || '',
          email: email
        };
      }
      
      logger.log('Invio dati registrazione:', userData);
      
      // Passa l'oggetto userData alla funzione registerUser
      const response = await registerUser(userData);
      
      if (response && response.success) {
        logger.log('Registrazione completata con successo per:', email);
        
        // Mostra un messaggio di successo
        Toast.show({
          type: 'success',
          text1: 'Registrazione completata',
          text2: 'Puoi accedere con le tue credenziali',
          visibilityTime: 4000,
        });
        
        return true;
      } else {
        throw new Error('Errore durante la registrazione. Riprova più tardi.');
      }
    } catch (error: any) {
      logger.error('Errore durante la registrazione:', error);
      
      // Gestione migliorata degli errori
      if (error.response) {
        // Errori basati sullo status HTTP
        switch (error.response.status) {
          case 409:
            setError('Email già in uso. Prova con un altro indirizzo email.');
            break;
          case 400:
            // Estrai il messaggio dal server se disponibile
            const serverMessage = error.response.data?.message;
            if (serverMessage && typeof serverMessage === 'string') {
              setError(`Errore di validazione: ${serverMessage}`);
            } else {
              setError('I dati inseriti non sono validi. Verifica tutti i campi.');
            }
            break;
          case 404:
            setError('Servizio di registrazione non disponibile. Contatta l\'amministratore.');
            break;
          case 500:
            setError('Errore sul server. Riprova più tardi o contatta l\'assistenza.');
            break;
          default:
            setError(`Errore durante la registrazione (Codice: ${error.response.status}).`);
        }
      } else if (error.request) {
        // Errori di rete
        setError('Impossibile connettersi al server. Verifica la tua connessione internet.');
      } else if (error.message) {
        // Usa il messaggio dell'errore se disponibile
        setError(error.message);
      } else {
        // Errore generico
        setError('Si è verificato un errore durante la registrazione. Riprova più tardi.');
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione per pulire gli errori
  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        isLoading,
        error,
        login,
        logout,
        clearError,
        refreshUserStatus,
        register,
        loginWithCredentials
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizzato per utilizzare l'AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere utilizzato all\'interno di un AuthProvider');
  }
  
  // Verifica che le funzioni esistano e siano valide
  if (typeof context.logout !== 'function') {
    console.error('ERRORE CRITICO: context.logout non è una funzione valida!');
  }
  
  if (typeof context.refreshUserStatus !== 'function') {
    console.error('ERRORE CRITICO: context.refreshUserStatus non è una funzione valida!');
  }
  
  // Aggiungere una funzione di forceAuthUpdate per forzare l'aggiornamento dell'interfaccia
  const forceAuthUpdate = () => {
    console.log('useAuth - forceAuthUpdate chiamata');
    // Usa direttamente il refresh per forzare un aggiornamento dello stato
    if (typeof context.refreshUserStatus === 'function') {
      context.refreshUserStatus();
    } else {
      console.error('Impossibile forzare aggiornamento: refreshUserStatus non disponibile');
    }
  };
  
  // Estendi il context con le funzioni utili aggiuntive
  return {
    ...context,
    forceAuthUpdate
  };
}; 