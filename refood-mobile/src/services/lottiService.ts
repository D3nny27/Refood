import axios from 'axios';
import { API_URL, STORAGE_KEYS, API_TIMEOUT, DATA_FRESHNESS_THRESHOLD } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configurazione globale di axios
axios.defaults.timeout = API_TIMEOUT; // Usa il timeout configurato nelle costanti

// Definizione delle interfacce
export interface Lotto {
  id: number;
  nome: string; // corrisponde a prodotto nel backend
  descrizione?: string;
  quantita: number;
  unita_misura: string;
  data_inserimento?: string;
  data_scadenza: string;
  centro_id: number; // corrisponde a centro_origine_id nel backend
  centro_nome?: string;
  stato: 'Verde' | 'Arancione' | 'Rosso';
  categorie?: string[];
  origine?: string;
}

export interface LottoFiltri {
  stato?: string;
  centro_id?: number;
  categoria?: string;
  scadenza_min?: string;
  scadenza_max?: string;
  cerca?: string;
}

// Cache in memoria
let lottiCache = {
  data: null as any,
  timestamp: 0,
  filtri: null as LottoFiltri | null
};

// Funzione per ottenere gli header di autenticazione
export const getAuthHeader = async () => {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    
    if (!token) {
      console.warn('Token di autenticazione non trovato!');
      throw new Error('Sessione scaduta. Effettua nuovamente il login.');
    }
    
    return { Authorization: `Bearer ${token}` };
  } catch (error) {
    console.error('Errore nel recupero del token:', error);
    throw error;
  }
};

// Funzione per normalizzare i lotti (adatta i nomi dei campi)
export const normalizeLotto = (lotto: any): Lotto => {
  return {
    id: lotto.id,
    nome: lotto.prodotto || lotto.nome || 'Senza nome',
    descrizione: lotto.descrizione || '',
    quantita: parseFloat(lotto.quantita) || 0,
    unita_misura: lotto.unita_misura || 'pz',
    data_inserimento: lotto.creato_il || lotto.data_inserimento,
    data_scadenza: lotto.data_scadenza,
    centro_id: lotto.centro_origine_id || lotto.centro_id || 0,
    centro_nome: lotto.centro_nome || '',
    stato: lotto.stato || 'Verde',
    categorie: Array.isArray(lotto.categorie) ? lotto.categorie : [],
  };
};

// Funzione per invalidare la cache
export const invalidateCache = () => {
  lottiCache.timestamp = 0;
  console.log('Cache dei lotti invalidata');
};

// Funzione per ottenere la lista dei lotti con filtri opzionali
export const getLotti = async (filtri?: LottoFiltri, forceRefresh = false) => {
  try {
    console.log('Richiesta lotti con filtri:', filtri ? JSON.stringify(filtri) : 'nessun filtro');
    
    // Verifica se possiamo usare la cache
    const now = Date.now();
    const cacheAge = now - lottiCache.timestamp;
    const filtriEqual = JSON.stringify(filtri) === JSON.stringify(lottiCache.filtri);
    
    if (!forceRefresh && lottiCache.data && filtriEqual && cacheAge < DATA_FRESHNESS_THRESHOLD) {
      console.log('Usando lotti dalla cache locale (età cache:', Math.round(cacheAge/1000), 'secondi)');
      return lottiCache.data;
    }
    
    const headers = await getAuthHeader();
    
    // Costruisce i parametri di query dai filtri
    let queryParams = '';
    if (filtri) {
      const params = new URLSearchParams();
      Object.entries(filtri).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });
      queryParams = `?${params.toString()}`;
    }
    
    console.log(`Richiesta GET ${API_URL}/lotti${queryParams}`);
    
    const response = await axios.get(`${API_URL}/lotti${queryParams}`, { 
      headers,
      timeout: 15000 // Aumentato il timeout a 15 secondi
    });
    
    console.log('Risposta del server:', JSON.stringify(response.data));
    
    // Estrazione e normalizzazione dei dati
    const lottiData = response.data.lotti || response.data.data || [];
    const normalizedLotti = lottiData.map(normalizeLotto);
    
    // Formattazione della risposta
    const result = {
      lotti: normalizedLotti,
      pagination: response.data.pagination || null
    };
    
    console.log(`Ricevuti e normalizzati ${normalizedLotti.length} lotti`);
    
    // Aggiorna la cache
    lottiCache = {
      data: result,
      timestamp: now,
      filtri: filtri || null
    };
    
    return result;
  } catch (error: any) {
    console.error('Errore nel recupero dei lotti:', error);
    
    // Gestione specifica errori
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
      throw new Error('Timeout durante il caricamento dei lotti. Verifica la connessione al server.');
    } else if (error.response) {
      // Il server ha risposto con un errore
      if (error.response.status === 401) {
        throw new Error('Sessione scaduta. Effettua nuovamente il login.');
      } else {
        throw new Error(`Errore dal server: ${error.response.status} - ${error.response.data?.message || 'Errore sconosciuto'}`);
      }
    } else if (error.request) {
      // Nessuna risposta ricevuta
      throw new Error('Nessuna risposta dal server. Verifica la connessione di rete.');
    }
    
    throw error;
  }
};

// Funzione per ottenere un singolo lotto per ID
export const getLottoById = async (id: number) => {
  try {
    console.log(`Richiesta dettagli lotto ${id} in corso...`);
    
    const headers = await getAuthHeader();
    const response = await axios.get(`${API_URL}/lotti/${id}`, { 
      headers,
      timeout: 10000
    });
    
    console.log(`Dettagli lotto ${id} ricevuti:`, JSON.stringify(response.data));
    
    // Normalizza il lotto ricevuto
    return normalizeLotto(response.data);
  } catch (error: any) {
    console.error(`Errore nel recupero del lotto ${id}:`, error);
    
    if (error.response?.status === 404) {
      throw new Error(`Lotto ${id} non trovato.`);
    } else if (error.response?.status === 401) {
      throw new Error('Sessione scaduta. Effettua nuovamente il login.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error(`Timeout durante il caricamento del lotto. Verifica la connessione al server.`);
    }
    
    throw error;
  }
};

// Funzione per creare un nuovo lotto
export const createLotto = async (lotto: Omit<Lotto, 'id' | 'stato'>) => {
  try {
    console.log('Creazione nuovo lotto:', JSON.stringify(lotto));
    
    // Ottieni gli header di autenticazione
    const headers = await getAuthHeader();
    
    // Adatta i nomi dei campi a quelli attesi dal backend
    const payload = {
      prodotto: lotto.nome,
      quantita: lotto.quantita,
      unita_misura: lotto.unita_misura,
      data_scadenza: lotto.data_scadenza,
      descrizione: lotto.descrizione || '',
      centro_origine_id: lotto.centro_id,
      giorni_permanenza: 7 // Valore predefinito
    };
    
    console.log('Payload per creazione lotto:', JSON.stringify(payload));
    
    // Effettua la richiesta
    const response = await axios.post(`${API_URL}/lotti`, payload, { 
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000 // Aumentato il timeout a 30 secondi
    });
    
    console.log('Risposta creazione lotto:', JSON.stringify(response.data));
    
    // Invalida la cache
    invalidateCache();
    
    // Normalizza e restituisci il lotto creato
    return {
      success: true,
      message: response.data.message || 'Lotto creato con successo',
      lotto: normalizeLotto(response.data.lotto || response.data)
    };
  } catch (error: any) {
    console.error('Errore nella creazione del lotto:', error);
    
    let errorMessage = 'Errore nella creazione del lotto';
    
    if (error.response) {
      console.error('Risposta errore dal server:', error.response.status, error.response.data);
      errorMessage = error.response.data?.message || `Errore dal server (${error.response.status})`;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'La richiesta è scaduta. Il server potrebbe essere sovraccarico.';
    } else if (error.request) {
      errorMessage = 'Nessuna risposta dal server. Verificare la connessione.';
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    return {
      success: false,
      message: errorMessage
    };
  }
};

// Funzione per ottenere i lotti disponibili per prenotazione
export const getLottiDisponibili = async (filtri?: LottoFiltri, forceRefresh = false) => {
  try {
    console.log('Richiesta lotti disponibili con filtri:', filtri ? JSON.stringify(filtri) : 'nessun filtro');
    
    const headers = await getAuthHeader();
    
    // Costruisce i parametri di query dai filtri
    let queryParams = '';
    if (filtri) {
      const params = new URLSearchParams();
      Object.entries(filtri).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });
      queryParams = `?${params.toString()}`;
    }
    
    console.log(`Richiesta GET ${API_URL}/lotti/disponibili${queryParams}`);
    
    const response = await axios.get(`${API_URL}/lotti/disponibili${queryParams}`, { 
      headers,
      timeout: 15000
    });
    
    console.log('Risposta del server:', JSON.stringify(response.data));
    
    // Estrazione e normalizzazione dei dati
    const lottiData = response.data.lotti || response.data || [];
    const normalizedLotti = lottiData.map(normalizeLotto);
    
    console.log(`Ricevuti e normalizzati ${normalizedLotti.length} lotti disponibili`);
    
    return {
      lotti: normalizedLotti
    };
  } catch (error: any) {
    console.error('Errore nel recupero dei lotti disponibili:', error);
    
    if (error.response?.status === 401) {
      throw new Error('Sessione scaduta. Effettua nuovamente il login.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout durante il caricamento dei lotti. Verifica la connessione al server.');
    }
    
    throw error;
  }
};

export default {
  getLotti,
  getLottoById,
  createLotto,
  getLottiDisponibili,
  invalidateCache
}; 