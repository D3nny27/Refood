import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, STORAGE_KEYS, API_TIMEOUT, DATA_FRESHNESS_THRESHOLD } from '../config/constants';
import notificheService from './notificheService';
import pushNotificationService from './pushNotificationService';
import { getCachedUtenteId } from './prenotazioniService';

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
  utente_id: number;
  centro_id?: number; // Mantenuto per retrocompatibilità
  utente_nome?: string;
  centro_nome?: string; // Mantenuto per retrocompatibilità
  stato: 'Verde' | 'Arancione' | 'Rosso';
  categorie?: string[];
  origine?: string;
  image_path?: string | null;
  categoria?: string | null;
  allergeni?: string | null;
  lat?: number | null;
  lng?: number | null;
  created_at?: string;
  updated_at?: string;
  prenotazioni?: Array<any>; // Array di prenotazioni associate al lotto
  prenotazione_attiva?: any; // Eventuale prenotazione attiva
}

export interface LottoFiltri {
  stato?: 'Disponibile' | 'Prenotato' | 'InAttesa' | 'Confermato' | 'InTransito' | 'Consegnato' | 'Annullato' | 'Eliminato' | 'Scaduto';
  utente_id?: number; // ID dell'utente che ha inserito il lotto
  centro_id?: number; // Mantenuto per retrocompatibilità
  categoria?: string;
  data_scadenza_min?: string;
  data_scadenza_max?: string;
  nome?: string;
  descrizione?: string;
  prodotto?: string;
  solo_disponibili?: boolean;
  escludi_prenotati_da_me?: boolean;
  escludi_miei_lotti?: boolean;
  includi_miei_lotti?: boolean;
  includi_prenotati_da_me?: boolean;
  distanza_max?: number;
  lat?: number;
  lng?: number;
  page?: number;
  per_page?: number;
  mostraTutti?: boolean;
}

// Definiamo meglio l'interfaccia di ritorno per includere pagination
export interface LottiResponse {
  success: boolean;
  message?: string;
  lotti?: Lotto[]; // Per le risposte multiple
  lotto?: Lotto;   // Per le risposte singole
  error?: any;
  pagination?: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
  }
}

// Cache in memoria
let lottiCache = {
  data: null as LottiResponse | null,
  timestamp: 0,
  filtri: null as LottoFiltri | null
};

// Funzione per ottenere gli header di autenticazione
export const getAuthHeader = async () => {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    
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
    utente_id: lotto.utente_id || lotto.centro_id || 0,
    utente_nome: lotto.utente_nome || '',
    centro_nome: lotto.centro_nome || '',
    stato: lotto.stato || 'Verde',
    categorie: Array.isArray(lotto.categorie) ? lotto.categorie : [],
    image_path: lotto.image_path,
    categoria: lotto.categoria,
    allergeni: lotto.allergeni,
    lat: lotto.lat,
    lng: lotto.lng,
    created_at: lotto.created_at,
    updated_at: lotto.updated_at,
    prenotazioni: lotto.prenotazioni,
    prenotazione_attiva: lotto.prenotazione_attiva,
  };
};

// Funzione per invalidare la cache
export const invalidateCache = () => {
  lottiCache.timestamp = 0;
  lottiCache.data = null;
  lottiCache.filtri = null;
  console.log('Cache dei lotti invalidata');
};

// Funzione per normalizzare la risposta dell'API
const normalizeResponse = (response: any): LottiResponse => {
  // Se la risposta è già formattata, restituiscila
  if (response.success !== undefined) {
    return response;
  }
  
  // Altrimenti, formatta la risposta in modo standard
  if (Array.isArray(response)) {
    return {
      success: true,
      lotti: response
    };
  }
  
  if (response.data && Array.isArray(response.data)) {
    return {
      success: true,
      lotti: response.data,
      pagination: response.meta || response.pagination
    };
  }
  
  if (response.id) {
    return {
      success: true,
      lotto: response
    };
  }
  
  return {
    success: false,
    message: 'Risposta API non riconosciuta',
    error: response
  };
};

// Funzione per recuperare la lista dei lotti
export const getLotti = async (filtri: LottoFiltri = {}, forceRefresh = false): Promise<LottiResponse> => {
  try {
    // Se abbiamo dati in cache freschi e i filtri sono uguali, usa quelli
    const now = Date.now();
    if (
      !forceRefresh &&
      lottiCache.data && 
      lottiCache.timestamp > 0 && 
      (now - lottiCache.timestamp) < DATA_FRESHNESS_THRESHOLD &&
      JSON.stringify(lottiCache.filtri) === JSON.stringify(filtri)
    ) {
      console.log('Usando dati dalla cache per getLotti');
      return lottiCache.data;
    }
    
    console.log('Recupero lotti dal server con filtri:', filtri);
    const headers = await getAuthHeader();
    
    // Costruzione dei parametri di query
    const params: any = { ...filtri };
    
    // Compatibilità con vecchi nomi di parametri
    if (filtri.nome || filtri.descrizione || filtri.prodotto) {
      params.cerca = filtri.nome || filtri.descrizione || filtri.prodotto;
    }
    
    if (filtri.data_scadenza_min) {
      params.scadenza_min = filtri.data_scadenza_min;
    }
    
    if (filtri.data_scadenza_max) {
      params.scadenza_max = filtri.data_scadenza_max;
    }
    
    // Gestione delle prenotazioni attive
    if (filtri.escludi_prenotati_da_me === true) {
      // Escludiamo i lotti già prenotati dall'utente corrente
      params.escludi_prenotati_da_me = true;
      // Otteniamo l'ID dell'utente corrente
      const utenteId = await getCachedUtenteId();
      if (utenteId) {
        params.escludi_prenotati_da = utenteId; 
      }
    }
    
    if (filtri.escludi_miei_lotti === true) {
      // Escludiamo i lotti inseriti dall'utente corrente
      params.escludi_miei_lotti = true;
      // Otteniamo l'ID dell'utente corrente
      const utenteId = await getCachedUtenteId();
      if (utenteId) {
        params.escludi_utente_id = utenteId;
        params.escludi_centro_id = utenteId; // Per retrocompatibilità
      }
    }
    
    if (filtri.includi_miei_lotti === true) {
      // Includiamo solo i lotti inseriti dall'utente corrente
      params.includi_miei_lotti = true;
      // Otteniamo l'ID dell'utente corrente
      const utenteId = await getCachedUtenteId();
      if (utenteId) {
        params.utente_id = utenteId;
        params.centro_id = utenteId; // Per retrocompatibilità
      }
    }
    
    // Facciamo la richiesta all'API
    const response = await axios.get(`${API_URL}/lotti`, {
      headers,
      params,
      timeout: 10000
    });
    
    // Normalizziamo la risposta
    const normalizedResponse = normalizeResponse(response.data);
    
    // Salviamo nella cache
    lottiCache.data = normalizedResponse;
    lottiCache.timestamp = Date.now();
    lottiCache.filtri = filtri;
    
    return normalizedResponse;
  } catch (error: any) {
    console.error('Errore nel recupero dei lotti:', error);
    
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Errore nel recupero dei lotti',
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: error.message || 'Errore nel recupero dei lotti',
      error
    };
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
export const createLotto = async (lotto: Partial<Lotto>): Promise<LottiResponse> => {
  try {
    console.log('Creazione nuovo lotto:', JSON.stringify(lotto));
    
    // Ottieni gli header di autenticazione
    const headers = await getAuthHeader();
    
    // Ottieni l'utente_id corrente se non specificato
    if (!lotto.utente_id && !lotto.centro_id) {
      const utenteId = await getCachedUtenteId();
      if (utenteId) {
        lotto.utente_id = utenteId;
        lotto.centro_id = utenteId; // Per retrocompatibilità
      } else {
        console.warn('Nessun utente_id trovato per il lotto. Questo potrebbe causare problemi.');
      }
    }
    
    // Adatta i nomi dei campi a quelli attesi dal backend
    const payload = {
      prodotto: lotto.nome,
      quantita: lotto.quantita,
      unita_misura: lotto.unita_misura,
      data_scadenza: lotto.data_scadenza,
      descrizione: lotto.descrizione || '',
      utente_id: lotto.utente_id,
      centro_id: lotto.centro_id,
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
    return normalizeResponse(response.data);
  } catch (error: any) {
    console.error('Errore nella creazione del lotto:', error);
    
    // Se l'errore proviene dalla risposta, mostra il messaggio
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Errore nella creazione del lotto',
        error: error.response.data
      };
    }
    
    // Altrimenti mostra un messaggio generico
    return {
      success: false,
      message: error.message || 'Errore nella creazione del lotto',
      error
    };
  }
};

// Funzione per aggiornare un lotto esistente
export const updateLotto = async (lottoId: number, lotto: Partial<Lotto>): Promise<LottiResponse> => {
  try {
    console.log(`Aggiornamento lotto ${lottoId}`, lotto);
    const headers = await getAuthHeader();
    
    // Gestione date in formato ISO
    const payload = { ...lotto };
    
    // Converti le date in formato ISO (se non lo sono già)
    if (payload.data_scadenza && typeof payload.data_scadenza === 'object') {
      // Utilizziamo il cast esplicito per assicurarci che TypeScript tratti data_scadenza come Date
      const dataScadenza = payload.data_scadenza as unknown as Date;
      if (dataScadenza instanceof Date) {
        payload.data_scadenza = dataScadenza.toISOString().split('T')[0];
      }
    }
    
    const response = await axios.put(`${API_URL}/lotti/${lottoId}`, payload, {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    
    // Invalida la cache
    invalidateCache();
    
    return normalizeResponse(response.data);
  } catch (error: any) {
    console.error(`Errore nell'aggiornamento del lotto ${lottoId}:`, error);
    
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || `Errore nell'aggiornamento del lotto ${lottoId}`,
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: error.message || `Errore nell'aggiornamento del lotto ${lottoId}`,
      error
    };
  }
};

// Funzione migliorata per i lotti disponibili con gestione degli errori 500
export const getLottiDisponibili = async (filtri?: LottoFiltri, forceRefresh = false, mostraTutti = false): Promise<{lotti: Lotto[]}> => {
  try {
    console.log('Richiesta lotti disponibili con filtri:', filtri ? JSON.stringify(filtri) : 'nessun filtro', 'mostraTutti:', mostraTutti);
    
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
    
    try {
      const response = await axios.get(`${API_URL}/lotti/disponibili${queryParams}`, { 
        headers,
        timeout: 30000 // Aumentato a 30 secondi per dare più tempo al server
      });
      
      console.log('Risposta del server:', JSON.stringify(response.data));
      
      // Estrazione e normalizzazione dei dati
      const lottiData = response.data.lotti || response.data || [];
      const normalizedLotti = Array.isArray(lottiData) ? lottiData.map(normalizeLotto) : [];
      
      console.log(`Ricevuti e normalizzati ${normalizedLotti.length} lotti disponibili`);
      
      // Se mostraTutti è true, restituisci tutti i lotti senza filtrare quelli prenotati
      if (mostraTutti) {
        console.log('Richiesto di mostrare tutti i lotti, inclusi quelli già prenotati.');
        return {
          lotti: normalizedLotti
        };
      }
      
      // MIGLIORAMENTO: Verifico quali lotti hanno già prenotazioni attive e li escludo
      console.log('Verifico quali lotti hanno già prenotazioni attive...');
      
      try {
        // Richiedo tutte le prenotazioni attive
        const prenotazioniResponse = await axios.get(`${API_URL}/prenotazioni`, {
          headers,
          params: { 
            // Filtro solo per prenotazioni in stati attivi
            stato: 'Prenotato,Confermato,InAttesa,InTransito' 
          },
          timeout: 15000
        });
        
        // Estrai le prenotazioni dalla risposta
        const prenotazioni = prenotazioniResponse.data.data || 
                          prenotazioniResponse.data.prenotazioni || [];
        
        // Crea un set di IDs dei lotti già prenotati
        const lottiPrenotatiIds = new Set();
        prenotazioni.forEach((p: any) => {
          if (p.lotto_id) {
            lottiPrenotatiIds.add(p.lotto_id);
          }
        });
        
        console.log(`Trovati ${lottiPrenotatiIds.size} lotti con prenotazioni attive`);
        
        // Filtra i lotti escludendo quelli già prenotati
        const lottiFiltrati = normalizedLotti.filter(lotto => !lottiPrenotatiIds.has(lotto.id));
        
        console.log(`Rimossi ${normalizedLotti.length - lottiFiltrati.length} lotti già prenotati`);
        console.log(`Restituisco ${lottiFiltrati.length} lotti effettivamente disponibili`);
        
        return {
          lotti: lottiFiltrati
        };
      } catch (prenotErr) {
        console.warn('Errore nel controllo delle prenotazioni attive:', prenotErr);
        console.warn('Restituisco i lotti senza filtro per prenotazioni');
        // In caso di errore, restituisci i lotti originali
        return {
          lotti: normalizedLotti
        };
      }
    } catch (error) {
      console.error('Errore nella chiamata al server per i lotti disponibili:', error);
      
      // Gestione specifica per errori di rete e server
      if (axios.isAxiosError(error)) {
        // Gestione timeout o errori di connessione
        if (!error.response) {
          console.warn('Errore di rete durante il recupero dei lotti disponibili');
          return { lotti: [] }; // Ritorna un array vuoto invece di lanciare un errore
        }
        
        // Gestione errori server (500, 502, 503, 504)
        if (error.response.status >= 500) {
          console.warn(`Errore server ${error.response.status} durante il recupero lotti disponibili`);
          return { lotti: [] };
        }
      }
      
      // Per altri tipi di errori, rigeneriamo l'errore
      throw error;
    }
  } catch (err) {
    // Cast più sicuro dell'errore
    const error = err as any;
    console.error('Errore nel recupero dei lotti disponibili:', error);
    
    // Gestione specifica degli errori più comuni
    if (error.response?.status === 401) {
      throw new Error('Sessione scaduta. Effettua nuovamente il login.');
    } else if (error.code === 'ECONNABORTED') {
      console.warn('Timeout durante il caricamento dei lotti.');
      return { lotti: [] }; // Non bloccare l'app, ritorna array vuoto
    } else if (axios.isAxiosError(error)) {
      // Per gli errori di rete, non bloccare l'app
      if (!error.response) {
        console.warn('Impossibile comunicare con il server.');
        return { lotti: [] }; // Ritorna un array vuoto invece di lanciare un errore
      }
    }
    
    // Se stiamo ancora qui, ritorna comunque un array vuoto per non bloccare l'app
    return { lotti: [] };
  }
};

export default {
  getLotti,
  getLottoById,
  createLotto,
  getLottiDisponibili,
  invalidateCache
}; 