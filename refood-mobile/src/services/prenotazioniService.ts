import axios from 'axios';
import { API_URL } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';
import { Lotto } from './lottiService';
import notificheService from './notificheService';

// Chiave per memorizzare il centro_id nella cache locale
const CENTRO_ID_STORAGE_KEY = 'user_centro_id';

// Interfaccia per le prenotazioni
export interface Prenotazione {
  id: number;
  lotto_id: number;
  centro_ricevente_id: number;
  centro_id?: number; // Mantenuto per retrocompatibilità
  data_prenotazione: string;
  data_ritiro_prevista: string | null;
  data_ritiro_effettiva: string | null;
  stato: 'Prenotato' | 'InAttesa' | 'Confermato' | 'Rifiutato' | 'InTransito' | 'Consegnato' | 'Annullato' | 'Eliminato';
  note: string | null;
  created_at: string;
  updated_at: string;
  // Dati relazionati
  lotto?: Lotto;
  centro_nome?: string;
  // Campi che possono arrivare "appiattiti" direttamente nella risposta dell'API
  prodotto?: string;
  quantita?: number;
  unita_misura?: string;
  data_scadenza?: string;
  centro_origine_nome?: string;
  centro_ricevente_nome?: string;
  data_ritiro?: string;
  data_consegna?: string;
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

// Funzione per invalidare la cache
export const invalidateCache = () => {
  prenotazioniCache.timestamp = 0;
  prenotazioniCache.data = null;
  prenotazioniCache.filtri = null;
  console.log('Cache delle prenotazioni invalidata');
};

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
    invalidateCache();
    
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

// Funzione per ottenere l'elenco delle prenotazioni
export const getPrenotazioni = async (filtri: PrenotazioneFiltri = {}, forceRefresh = false) => {
  try {
    console.log('=== INIZIO RICHIESTA getPrenotazioni ===');
    console.log('Filtri richiesti:', JSON.stringify(filtri, null, 2));
    
    // Ottieni le credenziali di autenticazione
    const headers = await getAuthHeader();
    console.log('Headers di autenticazione ottenuti');
    
    // Costruisci i parametri di query
    const params: any = {};
    
    if (filtri.stato) {
      params.stato = filtri.stato;
      console.log(`Applicando filtro stato: ${filtri.stato}`);
    }
    
    if (filtri.data_inizio) {
      params.data_inizio = filtri.data_inizio;
      console.log(`Applicando filtro data_inizio: ${filtri.data_inizio}`);
    }
    
    if (filtri.data_fine) {
      params.data_fine = filtri.data_fine;
      console.log(`Applicando filtro data_fine: ${filtri.data_fine}`);
    }
    
    if (filtri.centro_id) {
      params.centro_id = filtri.centro_id;
      console.log(`Applicando filtro centro_id: ${filtri.centro_id}`);
    }
    
    console.log(`API request: GET ${API_URL}/prenotazioni con params:`, params);
    
    // Effettua la richiesta API con timeout di 30 secondi
    console.log('Invio richiesta al server...');
    const startTime = Date.now();
    
    const response = await axios.get(`${API_URL}/prenotazioni`, { 
      headers,
      params,
      timeout: 30000 // Manteniamo il timeout di 30 secondi
    });
    
    const endTime = Date.now();
    console.log(`Risposta ricevuta in ${endTime - startTime}ms con status ${response.status}`);
    
    // Trasforma i dati per includere informazioni aggiuntive
    let prenotazioni = response.data.data || response.data.prenotazioni || [];
    
    console.log(`Ricevute ${prenotazioni.length} prenotazioni dal server`);
    console.log(`Dati di risposta: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`); // Tronca per non avere log troppo lunghi
    
    // Assicuriamoci che non ci siano prenotazioni duplicate con lo stesso ID
    // Se ci sono duplicati, manteniamo solo la versione più recente
    if (prenotazioni.length > 0) {
      console.log('Controllo duplicati nelle prenotazioni...');
      const prenotazioniMap = new Map();
      
      // Ordiniamo prima per data di aggiornamento (più recente prima)
      prenotazioni.sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.data_prenotazione);
        const dateB = new Date(b.updated_at || b.data_prenotazione);
        return dateB.getTime() - dateA.getTime();
      });
      
      // Poi inseriamo nella mappa solo la prima occorrenza di ogni ID
      for (const prenotazione of prenotazioni) {
        if (!prenotazioniMap.has(prenotazione.id)) {
          prenotazioniMap.set(prenotazione.id, prenotazione);
        } else {
          console.warn(`Trovata prenotazione duplicata con ID ${prenotazione.id}, stato: ${prenotazione.stato}. Mantengo solo la versione più recente.`);
        }
      }
      
      // Convertiamo la mappa in array
      prenotazioni = Array.from(prenotazioniMap.values());
      console.log(`Dopo rimozione duplicati per ID: ${prenotazioni.length} prenotazioni`);
      
      // NUOVA LOGICA: Controlla anche duplicati basati su lotto_id
      // In alcuni casi, potremmo avere più prenotazioni per lo stesso lotto,
      // che non dovrebbe essere possibile logicamente
      console.log('Controllo duplicati di prenotazioni per lo stesso lotto...');
      const prenotazioniPerLotto = new Map();
      
      for (const prenotazione of prenotazioni) {
        // Ignora le prenotazioni senza lotto_id
        if (!prenotazione.lotto_id) continue;
        
        if (!prenotazioniPerLotto.has(prenotazione.lotto_id)) {
          prenotazioniPerLotto.set(prenotazione.lotto_id, prenotazione);
        } else {
          const prenotazioneEsistente = prenotazioniPerLotto.get(prenotazione.lotto_id);
          const dateA = new Date(prenotazione.updated_at || prenotazione.data_prenotazione);
          const dateB = new Date(prenotazioneEsistente.updated_at || prenotazioneEsistente.data_prenotazione);
          
          console.warn(`Trovata prenotazione duplicata per lotto ID ${prenotazione.lotto_id}:`);
          console.warn(`  - Prenotazione1: ID=${prenotazioneEsistente.id}, Stato=${prenotazioneEsistente.stato}, Data=${dateB.toISOString()}`);
          console.warn(`  - Prenotazione2: ID=${prenotazione.id}, Stato=${prenotazione.stato}, Data=${dateA.toISOString()}`);
          
          // Tieni la prenotazione più recente
          if (dateA.getTime() > dateB.getTime()) {
            console.warn(`  Mantengo la prenotazione più recente (ID=${prenotazione.id}, Stato=${prenotazione.stato})`);
            prenotazioniPerLotto.set(prenotazione.lotto_id, prenotazione);
          } else {
            console.warn(`  Mantengo la prenotazione più recente (ID=${prenotazioneEsistente.id}, Stato=${prenotazioneEsistente.stato})`);
          }
        }
      }
      
      // Verifica se sono stati trovati duplicati
      if (prenotazioniPerLotto.size < prenotazioni.length) {
        console.warn(`Trovate ${prenotazioni.length - prenotazioniPerLotto.size} prenotazioni duplicate per lotto_id`);
        prenotazioni = Array.from(prenotazioniPerLotto.values());
        console.log(`Dopo rimozione duplicati per lotto_id: ${prenotazioni.length} prenotazioni`);
      } else {
        console.log('Nessun duplicato trovato per lotto_id');
      }
    }
    
    if (prenotazioni.length === 0) {
      console.log('Nessuna prenotazione trovata con i filtri specificati');
    } else {
      console.log(`Prima prenotazione ricevuta: ID=${prenotazioni[0].id}, Stato=${prenotazioni[0].stato}`);
    }
    
    // Aggiungi dati del lotto se disponibili
    if (response.data.lotti && response.data.centri) {
      console.log(`Arricchimento prenotazioni con ${response.data.lotti.length} lotti e ${response.data.centri.length} centri`);
      
      // Crea una mappa di ricerca rapida per lotti e centri
      const lottiMap = response.data.lotti.reduce((map: Record<number, any>, lotto: any) => {
        map[lotto.id] = lotto;
        return map;
      }, {});
      
      const centriMap = response.data.centri.reduce((map: Record<number, any>, centro: any) => {
        map[centro.id] = centro;
        return map;
      }, {});
      
      // Arricchisci le prenotazioni con i dati relazionati
      prenotazioni = prenotazioni.map((prenotazione: any) => {
        const lotto = lottiMap[prenotazione.lotto_id];
        const centro = centriMap[prenotazione.centro_ricevente_id];
        
        return {
          ...prenotazione,
          lotto: lotto || undefined,
          centro_nome: centro ? centro.nome : undefined
        };
      });
      
      console.log('Prenotazioni arricchite con successo');
    } else {
      console.log('Dati di lotti e centri non disponibili nella risposta');
    }
    
    // Prepara il risultato finale con conteggi dalla risposta se disponibili
    const result = {
      prenotazioni,
      total: response.data.pagination?.total || response.data.total || prenotazioni.length,
      page: response.data.pagination?.page || response.data.page || 1,
      pages: response.data.pagination?.pages || response.data.pages || 1
    };
    
    console.log(`Preparato risultato finale con ${prenotazioni.length} prenotazioni`);
    console.log('=== FINE RICHIESTA getPrenotazioni ===');
    
    return result;
  } catch (error: any) {
    console.error('=== ERRORE IN getPrenotazioni ===');
    console.error('Errore completo:', error);
    
    // Log dettagliato dell'errore
    if (error.response) {
      // La richiesta è stata fatta e il server ha risposto con un codice di stato che non è 2xx
      console.error('Errore di risposta dal server:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data));
      console.error('Headers:', JSON.stringify(error.response.headers));
    } else if (error.request) {
      // La richiesta è stata fatta ma non è stata ricevuta alcuna risposta
      console.error('Nessuna risposta ricevuta dal server');
      console.error('Request:', error.request);
    } else {
      // Qualcosa è andato storto nella configurazione della richiesta
      console.error('Errore nella configurazione della richiesta:', error.message);
    }
    
    // Gestione specifica per vari tipi di errori
    if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout durante il caricamento delle prenotazioni. Verifica la connessione al server.');
    } else if (error.response) {
      // Il server ha risposto con un errore
      console.error('Risposta di errore dal server:', error.response.status);
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

/**
 * Annulla una prenotazione.
 * @param id ID della prenotazione
 * @param motivo Motivo dell'annullamento
 * @returns Risultato dell'operazione
 */
export const annullaPrenotazione = async (id: number, motivo: string = '') => {
  try {
    const headers = await getAuthHeader();
    
    // Effettua una richiesta PUT per annullare la prenotazione
    const response = await axios.put(
      `${API_URL}/prenotazioni/${id}/annulla`, 
      { motivo },
      { headers }
    );
    
    // Invalida la cache
    invalidateCache();
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione annullata con successo',
      prenotazione: response.data.prenotazione
    };
  } catch (error) {
    console.error('Errore durante l\'annullamento della prenotazione:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        message: error.response.data.message || 'Errore durante l\'annullamento della prenotazione',
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: 'Errore di rete durante l\'annullamento della prenotazione',
      error
    };
  }
};

/**
 * Accetta una prenotazione.
 * @param id ID della prenotazione
 * @param data_ritiro_prevista Data prevista per il ritiro
 * @returns Risultato dell'operazione
 */
export const accettaPrenotazione = async (id: number, data_ritiro_prevista: string | null = null): Promise<any> => {
  try {
    const headers = await getAuthHeader();
    
    const response = await axios.put(
      `${API_URL}/prenotazioni/${id}/accetta`, 
      { data_ritiro_prevista },
      { headers }
    );
    
    // Invalida la cache
    invalidateCache();
    
    if (response.data.prenotazione) {
      // Prepara un messaggio per la notifica
      const prenotazione = response.data.prenotazione;
      
      // Aggiunge una notifica per gli amministratori
      if (prenotazione.lotto && notificheService) {
        const dataRitiro = data_ritiro_prevista 
          ? new Date(data_ritiro_prevista).toLocaleDateString() 
          : 'non specificata';
          
        await notificheService.addNotificaToAmministratori(
          prenotazione.centro_id,
          'Prenotazione confermata',
          `La prenotazione del lotto "${prenotazione.lotto.nome}" è stata confermata. Data di ritiro prevista: ${dataRitiro}.`
        );
      }
    }
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione confermata con successo',
      prenotazione: response.data.prenotazione
    };
  } catch (error) {
    console.error('Errore durante l\'accettazione della prenotazione:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        message: error.response.data.message || 'Errore durante l\'accettazione della prenotazione',
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: 'Errore di rete durante l\'accettazione della prenotazione',
      error
    };
  }
};

/**
 * Rifiuta una prenotazione.
 * @param id ID della prenotazione
 * @param motivo Motivo del rifiuto
 * @returns Risultato dell'operazione
 */
export const rifiutaPrenotazione = async (id: number, motivo: string = ''): Promise<any> => {
  try {
    const headers = await getAuthHeader();
    
    const response = await axios.put(
      `${API_URL}/prenotazioni/${id}/rifiuta`, 
      { motivo },
      { headers }
    );
    
    // Invalida la cache
    invalidateCache();
    
    if (response.data.prenotazione && notificheService) {
      // Prepara un messaggio per la notifica
      const prenotazione = response.data.prenotazione;
      
      // Aggiunge una notifica per gli amministratori
      if (prenotazione.lotto) {
        const motivoText = motivo ? ` Motivo: "${motivo}"` : '';
        
        await notificheService.addNotificaToAmministratori(
          prenotazione.centro_id,
          'Prenotazione rifiutata',
          `La prenotazione del lotto "${prenotazione.lotto.nome}" è stata rifiutata.${motivoText}`
        );
      }
    }
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione rifiutata con successo',
      prenotazione: response.data.prenotazione
    };
  } catch (error) {
    console.error('Errore durante il rifiuto della prenotazione:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        message: error.response.data.message || 'Errore durante il rifiuto della prenotazione',
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: 'Errore di rete durante il rifiuto della prenotazione',
      error
    };
  }
};

/**
 * Elimina una prenotazione (solo per amministratori).
 * @param id ID della prenotazione
 * @returns Risultato dell'operazione
 */
export const eliminaPrenotazione = async (id: number): Promise<any> => {
  try {
    const headers = await getAuthHeader();
    
    // Prima di eliminare, ottieni i dettagli per le notifiche
    let dettagliPrenotazione: Prenotazione | null = null;
    try {
      const dettagli = await getPrenotazioneById(id);
      if (dettagli.prenotazione) {
        dettagliPrenotazione = dettagli.prenotazione;
      }
    } catch (err) {
      console.error('Impossibile ottenere dettagli prenotazione prima dell\'eliminazione:', err);
    }
    
    const response = await axios.delete(
      `${API_URL}/prenotazioni/${id}`, 
      { headers }
    );
    
    // Invalida la cache
    invalidateCache();
    
    if (dettagliPrenotazione && notificheService) {
      // Se abbiamo i dettagli, invia notifiche
      if (dettagliPrenotazione.lotto) {
        // Notifica al centro di origine
        if (dettagliPrenotazione.lotto.centro_id) {
          await notificheService.addNotificaToAmministratori(
            dettagliPrenotazione.lotto.centro_id,
            'Prenotazione eliminata',
            `La prenotazione del lotto "${dettagliPrenotazione.lotto.nome}" è stata eliminata da un amministratore.`
          );
        }
        
        // Notifica al centro ricevente
        if (dettagliPrenotazione.centro_id) {
          await notificheService.addNotificaToAmministratori(
            dettagliPrenotazione.centro_id,
            'Prenotazione eliminata',
            `La prenotazione che avevi effettuato per il lotto "${dettagliPrenotazione.lotto.nome}" è stata eliminata da un amministratore.`
          );
        }
      }
    }
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione eliminata con successo'
    };
  } catch (error) {
    console.error('Errore durante l\'eliminazione della prenotazione:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      return {
        success: false,
        message: error.response.data.message || 'Errore durante l\'eliminazione della prenotazione',
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: 'Errore di rete durante l\'eliminazione della prenotazione',
      error
    };
  }
};

export default {
  prenotaLotto,
  getPrenotazioni,
  getPrenotazioneById,
  annullaPrenotazione,
  accettaPrenotazione,
  rifiutaPrenotazione,
  eliminaPrenotazione
}; 