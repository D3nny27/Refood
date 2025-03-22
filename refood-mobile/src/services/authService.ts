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
    console.log('Refresh token salvato con successo in AsyncStorage');
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

// Funzione per verificare lo stato di autenticazione dell'utente
export const checkUserAuth = async (): Promise<Utente | null> => {
  const token = await getActiveToken();
  if (!token) {
    console.log('Nessun token trovato durante il checkUserAuth');
    return null;
  }

  try {
    // Imposta l'header di autenticazione
    setAuthToken(token);
    
    // Effettua la richiesta al server per verificare l'autenticazione
    const response = await axios.get(`${API_URL}/users/profile`);
    
    if (response.status === 200 && response.data) {
      console.log('Autenticazione verificata con successo:', response.data.email);
      return response.data;
    } else {
      console.log('Risposta di verifica autenticazione non valida:', response.status);
      return null;
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('Errore durante la verifica dell\'autenticazione:', error.response.status);
      
      // Se il token è scaduto (401), prova a fare il refresh
      if (error.response.status === 401) {
        console.log('Token scaduto, tentativo di refresh...');
        const newToken = await refreshToken();
        if (newToken) {
          // Riprova la verifica con il nuovo token
          return checkUserAuth();
        }
      } 
      // Se l'endpoint non esiste (404), consideriamo valida l'autenticazione locale
      else if (error.response.status === 404) {
        console.log('Endpoint non trovato (404) - controllo fallito');
        console.log('Manteniamo l\'autenticazione basata sul token locale');
        
        // Verifica nella cache locale se abbiamo i dati utente
        try {
          const userDataStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
          if (userDataStr) {
            const userData = JSON.parse(userDataStr);
            console.log('Autenticazione mantenuta usando dati locali per:', userData.email);
            return userData;
          }
        } catch (cacheErr) {
          console.error('Errore nel recupero dati utente dalla cache:', cacheErr);
        }
      }
    } else {
      console.error('Errore di rete durante la verifica dell\'autenticazione:', error);
    }
    return null;
  }
};

// Funzione per rinnovare il token usando il refresh token
export const refreshToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      console.log('Nessun refresh token trovato');
      return null;
    }
    
    console.log('Tentativo di refresh del token...');
    const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    
    if (response.status === 200 && response.data.token) {
      // Salva il nuovo token
      await saveToken(response.data.token);
      console.log('Token rinnovato con successo');
      
      // Se c'è un nuovo refresh token, salvalo
      if (response.data.refreshToken) {
        await saveRefreshToken(response.data.refreshToken);
      }
      
      return response.data.token;
    } else {
      console.log('Risposta non valida durante il refresh del token');
      return null;
    }
  } catch (error) {
    console.error('Errore durante il refresh del token:', error);
    return null;
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
      
      // Salva il token in modo sicuro
      await saveToken(authToken);
      
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
  cognome: string;
  ruolo: string;
}) => {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, userData);
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data && error.response.data.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error('Si è verificato un errore durante la registrazione');
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