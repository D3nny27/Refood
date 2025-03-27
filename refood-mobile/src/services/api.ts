import axios, { AxiosError, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { API_URL, API_TIMEOUT, STORAGE_KEYS } from '../config/constants';
import { emitEvent, APP_EVENTS } from '../utils/events';
import logger from '../utils/logger';
import { Platform } from 'react-native';
// Importo getActiveToken da authService
import { getActiveToken } from './authService';

// Flag per prevenire cicli infiniti nelle risposte 401
let pendingAuthRefresh = false;
let consecutiveAuthErrors = 0;
const MAX_AUTH_ERRORS = 3;

// Dichiarazione dei tipi globali per TypeScript
declare global {
  interface Window {
    resetAuthState?: () => Promise<void>;
    handleJwtExpired?: () => void;
  }
  
  var resetAuthState: (() => void) | undefined;
  var handleJwtExpired: (() => Promise<void>) | undefined;
}

// Log avanzato per debugging
logger.log(`Inizializzazione API con URL: ${API_URL} e timeout: ${API_TIMEOUT}ms su piattaforma: ${Platform.OS}`);

// Creazione dell'istanza axios con configurazione di base
const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // Necessario per consentire le richieste con credenziali (cookies) su browser web
  withCredentials: Platform.OS === 'web'
});

// Funzione per gestire il token scaduto
const handleExpiredToken = async () => {
  logger.warn('Token scaduto rilevato dal servizio API');
  
  // Se ci sono troppi errori consecutivi, blocchiamo ulteriori tentativi
  if (consecutiveAuthErrors >= MAX_AUTH_ERRORS) {
    logger.error(`Troppi errori consecutivi di autenticazione (${consecutiveAuthErrors}), blocco ulteriori tentativi`);
    
    // Mostra messaggio all'utente
    Toast.show({
      type: 'error',
      text1: 'Problema di autenticazione',
      text2: 'Impossibile accedere. Prova a effettuare nuovamente il login.',
      visibilityTime: 5000,
    });
    
    // Emetti evento di JWT scaduto per gestire il logout e reindirizzamento
    emitEvent(APP_EVENTS.JWT_EXPIRED);
    
    // Reset dei contatori dopo un certo tempo
    setTimeout(() => {
      consecutiveAuthErrors = 0;
    }, 60000); // Reset dopo 1 minuto
    
    return;
  }
  
  // Incrementa il contatore degli errori
  consecutiveAuthErrors++;
  
  // Gestione specifica per il web
  if (Platform.OS === 'web') {
    logger.log('Gestione token scaduto specifica per Web');
    emitEvent(APP_EVENTS.JWT_EXPIRED);
    return;
  }
  
  // Per piattaforme mobile
  emitEvent(APP_EVENTS.JWT_EXPIRED);
};

// Recupera il token da AsyncStorage e lo imposta negli header
export const loadStoredToken = async () => {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      setAuthToken(token);
      logger.log('Token caricato da AsyncStorage e impostato negli header');
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Errore nel caricamento del token da AsyncStorage:', error);
    return false;
  }
};

// Funzione per impostare il token di autenticazione
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    logger.log('Token impostato negli header delle richieste');
    // Debug avanzato per verificare il token
    logger.log('Primi 10 caratteri del token: ' + token.substring(0, 10) + '...');
  } else {
    delete api.defaults.headers.common['Authorization'];
    logger.log('Token rimosso dagli header delle richieste');
  }
};

// Aggiungiamo una variabile per limitare i tentativi di refresh
let refreshAttemptCount = 0;
const MAX_REFRESH_ATTEMPTS = 3;

// Modifichiamo l'interceptor di risposta per gestire meglio i token
api.interceptors.response.use(
  (response) => {
    // Resettiamo il contatore dei tentativi di refresh quando riceviamo una risposta positiva
    refreshAttemptCount = 0;
    return response;
  },
  async (error) => {
    // Estrai la configurazione della richiesta originale
    const originalRequest = error.config;
    
    // Se superato il numero massimo di tentativi, non tentare più
    if (refreshAttemptCount >= MAX_REFRESH_ATTEMPTS) {
      logger.error(`API: Raggiunto il limite di ${MAX_REFRESH_ATTEMPTS} tentativi di refresh. Logout forzato.`);
      // Forza il logout
      handleExpiredToken();
      return Promise.reject(error);
    }
    
    if (error.response && error.response.status === 401 && originalRequest && !originalRequest.headers._retry) {
      logger.warn(`API: Ricevuto 401 Unauthorized per ${originalRequest.url}`);
      
      try {
        // Incrementa il contatore dei tentativi
        refreshAttemptCount++;
        
        // Tenta il refresh del token
        const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        
        if (!refreshToken) {
          logger.error('API: Refresh token non disponibile');
          handleExpiredToken();
          return Promise.reject(error);
        }
        
        logger.log(`API: Tentativo di refresh #${refreshAttemptCount}`);
        
        // Chiamata per refresh token senza utilizzare l'istanza api
        const response = await axios.post(`${API_URL}/auth/refresh-token`, { 
          refresh_token: refreshToken 
        });
        
        if (response.data && response.data.access_token) {
          const newToken = response.data.access_token;
          
          // Salva il nuovo token
          await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, newToken);
          
          // Se c'è un nuovo refresh token, salvalo
          if (response.data.refresh_token) {
            await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.data.refresh_token);
          }
          
          // Imposta il token negli header
          setAuthToken(newToken);
          
          // Riprova la richiesta originale con il nuovo token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          originalRequest.headers._retry = true;
          
          logger.log('API: Token rinnovato con successo, riprovo la richiesta originale');
          return api(originalRequest);
        } else {
          logger.error('API: Risposta di refresh non valida');
          handleExpiredToken();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        logger.error('API: Errore durante il refresh del token:', refreshError);
        // Se fallisce anche il refresh, procediamo con il logout
        handleExpiredToken();
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

// Modifico l'interceptor di richieste per rimuovere la sostituzione URL problematica e semplificare la logica
api.interceptors.request.use(
  async (config) => {
    // Aggiungi header di debug per tracciare le richieste
    config.headers['X-Platform'] = Platform.OS;
    
    // Logging più dettagliato delle richieste in fase di debug
    if (__DEV__) {
      logger.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    try {
      // Utilizziamo getActiveToken per recuperare il token da entrambe le chiavi possibili
      const token = await getActiveToken();
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        
        // Log solo per debugging
        if (__DEV__) {
          const masked = token.substring(0, 10) + '...' + token.substring(token.length - 5);
          logger.log(`API: Richiesta autenticata: ${masked}`);
        }
      } else {
        logger.warn(`API: Richiesta senza autenticazione a ${config.url}`);
      }
    } catch (error) {
      logger.error('API: Errore nel recupero token per la richiesta:', error);
    }
    
    return config;
  },
  (error) => {
    logger.error('API: Errore nella configurazione della richiesta:', error);
    return Promise.reject(error);
  }
);

// Inizializziamo caricando il token
loadStoredToken().then(tokenLoaded => {
  if (tokenLoaded) {
    logger.log('Token caricato all\'avvio dell\'applicazione');
  } else {
    logger.warn('Nessun token trovato all\'avvio dell\'applicazione');
  }
});

// Aggiungiamo una funzione specifica per la piattaforma web
if (Platform.OS === 'web') {
  logger.log('Configurazione specifica per piattaforma web...');
  
  // Se è un browser web, possiamo aggiungere gestione avanzata dei cookie
  // Questo codice è eseguito solo nel browser
  try {
    window.addEventListener('focus', async () => {
      logger.log('Finestra web riattivata, verifico stato autenticazione...');
      // Qui potresti aggiungere una verifica del token quando la finestra riceve il focus
    });
  } catch (e) {
    // Ignora errori in ambiente non-browser
  }
}

// Esporto l'istanza API configurata
export default api;

// Funzione per resettare lo stato dell'autenticazione
export const resetAuthState = async () => {
  try {
    logger.log('Richiesto reset dello stato di autenticazione');
    // Reset delle variabili di stato
    pendingAuthRefresh = false;
    consecutiveAuthErrors = 0;
    
    // Manteniamo i token per non forzare il logout, ma forziamo il ricaricamento
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      // Aggiungiamo un delay per essere sicuri che il token venga riapplicato
      setTimeout(() => {
        setAuthToken(token);
        logger.log('Token reimpostato dopo il reset dello stato di autenticazione');
      }, 100);
    }
    
    logger.log('Reset completato con successo');
    return { success: true, token: !!token };
  } catch (e: any) {
    logger.error('Errore durante il reset dello stato di autenticazione:', e);
    return { success: false, error: e.message };
  }
};

// Utility di debug per verificare lo stato dei token
export const debugAuthState = async () => {
  try {
    const authToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    
    console.log('====== DEBUG AUTENTICAZIONE ======');
    console.log('Auth token presente:', authToken ? 'Sì' : 'No');
    if (authToken) {
      console.log('Prima parte token:', authToken.substring(0, 15) + '...');
      
      // Verifica se il token è nel formato JWT
      const parts = authToken.split('.');
      if (parts.length === 3) {
        try {
          // Decodifico la parte payload del JWT
          const payload = JSON.parse(atob(parts[1]));
          console.log('Exp:', new Date(payload.exp * 1000).toISOString());
          console.log('Iat:', new Date(payload.iat * 1000).toISOString());
          console.log('Token scaduto:', payload.exp * 1000 < Date.now() ? 'Sì' : 'No');
        } catch (e) {
          console.log('Impossibile decodificare il payload del token');
        }
      } else {
        console.log('Il token non è in formato JWT valido');
      }
    }
    
    console.log('Refresh token presente:', refreshToken ? 'Sì' : 'No');
    console.log('pendingAuthRefresh:', pendingAuthRefresh);
    console.log('consecutiveAuthErrors:', consecutiveAuthErrors);
    console.log('Header Authorization nelle richieste:', 
      api.defaults.headers.common['Authorization'] ? 'Impostato' : 'Non impostato');
    if (api.defaults.headers.common['Authorization']) {
      console.log('Valore header:', String(api.defaults.headers.common['Authorization']).substring(0, 15) + '...');
    }
    console.log('================================');
    
    return {
      authToken: !!authToken,
      refreshToken: !!refreshToken,
      pendingAuthRefresh,
      consecutiveAuthErrors,
      headerSet: !!api.defaults.headers.common['Authorization']
    };
  } catch (e: any) {
    console.error('Errore durante il debug dell\'autenticazione:', e);
    return { error: e.message };
  }
};

// Aggiungiamo la funzione alle variabili globali per poterla chiamare dal debugger
if (typeof global !== 'undefined') {
  (global as any).resetAuthState = resetAuthState;
  (global as any).debugAuthState = debugAuthState;
} 