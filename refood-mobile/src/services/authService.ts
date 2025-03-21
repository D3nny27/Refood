import axios from 'axios';
import { API_URL } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';

// Definiamo le interfacce per i dati utente e le risposte API
export interface Utente {
  id: number;
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;
}

export interface LoginResponse {
  token: string;
  utente: Utente;
}

// Configurazione globale di axios per il timeout
axios.defaults.timeout = 15000; // 15 secondi

// Configurazione di axios con intercettore per il token
export const setAuthToken = (token: string | null) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

// Funzione per verificare se siamo in un ambiente server-side
const isSSR = () => {
  return typeof window === 'undefined' || typeof navigator === 'undefined';
};

// Funzione per ottenere il token in modo sicuro
export const getActiveToken = async (): Promise<string | null> => {
  try {
    // Skip AsyncStorage in ambienti SSR
    if (isSSR()) {
      console.log('SSR environment detected, skipping AsyncStorage');
      return null;
    }
    
    const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    return token;
  } catch (error) {
    console.error('Errore nel caricamento del token:', error);
    return null;
  }
};

// Funzione per salvare il token in modo sicuro
export const saveToken = async (token: string): Promise<boolean> => {
  try {
    // Skip AsyncStorage in ambienti SSR
    if (isSSR()) {
      console.log('SSR environment detected, skipping AsyncStorage');
      return false;
    }
    
    await AsyncStorage.setItem(STORAGE_KEYS.USER_TOKEN, token);
    setAuthToken(token);
    return true;
  } catch (error) {
    console.error('Errore nel salvataggio del token:', error);
    return false;
  }
};

// Funzione per effettuare il login
export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    console.log(`Tentativo di login per ${email} su ${API_URL}/auth/login`);
    
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    
    console.log('Login response status:', response.status);
    console.log('Login response data:', JSON.stringify(response.data, null, 2));
    
    // Controllo per il formato di risposta
    let token: string | null = null;
    let utente = null;
    
    // Tenta di estrarre token e utente dalla risposta
    if (response.data) {
      // Controllo per il nuovo formato (diretto)
      if (response.data.token && response.data.utente) {
        token = response.data.token;
        utente = response.data.utente;
      } 
      // Controllo per il vecchio formato (annidato)
      else if (response.data.tokens && response.data.tokens.access && response.data.user) {
        token = response.data.tokens.access;
        utente = response.data.user;
      }
    }
    
    // Verifica che abbiamo ottenuto sia token che utente
    if (token && utente) {
      console.log('Login successful, token received');
      return {
        token: token,
        utente: {
          id: utente.id,
          email: utente.email,
          nome: utente.nome,
          cognome: utente.cognome,
          ruolo: utente.ruolo
        }
      };
    } else {
      console.error('Login response formato non valido:', response.data);
      throw new Error('Formato risposta non valido');
    }
  } catch (error: any) {
    console.error('Login error:', error.message);
    
    if (error.response) {
      // Il server ha restituito una risposta con un codice di errore
      const statusCode = error.response.status;
      let errorMessage = '';
      
      switch (statusCode) {
        case 401:
          errorMessage = 'Credenziali non valide';
          break;
        case 404:
          errorMessage = 'Utente non trovato';
          break;
        case 500:
          errorMessage = 'Errore del server';
          break;
        default:
          errorMessage = `Errore durante il login (${statusCode})`;
      }
      
      throw new Error(errorMessage);
    } else if (error.request) {
      // La richiesta è stata effettuata ma non è stata ricevuta risposta
      console.error('Nessuna risposta dal server:', error.request);
      throw new Error('Il server non risponde. Verifica la tua connessione.');
    }
    
    // Errore durante l'impostazione della richiesta
    throw error;
  }
};

// Funzione per effettuare il logout
export const logoutUser = async (): Promise<void> => {
  try {
    // Ottieni il token prima della richiesta
    const token = await getActiveToken();
    
    if (token) {
      console.log('Invio richiesta di logout al server...');
      
      try {
        // Configura gli header con il token
        const config = {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          timeout: 5000 // Timeout più breve per la richiesta di logout
        };
        
        // Effettua la richiesta di logout al backend
        await axios.post(`${API_URL}/auth/logout`, {}, config);
        console.log('Logout dal server completato con successo');
      } catch (requestError) {
        console.warn('Errore nella richiesta di logout al server:', requestError);
        // Non blocchiamo il processo di logout per errori di rete
      }
    } else {
      console.log('Nessun token disponibile per il logout lato server');
    }
    
    // Sempre pulisci il token locale
    delete axios.defaults.headers.common['Authorization'];
    console.log('Token rimosso dagli header di default');
    
    return Promise.resolve();
  } catch (error) {
    console.error('Errore critico durante il processo di logout:', error);
    // Continuiamo con il logout anche in caso di errore
    return Promise.resolve();
  }
};

// Funzione per verificare se l'utente è autenticato
export const checkUserAuth = async (): Promise<Utente | null> => {
  try {
    // Ottieni il token
    const token = await getActiveToken();
    
    if (!token) {
      console.log('Nessun token trovato durante il check auth');
      return null;
    }
    
    // Configura gli header con il token
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    
    // Verifica il token con il backend
    const response = await axios.get(`${API_URL}/auth/me`, config);
    console.log('Auth check response:', JSON.stringify(response.data, null, 2));
    
    // Tenta di estrarre i dati utente dalla risposta
    let utente = null;
    
    if (response.data) {
      // Formato: { utente: {...} }
      if (response.data.utente) {
        utente = response.data.utente;
      } 
      // Formato: { user: {...} }
      else if (response.data.user) {
        utente = response.data.user;
      }
      // Formato: response.data è direttamente l'utente
      else if (response.data.id && response.data.email) {
        utente = response.data;
      }
    }
    
    if (utente) {
      return {
        id: utente.id,
        email: utente.email,
        nome: utente.nome,
        cognome: utente.cognome,
        ruolo: utente.ruolo
      };
    }
    
    return null;
  } catch (error) {
    console.error('Errore durante la verifica del token:', error);
    return null;
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