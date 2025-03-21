import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, logoutUser, checkUserAuth, Utente } from '../services/authService';
import { getActiveToken, saveToken, setAuthToken } from '../services/authService';
import { STORAGE_KEYS } from '../config/constants';
import { Platform, AppState, AppStateStatus } from 'react-native';

interface AuthContextType {
  isAuthenticated: boolean;
  user: Utente | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUserStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<Utente | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState<boolean>(false);
  
  // Funzione per aggiornare lo stato dell'autenticazione
  const refreshUserStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      // Ottieni il token in modo sicuro
      const token = await getActiveToken();
      
      // Se abbiamo un token, verifica l'autenticazione
      if (token) {
        setAuthToken(token);
        console.log('Token esistente trovato, verifico autenticazione...');
        const userData = await checkUserAuth();
        
        if (userData) {
          console.log('Utente autenticato:', userData.email);
          setUser(userData);
          setIsAuthenticated(true);
          
          // Assicurati che i dati utente siano salvati in AsyncStorage
          if (!Platform.isTV && typeof window !== 'undefined') {
            await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
          }
        } else {
          // Token non valido, puliamo tutto
          console.log('Token non valido o scaduto');
          setUser(null);
          setIsAuthenticated(false);
          setAuthToken(null);
          if (!Platform.isTV && typeof window !== 'undefined') {
            await AsyncStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
            await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
          }
        }
      } else {
        console.log('Nessun token trovato, utente non autenticato');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err: any) {
      console.error('Errore durante il refresh dello stato utente:', err);
      setUser(null);
      setIsAuthenticated(false);
      setError(err.message || 'Errore durante la verifica dell\'autenticazione');
    } finally {
      setIsLoading(false);
      setInitialCheckDone(true);
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
        // Crea un timeout di 5 secondi
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout during auth check')), 5000)
        );
        
        // Esegui il check con timeout
        await Promise.race([refreshUserStatus(), timeoutPromise]);
      } catch (error) {
        console.error('Errore o timeout durante il check iniziale:', error);
        setIsLoading(false);
        setInitialCheckDone(true);
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
        // Salva il token in modo sicuro
        await saveToken(response.token);
        
        // Salva i dati utente
        if (!Platform.isTV && typeof window !== 'undefined') {
          await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.utente));
        }
        
        setUser(response.utente);
        setIsAuthenticated(true);
        console.log('Login successful for:', email);
        return true;
      } else {
        throw new Error('Credenziali non valide');
      }
    } catch (err: any) {
      console.error('Errore durante il login:', err);
      setError(err.message || 'Errore durante il login');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione di logout
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    
    try {
      console.log('Inizio processo di logout...');
      
      // Chiama il servizio di logout (in modo sicuro, catturo errori)
      try {
        await logoutUser();
        console.log('Richiesta di logout al server completata');
      } catch (err) {
        console.error('Errore durante la chiamata al servizio di logout:', err);
        // Continuiamo con il logout locale anche se il server dà errore
      }
      
      // Rimuovi token e dati utente
      setAuthToken(null);
      console.log('Token di autenticazione rimosso dai default headers');
      
      // Pulizia dello storage in modo protetto
      if (!Platform.isTV && typeof window !== 'undefined') {
        try {
          await AsyncStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
          await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
          console.log('Token e dati utente rimossi da AsyncStorage');
        } catch (storageErr) {
          console.error('Errore durante la pulizia di AsyncStorage:', storageErr);
        }
      }
      
      // Aggiorna lo stato dell'applicazione
      setUser(null);
      setIsAuthenticated(false);
      
      console.log('Logout completato con successo');
      
      // Reindirizza alla schermata di login se necessario
      // Questo avverrà automaticamente grazie ai protected routes
    } catch (err) {
      console.error('Errore critico durante il logout:', err);
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
        refreshUserStatus
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
  return context;
}; 