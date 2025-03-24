import axios from 'axios';
import { API_URL } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';
import { Lotto } from './lottiService';

// Chiave per memorizzare il centro_id nella cache locale
const CENTRO_ID_STORAGE_KEY = 'user_centro_id';

// Interfaccia per le prenotazioni
export interface Prenotazione {
  id: number;
  lotto_id: number;
  centro_id: number;
  data_prenotazione: string;
  data_ritiro_prevista: string | null;
  data_ritiro_effettiva: string | null;
  stato: 'Richiesta' | 'Confermata' | 'Completata' | 'Annullata';
  note: string | null;
  created_at: string;
  updated_at: string;
  // Dati relazionati
  lotto?: Lotto;
  centro_nome?: string;
}

// Interfaccia per la risposta della prenotazione
export interface PrenotazioneResponse {
  success: boolean;
  message: string;
  prenotazione?: Prenotazione;
  error?: any;
  missingCentroId?: boolean;
}

// Interfaccia per i filtri delle prenotazioni
export interface PrenotazioneFiltri {
  stato?: string;
  data_inizio?: string;
  data_fine?: string;
  centro_id?: number;
}

// Cache per le prenotazioni
let prenotazioniCache = {
  data: null as any,
  timestamp: 0,
  filtri: null as PrenotazioneFiltri | null
};

// Costante per il tempo di freschezza dei dati (5 minuti)
const DATA_FRESHNESS_THRESHOLD = 5 * 60 * 1000;

// Funzione per salvare il centro_id nella cache locale
export const saveCentroId = async (centroId: number): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(CENTRO_ID_STORAGE_KEY, centroId.toString());
    console.log('Centro ID salvato nella cache locale:', centroId);
    return true;
  } catch (error) {
    console.error('Errore durante il salvataggio del centro_id:', error);
    return false;
  }
};

// Funzione per recuperare il centro_id dalla cache locale
export const getCachedCentroId = async (): Promise<number | null> => {
  try {
    const centroId = await AsyncStorage.getItem(CENTRO_ID_STORAGE_KEY);
    if (centroId) {
      const id = parseInt(centroId, 10);
      if (!isNaN(id)) {
        console.log('Centro ID recuperato dalla cache locale:', id);
        return id;
      }
    }
    return null;
  } catch (error) {
    console.error('Errore durante il recupero del centro_id:', error);
    return null;
  }
};

// Funzione per ottenere gli header di autenticazione
export const getAuthHeader = async () => {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    
    if (!token) {
      throw new Error('Token non trovato');
    }
    
    return { Authorization: `Bearer ${token}` };
  } catch (error) {
    console.error('Errore nel recupero del token:', error);
    throw error;
  }
};

// Funzione per effettuare una prenotazione
export const prenotaLotto = async (
  lotto_id: number, 
  data_ritiro_prevista: string | null = null, 
  note: string | null = null,
  override_centro_id?: number // Parametro opzionale per specificare manualmente il centro_id
): Promise<PrenotazioneResponse> => {
  try {
    console.log(`Prenotazione del lotto ${lotto_id} in corso...`);
    
    const headers = await getAuthHeader();
    console.log('Headers autenticazione:', headers);
    
    // Ottieni i dati dell'utente per recuperare il centro_id
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (!userData) {
      throw new Error('Dati utente non trovati. Effettua nuovamente il login.');
    }
    
    const user = JSON.parse(userData);
    console.log('Dati utente per prenotazione:', user);
    console.log('Ruolo utente:', user.ruolo);
    
    // Verifica se l'utente ha i permessi corretti
    if (user.ruolo !== 'CentroSociale' && user.ruolo !== 'CENTRO_SOCIALE' && 
        user.ruolo !== 'CentroRiciclaggio' && user.ruolo !== 'CENTRO_RICICLAGGIO') {
      console.error('Errore di autorizzazione: ruolo non valido', user.ruolo);
      throw new Error('Non hai i permessi per prenotare questo lotto. Solo i centri sociali o di riciclaggio possono prenotare.');
    }
    
    // Se è stato fornito un override_centro_id, utilizzalo direttamente e salvalo per il futuro
    let centro_id = override_centro_id;
    if (override_centro_id) {
      // Salva il centro_id per il futuro
      await saveCentroId(override_centro_id);
    } else {
      // Altrimenti prova a usare quello nei dati utente
      centro_id = user.centro_id;
      
      // Se non abbiamo ancora un centro_id, prova a recuperarlo dalla cache locale
      if (!centro_id) {
        const cachedCentroId = await getCachedCentroId();
        if (cachedCentroId !== null) {
          centro_id = cachedCentroId;
          console.log('Usando centro_id dalla cache locale:', centro_id);
        }
      }
    }
    
    console.log('Centro ID iniziale:', centro_id, 
      override_centro_id ? '(override fornito)' : 
      (user.centro_id ? '(dai dati utente)' : 
      (centro_id ? '(dalla cache locale)' : '(non trovato)'))
    );
    
    if (!centro_id) {
      // Se l'utente è associato a più centri, prova a ottenere l'elenco
      try {
        console.log('Centro ID non trovato nei dati utente, provo a recuperarlo da /users/centri');
        const userCentriResponse = await axios.get(`${API_URL}/users/centri`, { headers });
        const centri = userCentriResponse.data?.centri || [];
        
        console.log('Centri associati all\'utente:', centri);
        
        if (centri.length === 0) {
          throw new Error('Non sei associato a nessun centro. Impossibile effettuare la prenotazione.');
        }
        
        // Usa il primo centro associato all'utente
        centro_id = centri[0].id;
        console.log('Centro ID ottenuto dalla lista centri:', centro_id);
        
        // Salva il centro_id per il futuro
        if (centro_id !== undefined) {
          await saveCentroId(centro_id);
        }
      } catch (err: any) {
        console.error('Errore nel recupero dei centri:', err);
        
        // Se la chiamata users/centri non è disponibile e l'errore è 403/404, 
        // proviamo ad ottenere il centro_id dal contesto dell'applicazione
        if (err.response && (err.response.status === 403 || err.response.status === 404)) {
          console.log('API users/centri non accessibile. Tentativo di prenotazione diretta...');
          
          // Se abbiamo un centro_id salvato in precedenza, utilizziamolo
          const savedCentroId = await getCachedCentroId();
          if (savedCentroId !== null) {
            console.log('Usando centro_id salvato in precedenza:', savedCentroId);
            centro_id = savedCentroId;
          } else {
            // Altrimenti, segnaliamo che è necessario fornire un centro_id manualmente
            console.log('Nessun centro_id trovato, richiesto input manuale');
            return {
              success: false,
              message: 'È necessario specificare manualmente il centro per la prenotazione',
              missingCentroId: true
            };
          }
        } else {
          throw new Error('Impossibile recuperare il centro associato. Verifica la configurazione del tuo account.');
        }
      }
    } else {
      console.log('Centro ID già disponibile:', centro_id);
    }
    
    if (!centro_id) {
      throw new Error('Nessun centro valido associato al tuo account. Contatta l\'amministratore.');
    }
    
    // Assicurati che il centro_id sia un numero 
    const centro_ricevente_id = typeof centro_id === 'string' ? parseInt(centro_id, 10) : centro_id;
    
    // Controlla il formato della data, assicurandoti che sia valida
    if (data_ritiro_prevista) {
      try {
        // Validazione di base della data
        const dataParts = data_ritiro_prevista.split('-');
        if (dataParts.length !== 3 || 
            dataParts[0].length !== 4 || 
            dataParts[1].length !== 2 || 
            dataParts[2].length !== 2) {
          console.error('Formato data non valido. Deve essere YYYY-MM-DD:', data_ritiro_prevista);
          throw new Error('Formato data non valido. Deve essere nel formato YYYY-MM-DD');
        }
      } catch (err) {
        console.error('Errore nella validazione della data:', err);
        throw new Error('Data di ritiro non valida. Utilizza il formato YYYY-MM-DD');
      }
    }
    
    // Assicurati di usare il nome del campo corretto per l'API
    const payload = {
      lotto_id,
      centro_ricevente_id,
      data_ritiro: data_ritiro_prevista,
      note: note || undefined, // Invia undefined invece di null
      percorso: null // Imposta esplicitamente percorso a null per evitare il tentativo di calcolo e salvataggio del trasporto
    };
    
    console.log('Payload per prenotazione:', JSON.stringify(payload));
    
    const response = await axios.post(`${API_URL}/prenotazioni`, payload, {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('Risposta prenotazione:', JSON.stringify(response.data));
    
    // Invalida la cache
    prenotazioniCache.timestamp = 0;
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione effettuata con successo',
      prenotazione: response.data.prenotazione
    };
  } catch (error: any) {
    console.error('Errore nella prenotazione del lotto:', error);
    
    // Log dettagliato per error 403
    if (error.response && error.response.status === 403) {
      console.error('Error 403 - Forbidden. Dettagli risposta:', error.response.data);
      
      // Verifica se si tratta di un errore di permessi
      if (error.response.data && (
          error.response.data.message?.includes('permessi') || 
          error.response.data.message?.includes('autorizzato') ||
          error.response.data.message?.includes('ruolo')
      )) {
        // Recupera i dati utente per diagnosticare
        try {
          const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
          const user = userData ? JSON.parse(userData) : null;
          console.error('Dati utente durante errore 403:', user ? 
            `ID: ${user.id}, Ruolo: ${user.ruolo}, Centro: ${user.centro_id}` : 
            'Nessun dato utente trovato');
        } catch (e) {
          console.error('Errore nel recupero dati utente per diagnostica:', e);
        }
        
        return {
          success: false,
          message: error.response.data.message || 'Non hai i permessi necessari per prenotare questo lotto',
          error: error.response.data,
          missingCentroId: true  // Flag per indicare che potrebbe mancare il centro_id
        };
      } else {
        // Potrebbe essere un problema con il centro_id
        return {
          success: false,
          message: 'Errore di autorizzazione. Assicurati di essere associato ad un centro valido.',
          error: error.response.data,
          missingCentroId: true
        };
      }
    }
    
    // Se l'errore proviene dalla risposta, mostra il messaggio
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Errore nella prenotazione del lotto',
        error: error.response.data
      };
    }
    
    // Altrimenti mostra un messaggio generico
    return {
      success: false,
      message: error.message || 'Errore nella prenotazione del lotto',
      error
    };
  }
};

// Funzione per ottenere le prenotazioni
export const getPrenotazioni = async (filtri?: PrenotazioneFiltri, forceRefresh = false) => {
  try {
    console.log('Richiesta prenotazioni con filtri:', filtri ? JSON.stringify(filtri) : 'nessun filtro');
    
    // Verifica se possiamo usare la cache
    const now = Date.now();
    const cacheAge = now - prenotazioniCache.timestamp;
    const filtriEqual = JSON.stringify(filtri) === JSON.stringify(prenotazioniCache.filtri);
    
    if (!forceRefresh && prenotazioniCache.data && filtriEqual && cacheAge < DATA_FRESHNESS_THRESHOLD) {
      console.log('Usando prenotazioni dalla cache locale (età cache:', Math.round(cacheAge/1000), 'secondi)');
      return prenotazioniCache.data;
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
    
    console.log(`Richiesta GET ${API_URL}/prenotazioni${queryParams}`);
    
    const response = await axios.get(`${API_URL}/prenotazioni${queryParams}`, { 
      headers,
      timeout: 15000
    });
    
    console.log('Risposta del server:', JSON.stringify(response.data));
    
    // Estrazione e normalizzazione dei dati
    const prenotazioniData = response.data.data || response.data.prenotazioni || [];
    
    // Trasforma i dati delle prenotazioni per assicurare che abbiano la struttura corretta
    const prenotazioniProcessate = prenotazioniData.map((pren: any) => {
      // Crea oggetto lotto se abbiamo i dati del prodotto
      let lotto = undefined;
      if (pren.prodotto) {
        lotto = {
          id: pren.lotto_id,
          nome: pren.prodotto,
          quantita: pren.quantita,
          unita_misura: pren.unita_misura,
          data_scadenza: pren.data_scadenza,
          centro_nome: pren.centro_origine_nome
        };
      }
      
      // Assicurati che tutti i campi necessari siano presenti
      return {
        ...pren,
        lotto: pren.lotto || lotto, // Usa i dati del lotto se presenti, altrimenti usa quelli che abbiamo creato
        centro_nome: pren.centro_nome || pren.centro_ricevente_nome // Usa il nome del centro se presente
      };
    });
    
    // Formattazione della risposta
    const result = {
      prenotazioni: prenotazioniProcessate,
      pagination: response.data.pagination || null
    };
    
    console.log(`Ricevute e processate ${prenotazioniProcessate.length} prenotazioni`);
    
    // Aggiorna la cache
    prenotazioniCache = {
      data: result,
      timestamp: now,
      filtri: filtri || null
    };
    
    return result;
  } catch (error: any) {
    console.error('Errore nel recupero delle prenotazioni:', error);
    
    // Gestione specifica errori
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
      throw new Error('Timeout durante il caricamento delle prenotazioni. Verifica la connessione al server.');
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

// Funzione per ottenere una prenotazione per ID
export const getPrenotazioneById = async (id: number) => {
  try {
    console.log(`Richiesta dettagli prenotazione ${id} in corso...`);
    
    const headers = await getAuthHeader();
    const response = await axios.get(`${API_URL}/prenotazioni/${id}`, { 
      headers,
      timeout: 10000
    });
    
    console.log(`Dettagli prenotazione ${id} ricevuti:`, JSON.stringify(response.data));
    
    return response.data;
  } catch (error: any) {
    console.error(`Errore nel recupero della prenotazione ${id}:`, error);
    
    if (error.response?.status === 404) {
      throw new Error(`Prenotazione ${id} non trovata.`);
    } else if (error.response?.status === 401) {
      throw new Error('Sessione scaduta. Effettua nuovamente il login.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error(`Timeout durante il caricamento della prenotazione. Verifica la connessione al server.`);
    }
    
    throw error;
  }
};

// Funzione per annullare una prenotazione
export const annullaPrenotazione = async (id: number, motivo: string = '') => {
  try {
    console.log(`Annullamento prenotazione ${id} in corso...`);
    
    const headers = await getAuthHeader();
    
    const payload = {
      motivo
    };
    
    const response = await axios.post(`${API_URL}/prenotazioni/${id}/annulla`, payload, {
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log(`Risposta annullamento prenotazione ${id}:`, JSON.stringify(response.data));
    
    // Invalida la cache
    prenotazioniCache.timestamp = 0;
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione annullata con successo',
      prenotazione: response.data.prenotazione
    };
  } catch (error: any) {
    console.error(`Errore nell'annullamento della prenotazione ${id}:`, error);
    
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Errore nell\'annullamento della prenotazione',
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: error.message || 'Errore nell\'annullamento della prenotazione',
      error
    };
  }
};

// Funzione per confermare una prenotazione (per gli operatori)
export const confermaPrenotazione = async (id: number, data_ritiro_prevista: string | null = null) => {
  try {
    console.log(`Conferma prenotazione ${id} in corso...`);
    
    const headers = await getAuthHeader();
    
    const payload = {
      data_ritiro_prevista
    };
    
    const response = await axios.post(`${API_URL}/prenotazioni/${id}/conferma`, payload, {
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log(`Risposta conferma prenotazione ${id}:`, JSON.stringify(response.data));
    
    // Invalida la cache
    prenotazioniCache.timestamp = 0;
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione confermata con successo',
      prenotazione: response.data.prenotazione
    };
  } catch (error: any) {
    console.error(`Errore nella conferma della prenotazione ${id}:`, error);
    
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Errore nella conferma della prenotazione',
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: error.message || 'Errore nella conferma della prenotazione',
      error
    };
  }
};

// Funzione per completare una prenotazione (ritiro effettuato)
export const completaPrenotazione = async (id: number, note: string = '') => {
  try {
    console.log(`Completamento prenotazione ${id} in corso...`);
    
    const headers = await getAuthHeader();
    
    const payload = {
      note
    };
    
    const response = await axios.post(`${API_URL}/prenotazioni/${id}/completa`, payload, {
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log(`Risposta completamento prenotazione ${id}:`, JSON.stringify(response.data));
    
    // Invalida la cache
    prenotazioniCache.timestamp = 0;
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione completata con successo',
      prenotazione: response.data.prenotazione
    };
  } catch (error: any) {
    console.error(`Errore nel completamento della prenotazione ${id}:`, error);
    
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Errore nel completamento della prenotazione',
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: error.message || 'Errore nel completamento della prenotazione',
      error
    };
  }
};

export default {
  prenotaLotto,
  getPrenotazioni,
  getPrenotazioneById,
  annullaPrenotazione,
  confermaPrenotazione,
  completaPrenotazione
}; 