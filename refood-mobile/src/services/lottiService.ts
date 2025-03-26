import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, STORAGE_KEYS, API_TIMEOUT, DATA_FRESHNESS_THRESHOLD } from '../config/constants';
import notificheService from './notificheService';
import pushNotificationService from './pushNotificationService';

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

// Definiamo meglio l'interfaccia di ritorno per includere pagination
export interface LottiResponse {
  lotti: Lotto[];
  pagination?: any;
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
export const getLotti = async (filtri: LottoFiltri = {}, forceRefresh = false, mostraTutti = false): Promise<LottiResponse> => {
  try {
    // Usa la cache in memoria per migliorare le prestazioni
    const cacheKey = `lotti_${JSON.stringify(filtri)}`;
    
    // Verifica se possiamo usare la cache
    const now = Date.now();
    const cacheAge = now - lottiCache.timestamp;
    const filtriEqual = JSON.stringify(filtri) === JSON.stringify(lottiCache.filtri);
    
    if (!forceRefresh && lottiCache.data && filtriEqual && cacheAge < DATA_FRESHNESS_THRESHOLD) {
      console.log('Usando lotti dalla cache locale (età cache:', Math.round(cacheAge/1000), 'secondi)');
      return lottiCache.data;
    }
    
    // Costruisce i parametri di query dai filtri
    let queryParams = '';
    if (filtri) {
      const params = new URLSearchParams();
      if (filtri.stato) params.append('stato', filtri.stato);
      if (filtri.cerca) params.append('cerca', filtri.cerca);
      if (filtri.scadenza_min) params.append('data_min', filtri.scadenza_min);
      if (filtri.scadenza_max) params.append('data_max', filtri.scadenza_max);
      if (filtri.categoria) params.append('categoria', filtri.categoria);
      if (filtri.centro_id) params.append('centro_id', filtri.centro_id.toString());
      
      queryParams = `?${params.toString()}`;
    }
    
    const headers = await getAuthHeader();
    
    try {
      console.log(`Richiesta GET ${API_URL}/lotti${queryParams}`);
      
      const response = await axios.get(`${API_URL}/lotti${queryParams}`, { 
        headers,
        timeout: 20000 // Aumentato il timeout a 20 secondi
      });
      
      // Estrazione e normalizzazione dei dati
      const lottiData = response.data.lotti || response.data.data || [];
      const normalizedLotti = Array.isArray(lottiData) 
        ? lottiData.map(normalizeLotto) 
        : [];
      
      // Se mostraTutti è false, filtra i lotti per rimuovere quelli con prenotazioni attive
      if (!mostraTutti) {
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
          
          // Formattazione della risposta
          const result: LottiResponse = {
            lotti: lottiFiltrati,
            pagination: response.data.pagination || null
          };
          
          // Aggiorna la cache
          lottiCache = {
            data: result,
            timestamp: now,
            filtri
          };
          
          return result;
        } catch (prenotErr) {
          console.warn('Errore nel controllo delle prenotazioni attive:', prenotErr);
          console.warn('Restituisco i lotti senza filtro per prenotazioni');
        }
      }
      
      // Formattazione della risposta (se mostraTutti è true o se c'è stato un errore nel filtraggio)
      const result: LottiResponse = {
        lotti: normalizedLotti,
        pagination: response.data.pagination || null
      };
      
      console.log(`Ricevuti e normalizzati ${normalizedLotti.length} lotti`);
      
      // Aggiorna la cache
      lottiCache = {
        data: result,
        timestamp: now,
        filtri
      };
      
      return result;
    } catch (error) {
      console.error('Errore nel recupero dei lotti:', error);
      
      // Gestione specifica per errori 500 dal server
      if (axios.isAxiosError(error) && error.response?.status === 500) {
        console.warn('Errore interno del server (500), tentativo di utilizzo dati in cache');
        
        // Se ci sono dati in cache, usali anche se scaduti
        if (lottiCache.data) {
          console.log('Utilizzando dati lotti dalla cache dopo errore server');
          return lottiCache.data;
        }
        
        // Se non ci sono dati in cache, restituisci un array vuoto ma non bloccare l'app
        return { lotti: [] };
      }
      
      // Rilancia altri tipi di errori
      throw error;
    }
    
  } catch (err) {
    // Tipo più sicuro per l'errore
    const error = err as any;
    console.error('Errore nel recupero dei lotti:', error);
    
    // Gestione specifica errori
    if (error && (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED')) {
      console.warn('Timeout durante il caricamento dei lotti. Verifica la connessione.');
      // In caso di timeout, prova a usare la cache
      if (lottiCache.data) {
        return lottiCache.data;
      }
    } else if (axios.isAxiosError(error) && error.response) {
      // Il server ha risposto con un errore
      if (error.response.status === 401) {
        throw new Error('Sessione scaduta. Effettua nuovamente il login.');
      } 
    }
    
    // Se tutto fallisce, restituisci un array vuoto invece di bloccare l'app
    return { lotti: [] };
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
export const updateLotto = async (lottoId: number, lottoData: Partial<Lotto>, notifyAdmin: boolean = true): Promise<any> => {
  try {
    console.log(`Aggiornamento lotto ID ${lottoId}:`, JSON.stringify(lottoData));
    
    // Verifica se l'utente ha i permessi per aggiornare i lotti
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    const user = userData ? JSON.parse(userData) : null;
    
    if (!user || (user.ruolo !== 'Operatore' && user.ruolo !== 'Amministratore')) {
      throw new Error('Non hai i permessi per modificare questo lotto');
    }
    
    // Ottieni gli header di autenticazione
    const headers = await getAuthHeader();
    
    // Adatta i nomi dei campi a quelli attesi dal backend
    const payload: Record<string, any> = {};
    
    if (lottoData.nome !== undefined) payload.prodotto = lottoData.nome;
    if (lottoData.quantita !== undefined) payload.quantita = lottoData.quantita;
    if (lottoData.unita_misura !== undefined) payload.unita_misura = lottoData.unita_misura;
    if (lottoData.data_scadenza !== undefined) {
      // Assicuriamoci che la data sia nel formato corretto (YYYY-MM-DD)
      let dataScadenza = lottoData.data_scadenza;
      
      // Se è un oggetto Date, formattalo come stringa
      if (typeof dataScadenza === 'object' && dataScadenza instanceof Date) {
        dataScadenza = dataScadenza.toISOString().split('T')[0];
      } else if (typeof dataScadenza === 'string') {
        // Se è già una stringa, assicuriamoci che sia nel formato corretto YYYY-MM-DD
        // Prova a convertirla in Date e poi di nuovo in stringa per normalizzarla
        try {
          const date = new Date(dataScadenza);
          if (!isNaN(date.getTime())) {
            dataScadenza = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.error('Errore nella conversione della data:', e);
          // Se fallisce, mantieni il valore originale
        }
      }
      
      payload.data_scadenza = dataScadenza;
      console.log(`Data scadenza normalizzata: ${payload.data_scadenza}`);
    }
    if (lottoData.descrizione !== undefined) payload.descrizione = lottoData.descrizione;
    if (lottoData.stato !== undefined) payload.stato = lottoData.stato;
    
    console.log('Payload per aggiornamento lotto:', JSON.stringify(payload));
    
    // Effettua la richiesta
    const response = await axios.put(`${API_URL}/lotti/${lottoId}`, payload, {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('Risposta aggiornamento lotto:', JSON.stringify(response.data));
    
    // Invalida la cache
    invalidateCache();
    
    // Se l'aggiornamento ha avuto successo e dobbiamo notificare gli amministratori
    if (notifyAdmin && response.data) {
      try {
        // Ottieni info sull'utente attuale
        const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
        const user = userData ? JSON.parse(userData) : null;
        const userNomeCompleto = user ? `${user.nome} ${user.cognome}` : 'Operatore';
        
        // Ottieni il centro_id dal lotto aggiornato o da quello inviato
        const centroId = response.data.centro_origine_id || lottoData.centro_id;
        
        if (centroId) {
          // Prepara un messaggio descrittivo delle modifiche
          let descrizioneModifiche = 'Modifiche: ';
          if (lottoData.nome) descrizioneModifiche += 'nome, ';
          if (lottoData.quantita !== undefined) descrizioneModifiche += 'quantità, ';
          if (lottoData.unita_misura) descrizioneModifiche += 'unità di misura, ';
          if (lottoData.data_scadenza) descrizioneModifiche += 'data scadenza, ';
          if (lottoData.stato) descrizioneModifiche += 'stato, ';
          // Rimuovi l'ultima virgola e spazio
          descrizioneModifiche = descrizioneModifiche.replace(/, $/, '');
          
          // Invia la notifica agli amministratori e crea notifica locale per l'operatore
          await notificheService.addNotificaToAmministratori(
            centroId,
            'Lotto modificato',
            `Hai modificato il lotto "${response.data.prodotto || lottoData.nome}". ${descrizioneModifiche}`,
            userNomeCompleto
          );
          
          // Invia anche una notifica push locale
          await pushNotificationService.sendLocalNotification(
            'Lotto modificato',
            `Hai modificato il lotto "${response.data.prodotto || lottoData.nome}". ${descrizioneModifiche}`,
            {
              type: 'notifica',
              subtype: 'lotto_modificato',
              lottoId: lottoId
            }
          );
          
          console.log('Notifica inviata agli amministratori del centro per modifica lotto');
        }
      } catch (notifyError) {
        console.error('Errore nell\'invio della notifica agli amministratori:', notifyError);
      }
    }
    
    // Normalizza e restituisci il lotto aggiornato
    return {
      success: true,
      message: 'Lotto aggiornato con successo',
      lotto: normalizeLotto(response.data.lotto || response.data)
    };
  } catch (error: any) {
    console.error('Errore nell\'aggiornamento del lotto:', error);
    
    // Se l'errore proviene dalla risposta, mostra il messaggio
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Errore nell\'aggiornamento del lotto',
        error: error.response.data
      };
    }
    
    // Altrimenti mostra un messaggio generico
    return {
      success: false,
      message: error.message || 'Errore nell\'aggiornamento del lotto',
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