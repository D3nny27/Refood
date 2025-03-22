import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, STORAGE_KEYS } from '../config/constants';
import { Notifica, NotificheResponse, NotificaFiltri } from '../types/notification';
import { getAuthToken } from './authService';
import logger from '../utils/logger';

/**
 * Servizio per la gestione delle notifiche
 */
class NotificheService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private pollingDelay = 30000; // 30 secondi
  private lastCountFetchTime: number = 0;
  private cachedNonLetteCount: number = 0;

  /**
   * Recupera le notifiche dal server
   * @param page Numero di pagina
   * @param limit Limite di notifiche per pagina
   * @param filtri Filtri opzionali
   */
  async getNotifiche(page = 1, limit = 20, filtri?: NotificaFiltri): Promise<NotificheResponse> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      if (!token) {
        throw new Error('Token non disponibile');
      }

      // Costruisci parametri di query in base ai filtri
      let params: Record<string, any> = { page, limit };
      
      if (filtri) {
        if (filtri.tipo) params.tipo = filtri.tipo;
        if (filtri.letta !== undefined) params.letta = filtri.letta;
        if (filtri.priorita) params.priorita = filtri.priorita;
        if (filtri.dataInizio) params.dataInizio = filtri.dataInizio;
        if (filtri.dataFine) params.dataFine = filtri.dataFine;
      }
      
      const response = await axios.get(`${API_URL}/notifiche`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params
      });
      
      return response.data;
    } catch (error) {
      console.error('Errore durante il recupero delle notifiche:', error);
      throw error;
    }
  }

  /**
   * Recupera il conteggio delle notifiche non lette
   */
  async getNotificheNonLette(): Promise<number> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      if (!token) {
        logger.warn('Token non disponibile per il conteggio notifiche');
        return 0;
      }
      
      // Utilizziamo un approccio con memorizzazione in cache per evitare troppe chiamate
      const now = Date.now();
      const timeSinceLastFetch = now - this.lastCountFetchTime;
      const CACHE_THRESHOLD = 30000; // 30 secondi
      
      // Se abbiamo un conteggio recente, lo restituiamo direttamente
      if (this.lastCountFetchTime > 0 && timeSinceLastFetch < CACHE_THRESHOLD) {
        return this.cachedNonLetteCount;
      }
      
      try {
        // Prima prova l'endpoint specifico per il conteggio
        const response = await axios.get(`${API_URL}/notifiche/conteggio`, {
          headers: { 'Authorization': `Bearer ${token}` },
          params: { letta: false },
          timeout: 5000 // Timeout più breve per evitare blocchi
        });
        
        this.lastCountFetchTime = now;
        this.cachedNonLetteCount = response.data.totale || 0;
        return this.cachedNonLetteCount;
      } catch (apiError: any) {
        // Se l'endpoint non esiste (404), prova a contare manualmente
        if (apiError.response && apiError.response.status === 404) {
          logger.warn('Endpoint conteggio non disponibile, calcolo manuale');
          
          // In sviluppo, per evitare chiamate eccessive, simula un conteggio fisso
          if (__DEV__) {
            logger.log('In sviluppo, restituzione di conteggio simulato');
            this.lastCountFetchTime = now;
            this.cachedNonLetteCount = 0;
            return 0;
          }
          
          // In produzione, recupera tutte le notifiche e conta quelle non lette
          const allNotifiche = await this.getNotifiche(1, 100, { letta: false });
          this.lastCountFetchTime = now;
          this.cachedNonLetteCount = allNotifiche.data.length || 0;
          return this.cachedNonLetteCount;
        }
        
        // Se è un altro errore, lo propaga
        throw apiError;
      }
    } catch (error) {
      logger.error('Errore durante il recupero del conteggio notifiche:', error);
      // In caso di errore, restituisci 0 per evitare interruzioni nell'UI
      return 0;
    }
  }

  /**
   * Segna una notifica come letta
   */
  async segnaComeLetta(id: number): Promise<void> {
    try {
      const authToken = await getAuthToken();
      
      if (!authToken) {
        throw new Error('Utente non autenticato');
      }
      
      const response = await axios.put(
        `${API_URL}/notifiche/${id}/letta`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      
      if (response.status !== 200) {
        throw new Error('Errore nella marcatura della notifica come letta');
      }
    } catch (error) {
      console.error(`Errore nel segnare come letta la notifica ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Segna tutte le notifiche come lette
   */
  async segnaTutteComeLette(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      if (!token) {
        throw new Error('Token non disponibile');
      }
      
      await axios.post(`${API_URL}/notifiche/segna-tutte-lette`, 
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      return true;
    } catch (error) {
      console.error('Errore durante l\'aggiornamento di tutte le notifiche:', error);
      return false;
    }
  }

  /**
   * Elimina una notifica
   * @param notificaId ID della notifica da eliminare
   */
  async eliminaNotifica(notificaId: number): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      if (!token) {
        throw new Error('Token non disponibile');
      }
      
      await axios.delete(`${API_URL}/notifiche/${notificaId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      return true;
    } catch (error) {
      console.error(`Errore durante l'eliminazione della notifica ${notificaId}:`, error);
      return false;
    }
  }

  /**
   * Avvia il polling delle notifiche
   * @param callback Funzione da chiamare quando vengono ricevute nuove notifiche
   */
  avviaPollingNotifiche(callback: (count: number) => void): void {
    // Interrompi qualsiasi polling esistente
    this.interrompiPollingNotifiche();
    
    // Esegui immediatamente una prima volta
    this.getNotificheNonLette()
      .then(count => callback(count))
      .catch(err => console.error('Errore nel polling delle notifiche:', err));
    
    // Avvia il polling periodico
    this.pollingInterval = setInterval(async () => {
      try {
        const count = await this.getNotificheNonLette();
        callback(count);
      } catch (error) {
        console.error('Errore nel polling delle notifiche:', error);
      }
    }, this.pollingDelay);
  }

  /**
   * Interrompe il polling delle notifiche
   */
  interrompiPollingNotifiche(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Recupera i dettagli di una notifica specifica
   * @param notificaId ID della notifica
   */
  async getDettaglioNotifica(notificaId: number): Promise<Notifica> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      if (!token) {
        throw new Error('Token non disponibile');
      }
      
      try {
        const response = await axios.get(`${API_URL}/notifiche/${notificaId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        return response.data;
      } catch (apiError: any) {
        // Gestisci errori specifici dell'API
        if (apiError.response) {
          // Se la notifica non esiste (404)
          if (apiError.response.status === 404) {
            logger.warn(`Notifica ID ${notificaId} non trovata`);
            throw new Error('Notifica non trovata');
          }
          
          // Se il server risponde con un errore (500, ecc.)
          if (apiError.response.status >= 500) {
            logger.error(`Errore del server nel recupero della notifica ${notificaId}: ${apiError.response.status}`);
            throw new Error('Il server ha riscontrato un errore. Riprova più tardi.');
          }
        }
        
        // Per errori di timeout o di rete
        if (apiError.code === 'ECONNABORTED' || !apiError.response) {
          logger.error(`Errore di connessione nel recupero della notifica ${notificaId}`);
          throw new Error('Impossibile comunicare con il server. Verifica la tua connessione.');
        }
        
        // Propaga l'errore originale se non è stato gestito sopra
        throw apiError;
      }
    } catch (error) {
      logger.error(`Errore durante il recupero della notifica ${notificaId}:`, error);
      throw error;
    }
  }

  /**
   * Ottiene una notifica specifica per ID
   * @param id ID della notifica da recuperare
   */
  async getNotifica(id: number): Promise<Notifica> {
    // Verifica che l'ID sia valido
    if (!id || isNaN(id)) {
      logger.error(`Tentativo di recuperare notifica con ID non valido: ${id}`);
      throw new Error('ID notifica non valido');
    }
    
    try {
      const authToken = await getAuthToken();
      
      if (!authToken) {
        logger.error('Token di autenticazione non disponibile per recuperare la notifica');
        throw new Error('Utente non autenticato');
      }
      
      logger.log(`Recupero notifica ID ${id} dal server`);
      
      try {
        const response = await axios.get(`${API_URL}/notifiche/${id}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        
        if (response.status === 200) {
          return response.data;
        } else {
          throw new Error(`Errore nel recupero della notifica: ${response.status}`);
        }
      } catch (apiError: any) {
        // Gestisci errori specifici dell'API
        if (apiError.response) {
          // Se la notifica non esiste (404)
          if (apiError.response.status === 404) {
            logger.warn(`Notifica ID ${id} non trovata sul server`);
            throw new Error('Notifica non trovata');
          }
          
          // Se c'è un problema di autenticazione (401)
          if (apiError.response.status === 401) {
            logger.error('Token di autenticazione scaduto o non valido');
            throw new Error('Utente non autenticato');
          }
        }
        
        // Rilancia l'errore originale per altri tipi di errori
        throw apiError;
      }
    } catch (error) {
      logger.error(`Errore nel recupero della notifica ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Ottiene il conteggio delle notifiche non lette
   */
  async getConteggio(): Promise<number> {
    try {
      const authToken = await getAuthToken();
      
      if (!authToken) {
        throw new Error('Utente non autenticato');
      }
      
      const response = await axios.get(`${API_URL}/notifiche/conteggio-non-lette`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      
      if (response.status === 200) {
        return response.data.count;
      } else {
        throw new Error('Errore nel recupero del conteggio notifiche');
      }
    } catch (error) {
      console.error('Errore nel recupero del conteggio notifiche non lette:', error);
      throw error;
    }
  }

  /**
   * Configura una richiesta API con autorizzazione e timeout
   * @param endpoint Endpoint dell'API
   * @param params Parametri opzionali
   */
  private async configuraRichiesta(endpoint: string, params: Record<string, any> = {}) {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    
    if (!token) {
      throw new Error('Token non disponibile');
    }
    
    return {
      url: `${API_URL}${endpoint}`,
      headers: { 'Authorization': `Bearer ${token}` },
      params,
      timeout: 10000, // 10 secondi timeout
    };
  }

  /**
   * Esegue una richiesta GET resiliente con gestione errori
   * @param endpoint Endpoint dell'API
   * @param params Parametri opzionali
   * @param defaultValue Valore predefinito in caso di errore
   */
  private async getResilient<T>(endpoint: string, params: Record<string, any> = {}, defaultValue?: T): Promise<T> {
    try {
      const config = await this.configuraRichiesta(endpoint, params);
      const response = await axios.get(config.url, { 
        headers: config.headers, 
        params: config.params,
        timeout: config.timeout
      });
      
      return response.data;
    } catch (error: any) {
      // Logging dettagliato dell'errore
      logger.error(`Errore nella richiesta GET a ${endpoint}:`, error);
      
      // Se è stato specificato un valore predefinito, restituiscilo invece di propagare l'errore
      if (defaultValue !== undefined) {
        logger.warn(`Restituisco valore predefinito per ${endpoint}`);
        return defaultValue;
      }
      
      throw error;
    }
  }
}

// Crea e esporta una singola istanza del servizio
export const notificheService = new NotificheService();
export default notificheService; 