import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, STORAGE_KEYS, API_TIMEOUT } from '../config/constants';
import { Utente } from '../types/user';
import api from './api';
import logger from '../utils/logger';

/**
 * Cache delle richieste utenti per ridurre le chiamate API
 */
const CACHE_KEYS = {
  UTENTI: 'cache_utenti',
  UTENTE_DETTAGLIO: 'cache_utente_',
  UTENTI_FILTRATI: 'cache_utenti_filtrati_',
  UTENTI_ASSOCIATI: 'cache_utenti_associati_',
  UTENTI_TIPI: 'cache_utenti_tipi'
};

/**
 * Durata della cache in millisecondi (1 ora)
 */
const CACHE_DURATION = 3600000;

/**
 * Interfaccia per i filtri utenti
 */
export interface UtentiFiltri {
  page?: number;
  limit?: number;
  nome?: string;
  tipo?: string;
  associatiA?: number;
}

/**
 * Interfaccia per la risposta API degli utenti
 */
export interface UtentiResponse {
  data: Utente[];
  pagination: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

/**
 * Ottiene gli headers di autenticazione
 * @returns Headers con il token di autenticazione
 */
const getAuthHeader = async () => {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
  return {
    'Authorization': `Bearer ${token}`
  };
};

/**
 * Ottiene l'elenco degli utenti (ex centri)
 * @param filtri Filtri per la ricerca
 * @param forceRefresh Forza il refresh dei dati ignorando la cache
 * @returns Promise con la risposta API
 */
export const getUtenti = async (filtri: UtentiFiltri = {}, forceRefresh = false): Promise<UtentiResponse> => {
  try {
    // Costruisci la chiave della cache in base ai filtri
    const cacheKey = filtri.nome || filtri.tipo || filtri.associatiA 
      ? `${CACHE_KEYS.UTENTI_FILTRATI}${JSON.stringify(filtri)}`
      : CACHE_KEYS.UTENTI;
    
    // Verifica se i dati sono in cache e non è richiesto un refresh
    if (!forceRefresh) {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        // Usa la cache solo se non è scaduta
        if (Date.now() - timestamp < CACHE_DURATION) {
          logger.info(`Utilizzando dati utenti dalla cache per ${cacheKey}`);
          return data;
        }
      }
    }
    
    // Ottieni gli headers di autenticazione
    const headers = await getAuthHeader();
    
    // Costruisci i parametri di query
    const params: any = {};
    if (filtri.page) params.page = filtri.page;
    if (filtri.limit) params.limit = filtri.limit;
    if (filtri.nome) params.nome = filtri.nome;
    if (filtri.tipo) params.tipo = filtri.tipo;
    if (filtri.associatiA) params.associatiA = filtri.associatiA;
    
    // Effettua la richiesta API
    const response = await axios.get(`${API_URL}/utenti`, { 
      headers,
      params,
      timeout: API_TIMEOUT
    });
    
    // Gestisci diversi formati di risposta possibili
    let responseData: UtentiResponse;
    if (response.data && response.data.data) {
      responseData = response.data;
    } else if (response.data && Array.isArray(response.data)) {
      responseData = {
        data: response.data,
        pagination: {
          total: response.data.length,
          pages: 1,
          page: 1,
          limit: response.data.length
        }
      };
    } else {
      throw new Error('Formato risposta API non valido');
    }
    
    // Salva i dati in cache
    await AsyncStorage.setItem(cacheKey, JSON.stringify({
      data: responseData,
      timestamp: Date.now()
    }));
    
    return responseData;
  } catch (error) {
    logger.error('Errore nel caricamento degli utenti:', error);
    throw error;
  }
};

/**
 * Ottiene i dettagli di un utente specifico
 * @param id ID dell'utente
 * @param forceRefresh Forza il refresh dei dati ignorando la cache
 * @returns Promise con l'utente
 */
export const getUtenteById = async (id: number, forceRefresh = false): Promise<Utente> => {
  try {
    const cacheKey = `${CACHE_KEYS.UTENTE_DETTAGLIO}${id}`;
    
    // Verifica se i dati sono in cache e non è richiesto un refresh
    if (!forceRefresh) {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        // Usa la cache solo se non è scaduta
        if (Date.now() - timestamp < CACHE_DURATION) {
          logger.info(`Utilizzando dati utente dalla cache per ID ${id}`);
          return data;
        }
      }
    }
    
    // Ottieni gli headers di autenticazione
    const headers = await getAuthHeader();
    
    // Effettua la richiesta API
    const response = await axios.get(`${API_URL}/utenti/${id}`, { 
      headers,
      timeout: API_TIMEOUT
    });
    
    // Salva i dati in cache
    await AsyncStorage.setItem(cacheKey, JSON.stringify({
      data: response.data,
      timestamp: Date.now()
    }));
    
    return response.data;
  } catch (error) {
    logger.error(`Errore nel caricamento dell'utente ${id}:`, error);
    throw error;
  }
};

/**
 * Ottiene gli utenti associati all'attore corrente
 * @param forceRefresh Forza il refresh dei dati ignorando la cache
 * @returns Promise con l'elenco degli utenti associati
 */
export const getUtentiAssociati = async (forceRefresh = false): Promise<Utente[]> => {
  try {
    const cacheKey = CACHE_KEYS.UTENTI_ASSOCIATI;
    
    // Verifica se i dati sono in cache e non è richiesto un refresh
    if (!forceRefresh) {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        // Usa la cache solo se non è scaduta
        if (Date.now() - timestamp < CACHE_DURATION) {
          logger.info('Utilizzando utenti associati dalla cache');
          return data;
        }
      }
    }
    
    // Ottieni gli headers di autenticazione
    const headers = await getAuthHeader();
    
    // Effettua la richiesta API
    // Prima prova con il nuovo endpoint, poi fallback al vecchio se necessario
    try {
      const response = await axios.get(`${API_URL}/users/utenti`, { 
        headers,
        timeout: API_TIMEOUT
      });
      
      const utenti = response.data?.utenti || response.data?.data || [];
      
      // Salva i dati in cache
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        data: utenti,
        timestamp: Date.now()
      }));
      
      return utenti;
    } catch (error: any) {
      if (error.response && (error.response.status === 404 || error.response.status === 403)) {
        // Fallback al vecchio endpoint
        logger.warn('Endpoint /users/utenti non disponibile, provo con /users/centri');
        const responseFallback = await axios.get(`${API_URL}/users/centri`, { 
          headers,
          timeout: API_TIMEOUT
        });
        
        const utenti = responseFallback.data?.centri || responseFallback.data?.data || [];
        
        // Salva i dati in cache
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          data: utenti,
          timestamp: Date.now()
        }));
        
        return utenti;
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error('Errore nel caricamento degli utenti associati:', error);
    throw error;
  }
};

/**
 * Ottiene i tipi di utente disponibili
 * @returns Promise con i tipi di utente
 */
export const getUtentiTipi = async (): Promise<string[]> => {
  try {
    const cacheKey = CACHE_KEYS.UTENTI_TIPI;
    
    // Verifica se i dati sono in cache
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      // Usa la cache solo se non è scaduta
      if (Date.now() - timestamp < CACHE_DURATION) {
        logger.info('Utilizzando tipi utente dalla cache');
        return data;
      }
    }
    
    // Ottieni gli headers di autenticazione
    const headers = await getAuthHeader();
    
    // Effettua la richiesta API
    const response = await axios.get(`${API_URL}/utenti/tipi`, { 
      headers,
      timeout: API_TIMEOUT
    });
    
    const tipi = response.data || [];
    
    // Salva i dati in cache
    await AsyncStorage.setItem(cacheKey, JSON.stringify({
      data: tipi,
      timestamp: Date.now()
    }));
    
    return tipi;
  } catch (error) {
    logger.error('Errore nel caricamento dei tipi di utente:', error);
    // Valori di default in caso di errore
    return ['Privato', 'Canale sociale', 'Centro riciclo'];
  }
};

/**
 * Crea un nuovo utente
 * @param utente Dati dell'utente da creare
 * @returns Promise con l'utente creato
 */
export const createUtente = async (utente: Partial<Utente>): Promise<Utente> => {
  try {
    // Ottieni gli headers di autenticazione
    const headers = await getAuthHeader();
    
    // Effettua la richiesta API
    const response = await axios.post(`${API_URL}/utenti`, utente, { 
      headers,
      timeout: API_TIMEOUT
    });
    
    // Invalida le cache degli utenti
    await AsyncStorage.removeItem(CACHE_KEYS.UTENTI);
    await AsyncStorage.removeItem(CACHE_KEYS.UTENTI_ASSOCIATI);
    
    return response.data;
  } catch (error) {
    logger.error('Errore nella creazione dell\'utente:', error);
    throw error;
  }
};

/**
 * Aggiorna un utente esistente
 * @param id ID dell'utente da aggiornare
 * @param utente Dati dell'utente da aggiornare
 * @returns Promise con l'utente aggiornato
 */
export const updateUtente = async (id: number, utente: Partial<Utente>): Promise<Utente> => {
  try {
    // Ottieni gli headers di autenticazione
    const headers = await getAuthHeader();
    
    // Effettua la richiesta API
    const response = await axios.put(`${API_URL}/utenti/${id}`, utente, { 
      headers,
      timeout: API_TIMEOUT
    });
    
    // Invalida le cache degli utenti
    await AsyncStorage.removeItem(CACHE_KEYS.UTENTI);
    await AsyncStorage.removeItem(`${CACHE_KEYS.UTENTE_DETTAGLIO}${id}`);
    await AsyncStorage.removeItem(CACHE_KEYS.UTENTI_ASSOCIATI);
    
    return response.data;
  } catch (error) {
    logger.error(`Errore nell'aggiornamento dell'utente ${id}:`, error);
    throw error;
  }
};

/**
 * Associa un attore a un utente
 * @param utenteId ID dell'utente
 * @param attoreId ID dell'attore da associare
 * @returns Promise con la risposta
 */
export const associaAttore = async (utenteId: number, attoreId: number): Promise<any> => {
  try {
    // Ottieni gli headers di autenticazione
    const headers = await getAuthHeader();
    
    // Effettua la richiesta API
    const response = await axios.post(`${API_URL}/utenti/${utenteId}/attori/${attoreId}`, {}, { 
      headers,
      timeout: API_TIMEOUT
    });
    
    // Invalida le cache degli utenti
    await AsyncStorage.removeItem(`${CACHE_KEYS.UTENTE_DETTAGLIO}${utenteId}`);
    await AsyncStorage.removeItem(CACHE_KEYS.UTENTI_ASSOCIATI);
    
    return response.data;
  } catch (error) {
    logger.error(`Errore nell'associazione dell'attore ${attoreId} all'utente ${utenteId}:`, error);
    throw error;
  }
};

/**
 * Rimuove un attore da un utente
 * @param utenteId ID dell'utente
 * @param attoreId ID dell'attore da rimuovere
 * @returns Promise con la risposta
 */
export const rimuoviAttore = async (utenteId: number, attoreId: number): Promise<any> => {
  try {
    // Ottieni gli headers di autenticazione
    const headers = await getAuthHeader();
    
    // Effettua la richiesta API
    const response = await axios.delete(`${API_URL}/utenti/${utenteId}/attori/${attoreId}`, { 
      headers,
      timeout: API_TIMEOUT
    });
    
    // Invalida le cache degli utenti
    await AsyncStorage.removeItem(`${CACHE_KEYS.UTENTE_DETTAGLIO}${utenteId}`);
    await AsyncStorage.removeItem(CACHE_KEYS.UTENTI_ASSOCIATI);
    
    return response.data;
  } catch (error) {
    logger.error(`Errore nella rimozione dell'attore ${attoreId} dall'utente ${utenteId}:`, error);
    throw error;
  }
};

export default {
  getUtenti,
  getUtenteById,
  getUtentiAssociati,
  getUtentiTipi,
  createUtente,
  updateUtente,
  associaAttore,
  rimuoviAttore
}; 