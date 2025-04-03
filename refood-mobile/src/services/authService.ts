import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, API_URL, API_TIMEOUT } from '../config/constants';
import { Platform } from 'react-native';
import { setAuthToken } from './api';
import { Utente } from '../types/user';

// Definiamo le interfacce per i dati utente e le risposte API
export interface LoginResponse {
  token: string;
  utente: Utente;
  refreshToken?: string;
  error?: string;
}

// Configurazione globale di axios per il timeout
axios.defaults.timeout = 15000; // 15 secondi

// Verifica se siamo in un ambiente SSR (Server-Side Rendering)
const isSSR = (): boolean => {
  return typeof window === 'undefined' || Platform.OS === 'web' && typeof document === 'undefined';
};

// Funzione per salvare il token nell'AsyncStorage
export const saveToken = async (token: string): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_TOKEN, token);
    // Aggiorna l'header di autenticazione
    setAuthToken(token);
    console.log('Token salvato con successo in AsyncStorage');
    return true;
  } catch (error) {
    console.error('Errore durante il salvataggio del token:', error);
    return false;
  }
};

// Funzione per salvare il refresh token nell'AsyncStorage
export const saveRefreshToken = async (refreshToken: string): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    console.log('Refresh token salvato in AsyncStorage');
    return true;
  } catch (error) {
    console.error('Errore durante il salvataggio del refresh token:', error);
    return false;
  }
};

// Funzione per ottenere il token attivo dall'AsyncStorage
export const getActiveToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    console.log('Token recuperato da AsyncStorage:', token ? 'presente' : 'assente');
    return token;
  } catch (error) {
    console.error('Errore durante il recupero del token:', error);
    return null;
  }
};

// Funzione per ottenere il refresh token da AsyncStorage
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    return token;
  } catch (error) {
    console.error('Errore durante il recupero del refresh token:', error);
    return null;
  }
};

// Esporta esplicitamente checkUserAuth
export const checkUserAuth = async (): Promise<any> => {
  try {
    console.log('⭐ Inizio verifica autenticazione utente');
    const token = await getActiveToken();
    
    // Recuperiamo subito i dati utente locali come backup
    let localUserData = null;
    try {
      const userDataStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (userDataStr) {
        localUserData = JSON.parse(userDataStr);
        console.log('✅ Dati locali utente recuperati con successo per:', localUserData.email);
        
        // MODIFICA IMPORTANTE: Se abbiamo dati locali, diamo priorità a questi
        // Questo garantisce un comportamento coerente tra amministratori e utenti normali
        console.log('ℹ️ Utilizzo dati locali come fonte primaria per garantire coerenza');
        
        // Aggiorniamo il token per sicurezza
        if (token) {
          setAuthToken(token);
        }
        
        // Se non abbiamo un token, ritorniamo comunque i dati locali
        if (!token) {
          console.log('⚠️ Nessun token ma dati locali disponibili, ritorno dati locali');
          return localUserData;
        }
      }
    } catch (localDataErr) {
      console.error('❌ Errore nel recupero dati utente locali:', localDataErr);
    }
    
    if (!token) {
      console.log('❌ Nessun token trovato durante il checkUserAuth');
      return localUserData; // Ritorniamo i dati locali anche se null
    }

    try {
      // Imposta l'header di autenticazione
      setAuthToken(token);
      
      // MODIFICA: Se abbiamo dati locali, prima li ritorniamo e poi verifichiamo in background
      if (localUserData) {
        // Lanciamo una verifica in background ma ritorniamo subito i dati locali
        setTimeout(async () => {
          try {
            // Verifica silenziosamente col server
            const response = await axios.get(`${API_URL}/attori/profile`);
            if (response.status === 200 && response.data) {
              console.log('🔄 Aggiornamento dati utente in background completato');
              // Aggiorniamo silenziosamente lo storage
              await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data));
            }
          } catch (bgError) {
            // Ignoriamo errori in background
            console.log('ℹ️ Errore nella verifica in background (ignorato)');
          }
        }, 100);
        
        // Ritorniamo immediatamente i dati locali
        return localUserData;
      }
      
      // Se non abbiamo dati locali, procediamo con la verifica normale
      // Effettua la richiesta al server per verificare l'autenticazione
      console.log('🔍 Controllo autenticazione con:', `${API_URL}/attori/profile`);
      
      // Prima prova con il nuovo endpoint /attori/profile
      try {
        const response = await axios.get(`${API_URL}/attori/profile`);
        
        if (response.status === 200 && response.data) {
          console.log('✅ Autenticazione verificata con successo:', response.data.email);
          
          // Aggiorna i dati utente nel localStorage per mantenerli freschi
          await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data));
          
          return response.data;
        }
      } catch (attoreProfileErr) {
        // Log dettagliato per il debug
        if (axios.isAxiosError(attoreProfileErr)) {
          console.error(`❌ Errore durante il controllo con attori/profile: Status=${attoreProfileErr.response?.status}, Message=${attoreProfileErr.message}`);
        } else {
          console.error('❌ Errore non-Axios durante il controllo con attori/profile:', attoreProfileErr);
        }
        
        // Se abbiamo dati locali, li ritorniamo nonostante l'errore
        if (localUserData) {
          console.log('⚠️ Errore nella verifica col server, utilizzo dati locali');
          return localUserData;
        }
        
        // Se l'errore è 404, prova con il vecchio endpoint
        if (axios.isAxiosError(attoreProfileErr) && attoreProfileErr.response?.status === 404) {
          console.log('⚠️ Endpoint attori/profile non trovato, tentativo con users/profile...');
          try {
            const responseUsers = await axios.get(`${API_URL}/users/profile`);
            
            if (responseUsers.status === 200 && responseUsers.data) {
              console.log('✅ Autenticazione verificata con successo (users/profile):', responseUsers.data.email);
              
              // Aggiorna i dati utente nel localStorage
              await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(responseUsers.data));
              
              return responseUsers.data;
            }
          } catch (usersProfileErr) {
            // Log dettagliato per il debug
            if (axios.isAxiosError(usersProfileErr)) {
              console.error(`❌ Errore durante il controllo con users/profile: Status=${usersProfileErr.response?.status}, Message=${usersProfileErr.message}`);
            } else {
              console.error('❌ Errore non-Axios durante il controllo con users/profile:', usersProfileErr);
            }
            
            // Utilizziamo i dati locali come fallback (vedi sotto)
            if (localUserData) {
              console.log('⚠️ Errore nella verifica col server alternativo, utilizzo dati locali');
              return localUserData;
            }
          }
        } else if (axios.isAxiosError(attoreProfileErr) && (attoreProfileErr.response?.status === 401 || attoreProfileErr.response?.status === 403)) {
          // Se abbiamo dati locali, li ritorniamo anche in caso di 401/403
          if (localUserData) {
            console.log('⚠️ Token non valido ma dati locali disponibili, ritorno dati locali');
            return localUserData;
          }
          
          // Token scaduto o non autorizzato, tentativo di refresh
          console.log('⚠️ Token scaduto o non autorizzato (401/403), tentativo di refresh...');
          
          // Usiamo un timeout per il refresh per evitare blocchi
          const refreshPromise = new Promise<boolean>(async (resolve) => {
            try {
              const refreshSuccess = await refreshToken();
              resolve(refreshSuccess);
            } catch (e) {
              console.error('❌ Errore durante il refresh token:', e);
              resolve(false);
            }
          });
          
          // Aspettiamo al massimo 5 secondi per il refresh
          const timeoutPromise = new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(false), 5000);
          });
          
          const refreshSuccess = await Promise.race([refreshPromise, timeoutPromise]);
          
          if (refreshSuccess) {
            console.log('✅ Refresh token riuscito, nuovo tentativo di verifica autenticazione');
            // Otteniamo il nuovo token
            const newToken = await getActiveToken();
            if (newToken) {
              setAuthToken(newToken);
              // Riproviamo la verifica con il nuovo token
              try {
                const retryResponse = await axios.get(`${API_URL}/attori/profile`);
                if (retryResponse.status === 200 && retryResponse.data) {
                  console.log('✅ Autenticazione verificata con successo dopo refresh:', retryResponse.data.email);
                  await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(retryResponse.data));
                  return retryResponse.data;
                }
              } catch (retryErr) {
                console.error('❌ Errore nel retry dopo refresh token:', retryErr);
                // Fallback ai dati locali (vedi sotto)
              }
            }
          } else {
            console.error('❌ Refresh token fallito dopo 401/403');
            // Fallback ai dati locali (vedi sotto)
          }
        }
      }
      
      // A questo punto, se nessuna chiamata API ha avuto successo, usiamo i dati locali
      if (localUserData) {
        console.log('✅ FALLBACK: Utilizzo dati utente dalla cache locale per:', localUserData.email);
        // Reimpostiamo il token per sicurezza
        setAuthToken(token);
        return localUserData;
      }
      
      // Se non abbiamo ottenuto dati validi da nessuna fonte
      console.log('❌ Nessun dato utente valido trovato, autenticazione fallita');
      
      // Assicuriamoci che l'UI mostri lo stato corretto di sessione scaduta
      try {
        // Importa dinamicamente il modulo Toast per evitare dipendenze circolari
        const Toast = require('react-native-toast-message').default;
        if (Toast) {
          Toast.show({
            type: 'info',
            text1: 'Sessione scaduta',
            text2: 'Accedi nuovamente per continuare',
            visibilityTime: 4000,
          });
        }
      } catch (e) {
        console.error('Impossibile mostrare toast:', e);
      }
      
      return null;
    } catch (error) {
      // Log più dettagliato dell'errore per identificare meglio il problema
      if (axios.isAxiosError(error)) {
        console.error(`❌ Errore critico durante checkUserAuth - Status: ${error.response?.status}, Message: ${error.message}, Config URL: ${error.config?.baseURL || 'non disponibile'}`);
        if (error.response) {
          console.error('Dettagli risposta errore:', {
            data: error.response.data,
            headers: error.response.headers,
            status: error.response.status
          });
        }
      } else {
        console.error('❌ Errore non-Axios critico durante checkUserAuth:', error);
      }
      
      // Utilizzo dei dati locali come ultima risorsa in caso di errori generici
      if (localUserData) {
        console.log('✅ FALLBACK CRITICO: Utilizzo dati utente locali dopo errore per:', localUserData.email);
        // Reimpostiamo il token per sicurezza
        setAuthToken(token);
        return localUserData;
      }
      
      return null;
    }
  } catch (rootError) {
    // Errore fuori da tutto il flusso (es: errore nella lettura del token)
    console.error('❌ Errore top-level in checkUserAuth (metodo completo fallito):', rootError);
    return null;
  }
};

// Funzione per effettuare il refresh del token
export const refreshToken = async (): Promise<boolean> => {
  try {
    console.log('⭐ Tentativo di refresh del token di autenticazione');
    
    // Ottieni il refresh token
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      console.log('❌ Nessun refresh token disponibile, impossibile effettuare il refresh');
      return false;
    }
    
    console.log('✅ Refresh token trovato, tentativo di refresh...');
    
    // Impostiamo un timeout per la richiesta di refresh
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondi di timeout
    
    try {
      // Prova il nuovo endpoint /auth/refresh-token
      const refreshResponse = await axios.post(
        `${API_URL}/auth/refresh-token`, 
        { refresh_token: refreshToken },
        { 
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        }
      );
      
      // Puliamo il timeout
      clearTimeout(timeoutId);
      
      if (refreshResponse?.status === 200 && refreshResponse?.data?.token) {
        console.log('✅ Refresh token completato con successo');
        
        // Salva il nuovo token di accesso
        await saveToken(refreshResponse.data.token);
        
        // Se c'è un nuovo refresh token, salvalo
        if (refreshResponse.data.refreshToken) {
          await saveRefreshToken(refreshResponse.data.refreshToken);
        }
        
        // Se ci sono anche i dati utente, aggiornali in locale
        if (refreshResponse.data.utente) {
          await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(refreshResponse.data.utente));
        }
        
        return true;
      } else {
        console.log('⚠️ Risposta di refresh inattesa:', refreshResponse?.status, refreshResponse?.data);
        return false;
      }
    } catch (refreshError) {
      // Puliamo il timeout in caso di errore
      clearTimeout(timeoutId);
      
      // Verifica se l'errore è un timeout o un abort
      if (refreshError.name === 'AbortError' || refreshError.code === 'ECONNABORTED') {
        console.error('❌ Timeout durante il refresh del token');
        return false;
      }
      
      // Se l'endpoint /auth/refresh-token non esiste (404) o fallisce, prova con /auth/refresh
      if (axios.isAxiosError(refreshError) && refreshError.response?.status === 404) {
        console.log('⚠️ Endpoint /auth/refresh-token non trovato, tentativo con /auth/refresh...');
        
        // Creiamo un nuovo controller per il nuovo tentativo
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 10000);
        
        try {
          const legacyRefreshResponse = await axios.post(
            `${API_URL}/auth/refresh`,
            { refresh_token: refreshToken },
            { 
              headers: { 'Content-Type': 'application/json' },
              signal: controller2.signal
            }
          );
          
          clearTimeout(timeoutId2);
          
          if (legacyRefreshResponse?.status === 200 && legacyRefreshResponse?.data?.token) {
            console.log('✅ Refresh token completato con successo (endpoint legacy)');
            
            // Salva il nuovo token di accesso
            await saveToken(legacyRefreshResponse.data.token);
            
            // Se c'è un nuovo refresh token, salvalo
            if (legacyRefreshResponse.data.refreshToken) {
              await saveRefreshToken(legacyRefreshResponse.data.refreshToken);
            }
            
            // Se ci sono anche i dati utente, aggiornali in locale
            if (legacyRefreshResponse.data.utente) {
              await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(legacyRefreshResponse.data.utente));
            }
            
            return true;
          } else {
            console.log('⚠️ Risposta di refresh legacy inattesa:', legacyRefreshResponse?.status, legacyRefreshResponse?.data);
            return false;
          }
        } catch (legacyRefreshError) {
          clearTimeout(timeoutId2);
          
          if (legacyRefreshError.name === 'AbortError' || legacyRefreshError.code === 'ECONNABORTED') {
            console.error('❌ Timeout durante il refresh del token (endpoint legacy)');
            return false;
          }
          
          console.error('❌ Errore durante il refresh token (endpoint legacy):', legacyRefreshError);
          return false;
        }
      } else {
        console.error('❌ Errore durante il refresh token:', refreshError);
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Errore generale durante il refresh token:', error);
    return false;
  }
};

/**
 * Salva la sessione utente, comprensiva di token e dati utente
 * Funzione di utilità per centralizzare la logica di salvataggio
 */
export const saveUserSession = async (token: string, userData: any): Promise<boolean> => {
  try {
    // Salva il token e imposta l'header di autenticazione
    await saveToken(token);
    setAuthToken(token);
    
    // Salva i dati utente in AsyncStorage
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
    
    console.log('Sessione utente salvata con successo');
    return true;
  } catch (error) {
    console.error('Errore durante il salvataggio della sessione:', error);
    return false;
  }
};

// Funzione per effettuare il login
export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  console.log('Tentativo di login per:', email);
  
  try {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
    
    console.log('Status risposta login:', response.status);
    console.log('Chiavi risposta:', Object.keys(response.data || {}));
    
    // Supporto per vari formati di risposta dal server
    let userData = null;
    let authToken = null;
    let refreshTokenValue = null;
    
    // Formato 1: { token, utente }
    if (response.data.token && response.data.utente) {
      console.log('Formato risposta: token + utente');
      userData = response.data.utente;
      authToken = response.data.token;
      refreshTokenValue = response.data.refreshToken;
    } 
    // Formato 2: { access_token, user }
    else if (response.data.access_token && response.data.user) {
      console.log('Formato risposta: access_token + user');
      userData = response.data.user;
      authToken = response.data.access_token;
      refreshTokenValue = response.data.refresh_token;
    } 
    // Formato 3: { tokens: { access, refresh }, user }
    else if (response.data.tokens && response.data.user) {
      console.log('Formato risposta: tokens (access,refresh) + user');
      userData = response.data.user;
      authToken = response.data.tokens.access;
      refreshTokenValue = response.data.tokens.refresh;
    }
    // Se disponibile, salva il refresh token
    if (refreshTokenValue) {
      await saveRefreshToken(refreshTokenValue);
      console.log('Refresh token salvato dopo login');
    }
    
    // Se abbiamo ottenuto i dati necessari, restituisci un oggetto normalizzato
    if (userData && authToken) {
      console.log('Login completato con successo per:', email);
      
      // Salva la sessione utente
      await saveUserSession(authToken, userData);
      
      // Restituisci un risultato normalizzato
      return {
        token: authToken,
        utente: userData
      };
    } else {
      console.error('Formato risposta non riconosciuto:', response.data);
      throw new Error('Risposta dal server non valida durante il login');
    }
  } catch (error) {
    console.error('Errore durante il login:', error);
    
    // Logga dettagli aggiuntivi per debug
    if (axios.isAxiosError(error) && error.response) {
      console.error('Status code:', error.response.status);
      console.error('Dati risposta errore:', error.response.data);
      
      // Gestisci specificamente gli errori 401 per credenziali errate
      if (error.response.status === 401) {
        throw new Error('Credenziali non valide');
      }
      
      // Se il server ha fornito un messaggio di errore, usalo
      if (error.response.data && error.response.data.message) {
        throw new Error(error.response.data.message);
      }
    }
    
    throw error;
  }
};

// Funzione per effettuare il logout
export const logoutUser = async (): Promise<boolean> => {
  try {
    // Chiama l'endpoint di logout sul server (se esiste)
    const token = await getActiveToken();
    if (token) {
      setAuthToken(token);
      try {
        await axios.post(`${API_URL}/auth/logout`);
        console.log('Logout effettuato sul server');
      } catch (err) {
        console.log('Nessun endpoint di logout disponibile o errore server');
      }
    }
    
    // Rimuovi tutti i token locali indipendentemente dalla risposta del server
    return true;
  } catch (error) {
    console.error('Errore durante il logout:', error);
    // Ritorna true comunque, permettiamo il logout anche in caso di errori
    return true;
  }
};

// Funzione per verificare se un token è valido
export const verifyToken = async (token: string): Promise<boolean> => {
  try {
    // Se il token è nullo o vuoto, ritorna false
    if (!token) return false;
    
    const response = await axios.get(`${API_URL}/auth/verifica`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data.valid === true;
  } catch (error) {
    console.error('Errore durante la verifica del token:', error);
    return false;
  }
};

// Funzione per registrare un nuovo utente (se necessario)
export const registerUser = async (userData: {
  email: string;
  password: string;
  nome: string;
  cognome: string | null;
  ruolo: string;
  tipoUtente?: {
    tipo: string;
    indirizzo: string;
    telefono: string;
    email: string;
  };
}) => {
  try {
    // Se il tipoUtente è definito come Canale sociale o centro riciclo, imposta cognome a null
    if (userData.ruolo === 'Utente' && userData.tipoUtente && 
       (userData.tipoUtente.tipo === 'Canale sociale' || userData.tipoUtente.tipo === 'centro riciclo')) {
      userData.cognome = null;
      console.log('Cognome impostato esplicitamente a null per tipo:', userData.tipoUtente.tipo);
    }
    
    // Se il cognome è una stringa vuota, impostalo a null
    if (userData.cognome === '') {
      userData.cognome = null;
      console.log('Cognome (stringa vuota) convertito a null prima dell\'invio API');
    }
    
    console.log(`Invio richiesta di registrazione al backend (${API_URL}/auth/register):`, userData);
    
    // Chiama l'API reale senza meccanismi di fallback
    const response = await axios.post(`${API_URL}/auth/register`, userData);
    
    console.log('Registrazione completata con successo tramite API:', response.data);
      
    // Restituisci i dati ricevuti dal server con flag success
    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    console.error('Errore durante la registrazione:', error);
    
    // Gestione dettagliata degli errori
    if (error.response) {
      // Se c'è una risposta dal server, estraiamo informazioni più dettagliate
      console.error('Status errore:', error.response.status);
      console.error('Dati errore:', error.response.data);
      
      // Errori comuni
      if (error.response.status === 409) {
        throw Object.assign(new Error('Email già registrata'), { response: error.response });
      } else if (error.response.status === 400) {
        const errorMessage = error.response.data?.message || 'Dati di registrazione non validi';
        throw Object.assign(new Error(errorMessage), { response: error.response });
      } else if (error.response.status === 404) {
        throw Object.assign(new Error('Endpoint di registrazione non trovato. Verifica il server API.'), { response: error.response });
      } else if (error.response.status === 500) {
        throw Object.assign(new Error('Errore interno del server durante la registrazione.'), { response: error.response });
      }
    } else if (error.request) {
      // Richiesta effettuata ma nessuna risposta ricevuta
      console.error('Nessuna risposta ricevuta dal server');
      throw Object.assign(new Error('Nessuna risposta dal server. Verifica la connessione internet o la disponibilità del server.'), { networkError: true });
    }
    
    // Per qualsiasi altro tipo di errore
    throw error;
  }
};

/**
 * Ottiene il token di autenticazione, controllando prima AUTH_TOKEN e poi USER_TOKEN
 * Aggiunge un log per il debug
 */
export const getAuthToken = async (): Promise<string | null> => {
  try {
    // Prima controlliamo il token standard di autenticazione
    let token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    
    // Se non esiste, proviamo con il token utente legacy
    if (!token) {
      token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      if (token) {
        console.log('Utilizzato USER_TOKEN come fallback');
      }
    }
    
    if (!token) {
      console.warn('Nessun token di autenticazione trovato in storage');
    }
    
    return token;
  } catch (error) {
    console.error('Errore nel recupero del token di autenticazione:', error);
    return null;
  }
}; 