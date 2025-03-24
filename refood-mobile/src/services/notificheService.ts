import api from './api';
import { Notifica, NotificaFiltri, NotificheResponse } from '../types/notification';
import { API_URL, API_TIMEOUT } from '../config/constants';
import axios, { AxiosError } from 'axios';
import logger from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';
import { Platform } from 'react-native';
import { API_CONFIG } from '../config/config';
import Toast from 'react-native-toast-message';
import { emitEvent, APP_EVENTS } from '../utils/events';

// Adattamento del tipo di paginazione per supportare il nuovo formato
interface PaginationData {
  total: number;
  currentPage?: number;
  totalPages?: number;
  // Supporto per il formato vecchio
  page?: number;
  limit?: number;
  pages?: number;
}

// Interfaccia aggiornata per la risposta delle notifiche
interface ApiNotificheResponse {
  data: Notifica[];
  pagination: PaginationData;
}

// Chiave per salvare le notifiche locali in AsyncStorage
const LOCAL_NOTIFICATIONS_STORAGE_KEY = STORAGE_KEYS.LOCAL_NOTIFICATIONS || 'refood-local-notifications';

/**
 * Servizio per la gestione delle notifiche
 */
class NotificheService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private pollingDelay = 30000; // 30 secondi di default
  private lastCountFetchTime: number = 0;
  private cachedNonLetteCount: number = 0;
  private lastFetchedNotifiche: { timestamp: number, data: Notifica[] } = { timestamp: 0, data: [] };
  private isPolling: boolean = false;
  private CACHE_DURATION = 60000; // 1 minuto di cache per il conteggio
  private localNotificaCounter = -10000; // Contatore per ID negativi per notifiche locali
  private isSyncing: boolean = false; // Nuovo flag per tenere traccia della sincronizzazione

  constructor() {
    // Imposta un intervallo più breve per il polling in sviluppo
    if (__DEV__) {
      this.pollingDelay = 15000; // 15 secondi in sviluppo
    }
    logger.log(`NotificheService inizializzato con polling ogni ${this.pollingDelay/1000} secondi`);
    
    // Carica le notifiche locali salvate in AsyncStorage
    this.loadLocalNotifications();
  }
  
  /**
   * Carica le notifiche locali da AsyncStorage
   */
  private async loadLocalNotifications(): Promise<void> {
    try {
      const savedNotificationsString = await AsyncStorage.getItem(LOCAL_NOTIFICATIONS_STORAGE_KEY);
      
      if (savedNotificationsString) {
        const savedNotifications = JSON.parse(savedNotificationsString) as Notifica[];
        
        // Aggiorna il contatore locale per generare nuovi ID
        if (savedNotifications.length > 0) {
          // Trova l'ID più basso (ricorda che sono negativi)
          const lowestId = savedNotifications.reduce((min, notifica) => 
            notifica.id < min ? notifica.id : min, 0);
          
          if (lowestId < 0) {
            // Imposta il contatore a un valore più basso per evitare conflitti
            this.localNotificaCounter = lowestId - 1;
          }
          
          // Aggiungi le notifiche salvate all'array delle notifiche
          logger.log(`Caricando ${savedNotifications.length} notifiche locali da AsyncStorage`);
          
          // Inizializza l'array se necessario
          if (!this.lastFetchedNotifiche.data) {
            this.lastFetchedNotifiche.data = [];
          }
          
          // Aggiungi le notifiche salvate alla cache
          this.lastFetchedNotifiche.data = [...savedNotifications, ...this.lastFetchedNotifiche.data];
          
          // Aggiorna il conteggio delle notifiche non lette
          const nonLetteCount = savedNotifications.filter(n => !n.letta).length;
          this.cachedNonLetteCount += nonLetteCount;
          
          logger.log(`Caricate ${savedNotifications.length} notifiche locali (${nonLetteCount} non lette)`);
        }
      } else {
        logger.log('Nessuna notifica locale salvata in AsyncStorage');
      }
    } catch (error) {
      logger.error('Errore durante il caricamento delle notifiche locali da AsyncStorage:', error);
    }
  }
  
  /**
   * Salva le notifiche locali in AsyncStorage
   */
  private async saveLocalNotifications(): Promise<void> {
    try {
      // Filtra solo le notifiche locali (ID negativo)
      const localNotifications = this.lastFetchedNotifiche.data.filter(n => n.id < 0);
      
      if (localNotifications.length > 0) {
        await AsyncStorage.setItem(
          LOCAL_NOTIFICATIONS_STORAGE_KEY, 
          JSON.stringify(localNotifications)
        );
        logger.log(`Salvate ${localNotifications.length} notifiche locali in AsyncStorage`);
      } else {
        // Se non ci sono notifiche locali, rimuovi la voce da AsyncStorage
        await AsyncStorage.removeItem(LOCAL_NOTIFICATIONS_STORAGE_KEY);
        logger.log('Nessuna notifica locale da salvare, rimossa chiave da AsyncStorage');
      }
    } catch (error) {
      logger.error('Errore durante il salvataggio delle notifiche locali in AsyncStorage:', error);
    }
  }

  /**
   * Aggiunge una notifica locale al cache delle notifiche.
   * Utile per le notifiche generate dall'app, senza passare dal server.
   * @param titolo Titolo della notifica
   * @param contenuto Corpo della notifica
   * @param letta Se la notifica è già stata letta
   * @param syncWithServer Se sincronizzare immediatamente con il server
   * @returns La notifica creata
   */
  public addLocalNotifica(
    titolo: string, 
    contenuto: string, 
    letta: boolean = false, 
    syncWithServer: boolean = false
  ): Notifica {
    // Genera un ID temporaneo per la notifica locale
    // Decrementa il contatore per evitare conflitti con IDs dal server (che saranno positivi)
    const tempId = this.localNotificaCounter--;
    
    logger.log(`NotificheService: Generato ID notifica locale: ${tempId}`);
    
    // Crea la notifica con i dati forniti
    const notifica: Notifica = {
      id: tempId,
      titolo: titolo,
      messaggio: contenuto,
      tipo: 'Alert',
      priorita: 'Media',
      letta: letta,
      data: new Date().toISOString(),
      dataCreazione: new Date().toISOString(),
      dataLettura: letta ? new Date().toISOString() : undefined
    };
    
    // Aggiungi la notifica alla cache delle notifiche già recuperate
    // Se non ci sono notifiche in cache, inizializza l'array
    if (!this.lastFetchedNotifiche.data) {
      this.lastFetchedNotifiche.data = [];
    }
    
    // Aggiungi la notifica all'inizio dell'array (più recente)
    this.lastFetchedNotifiche.data.unshift(notifica);
    
    // Aggiorna il timestamp della cache
    this.lastFetchedNotifiche.timestamp = Date.now();
    
    // Se la notifica non è già stata letta, incrementa il conteggio di quelle non lette
    if (!letta) {
      this.cachedNonLetteCount += 1;
    }
    
    logger.log(`NotificheService: Aggiunta notifica locale con ID: ${tempId}. Totale notifiche in cache: ${this.lastFetchedNotifiche.data.length}`);
    
    // Salva le notifiche locali in AsyncStorage
    this.saveLocalNotifications();
    
    // Mostra un toast per confermare l'aggiunta
    Toast.show({
      type: 'success',
      text1: 'Notifica aggiunta',
      text2: titolo,
      visibilityTime: 2000,
    });
    
    // Emette un evento di refresh delle notifiche
    emitEvent(APP_EVENTS.REFRESH_NOTIFICATIONS);
    
    // Se richiesto, sincronizza immediatamente con il server
    if (syncWithServer) {
      logger.log('Sincronizzazione immediata della notifica con il server...');
      
      // Utilizziamo setTimeout per non bloccare il thread UI
      setTimeout(() => {
        this.syncLocalNotificaToServer(notifica)
          .then(serverId => {
            if (serverId) {
              logger.log(`Notifica sincronizzata con successo. Nuovo ID: ${serverId}`);
              // Emettiamo un altro evento per aggiornare l'UI dopo la sincronizzazione
              emitEvent(APP_EVENTS.REFRESH_NOTIFICATIONS);
            } else {
              logger.warn('Impossibile sincronizzare la notifica con il server');
            }
          })
          .catch(error => {
            logger.error('Errore durante la sincronizzazione della notifica:', error);
          });
      }, 500);
    }
    
    return notifica;
  }

  /**
   * Recupera tutte le notifiche con supporto per paginazione e filtri
   */
  async getNotifiche(page = 1, limit = 20, filtri: NotificaFiltri = {}): Promise<ApiNotificheResponse> {
    try {
      // Se abbiamo dati in cache e stiamo usando notifiche mock in sviluppo, restituiamo direttamente la cache
      if (__DEV__ && API_CONFIG.USE_MOCK_NOTIFICATIONS && this.lastFetchedNotifiche.data.length > 0) {
        logger.log('NotificheService: Usando dati cache per notifiche (modalità mock)');
        return {
          data: this.lastFetchedNotifiche.data,
          pagination: {
            total: this.lastFetchedNotifiche.data.length,
            currentPage: 1,
            totalPages: 1
          }
        };
      }
      
      // Prepariamo i parametri della query
      const queryParams = new URLSearchParams({ 
        page: page.toString(), 
        limit: limit.toString(),
        ...filtri as Record<string, string>
      });
      
      logger.log(`NotificheService: Richiesta notifiche con params: ${queryParams.toString()}`);
      
      // Utilizziamo l'URL specifico per le notifiche dalla configurazione
      const response = await api.get(`${API_CONFIG.NOTIFICATIONS_API_URL}?${queryParams.toString()}`, {
        timeout: API_CONFIG.REQUEST_TIMEOUT
      });
      
      logger.log(`NotificheService: Ricevute ${response.data?.data?.length || 0} notifiche`);
      
      // Aggiorna la cache locale se è la prima pagina
      if (page === 1) {
        this.lastFetchedNotifiche = {
          timestamp: Date.now(),
          data: response.data.data
        };
      }
      
      return response.data;
    } catch (error) {
      logger.error('NotificheService: Errore nel recupero delle notifiche', error);
      
      // Se siamo in modalità sviluppo e abbiamo attivato i dati mock, non propaghiamo l'errore
      if (API_CONFIG.USE_MOCK_NOTIFICATIONS && __DEV__) {
        Toast.show({
          type: 'info',
          text1: 'Utilizzo dati di esempio',
          text2: 'Non è stato possibile contattare il server delle notifiche',
          visibilityTime: 3000,
        });
        
        // Se abbiamo notifiche locali nella cache, le restituiamo
        if (this.lastFetchedNotifiche.data.length > 0) {
          logger.log('Restituisco notifiche dalla cache locale (mock attivo)');
          return {
            data: this.lastFetchedNotifiche.data,
            pagination: {
              total: this.lastFetchedNotifiche.data.length,
              currentPage: 1,
              totalPages: 1
            }
          };
        } else {
          // Altrimenti restituiamo un array vuoto
          return { data: [], pagination: { total: 0, currentPage: 1, totalPages: 1 } };
        }
      }
      
      // Se abbiamo dati in cache e siamo sulla prima pagina, li restituiamo
      if (page === 1 && this.lastFetchedNotifiche.data.length > 0) {
        logger.log('Restituisco notifiche dalla cache locale');
        return {
          data: this.lastFetchedNotifiche.data,
          pagination: {
            total: this.lastFetchedNotifiche.data.length,
            currentPage: 1,
            totalPages: 1
          }
        };
      }
      
      throw error;
    }
  }

  /**
   * Recupera il conteggio delle notifiche non lette
   */
  async getNotificheNonLette(): Promise<number> {
    // Riduciamo la durata della cache per avere aggiornamenti più frequenti
    const CACHE_DURATION_SHORT = 10000; // 10 secondi
    
    // Se abbiamo una cache valida, la restituiamo
    const now = Date.now();
    if (now - this.lastCountFetchTime < CACHE_DURATION_SHORT) {
      logger.log(`NotificheService: Restituisco conteggio in cache: ${this.cachedNonLetteCount}`);
      return this.cachedNonLetteCount;
    }
    
    try {
      logger.log('NotificheService: Richiesta conteggio notifiche non lette');
      
      // Se siamo in modalità sviluppo e i dati mock sono attivi, calcoliamo dai dati locali
      if (API_CONFIG.USE_MOCK_NOTIFICATIONS && __DEV__) {
        // Calcola il numero di notifiche non lette dai dati locali
        const nonLette = this.lastFetchedNotifiche.data.filter(n => !n.letta).length;
        this.cachedNonLetteCount = nonLette;
        this.lastCountFetchTime = now;
        logger.log(`NotificheService: Conteggio da dati mock: ${nonLette}`);
        return nonLette;
      }
      
      // Prima proviamo l'endpoint dedicato
      try {
        const response = await api.get(`${API_CONFIG.NOTIFICATIONS_API_URL}/conteggio`, {
          timeout: 3000 // timeout ridotto per questo endpoint
        });
        
        // Aggiorniamo la cache
        this.cachedNonLetteCount = response.data.count;
        this.lastCountFetchTime = now;
        
        logger.log(`NotificheService: Conteggio ottenuto: ${this.cachedNonLetteCount}`);
        return this.cachedNonLetteCount;
      } catch (error) {
        // Se l'endpoint dedicato fallisce, proveremo con il calcolo manuale
        logger.warn('(NOBRIDGE) WARN  Endpoint conteggio non disponibile, calcolo manuale');
        
        // Altrimenti calcoliamo manualmente
        const response = await api.get(`${API_CONFIG.NOTIFICATIONS_API_URL}?letta=false&limit=1`, {
          timeout: API_CONFIG.REQUEST_TIMEOUT
        });
        
        // Aggiorniamo la cache
        this.cachedNonLetteCount = response.data.pagination.total;
        this.lastCountFetchTime = now;
        
        logger.log(`NotificheService: Conteggio calcolato manualmente: ${this.cachedNonLetteCount}`);
        return this.cachedNonLetteCount;
      }
    } catch (error) {
      logger.error('NotificheService: Errore nel recupero del conteggio delle notifiche', error);
      
      // In caso di errore, restituiamo l'ultimo valore in cache o 0
      return this.cachedNonLetteCount;
    }
  }

  /**
   * Segna una notifica come letta
   */
  async segnaComeLetta(id: number | string): Promise<any> {
    try {
      logger.log(`NotificheService: Richiesta segna come letta notifica ${id}`);
      
      // Converti id in numero se è una stringa
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      // Per le notifiche locali (ID negativi), gestiamo localmente
      if (numericId < 0) {
        // Aggiorna la notifica in cache
        const notificaIndex = this.lastFetchedNotifiche.data.findIndex(n => n.id === numericId);
        
        if (notificaIndex !== -1 && !this.lastFetchedNotifiche.data[notificaIndex].letta) {
          // Aggiorna lo stato e la data di lettura
          this.lastFetchedNotifiche.data[notificaIndex].letta = true;
          this.lastFetchedNotifiche.data[notificaIndex].dataLettura = new Date().toISOString();
          
          // Decrementa il conteggio delle non lette
          if (this.cachedNonLetteCount > 0) {
            this.cachedNonLetteCount--;
          }
          
          // Salva le modifiche in AsyncStorage
          this.saveLocalNotifications();
          
          logger.log(`Notifica locale ${numericId} segnata come letta`);
          return { success: true };
        } else if (notificaIndex === -1) {
          logger.warn(`Notifica locale ${numericId} non trovata in cache`);
          return { success: false, message: 'Notifica non trovata' };
        } else {
          logger.log(`Notifica locale ${numericId} già segnata come letta`);
          return { success: true };
        }
      }
      
      // Per le notifiche dal server, procedi con la chiamata API
      const response = await api.put(`${API_CONFIG.NOTIFICATIONS_API_URL}/${id}/letta`);
      
      // Aggiorniamo il conteggio in cache
      if (this.cachedNonLetteCount > 0) {
        this.cachedNonLetteCount--;
      }
      
      // Aggiorna anche le notifiche in cache
      const notificaIndex = this.lastFetchedNotifiche.data.findIndex(n => n.id === numericId);
      
      if (notificaIndex !== -1) {
        this.lastFetchedNotifiche.data[notificaIndex].letta = true;
      }
      
      return response.data;
    } catch (error) {
      logger.error(`NotificheService: Errore nel segnare come letta la notifica ${id}`, error);
      throw error;
    }
  }

  /**
   * Segna tutte le notifiche come lette
   */
  async segnaTutteComeLette(): Promise<boolean> {
    try {
      logger.log('NotificheService: Richiesta segna tutte le notifiche come lette');
      
      // Tieni traccia se ci sono notifiche locali
      let hasLocalNotifications = false;
      
      // Aggiorna anche le notifiche in cache
      if (this.lastFetchedNotifiche.data.length > 0) {
        // Verifica se ci sono notifiche locali non lette
        const localNotifications = this.lastFetchedNotifiche.data.filter(n => n.id < 0 && !n.letta);
        hasLocalNotifications = localNotifications.length > 0;
        
        // Aggiorna lo stato di tutte le notifiche in cache
        this.lastFetchedNotifiche.data = this.lastFetchedNotifiche.data.map(notifica => ({
          ...notifica,
          letta: true,
          dataLettura: notifica.dataLettura || new Date().toISOString()
        }));
        
        // Se ci sono notifiche locali, salva le modifiche in AsyncStorage
        if (hasLocalNotifications) {
          this.saveLocalNotifications();
          logger.log('Aggiornato stato notifiche locali in AsyncStorage');
        }
      }
      
      // Aggiorniamo il conteggio in cache
      this.cachedNonLetteCount = 0;
      
      // Se ci sono solo notifiche locali, restituisci successo senza chiamare il server
      if (hasLocalNotifications && this.lastFetchedNotifiche.data.every(n => n.id < 0)) {
        return true;
      }
      
      // Altrimenti chiama il server per aggiornare le notifiche remote
      const response = await api.put(`${API_CONFIG.NOTIFICATIONS_API_URL}/lette`);
      return response.data.success || false;
      
    } catch (error) {
      logger.error('NotificheService: Errore nel segnare tutte le notifiche come lette', error);
      return false;
    }
  }

  /**
   * Elimina una notifica
   */
  async eliminaNotifica(id: number | string): Promise<boolean> {
    try {
      logger.log(`NotificheService: Richiesta eliminazione notifica ${id}`);
      
      // Converti id in numero se è una stringa
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      // Cerca la notifica nella cache
      const notificaEliminata = this.lastFetchedNotifiche.data.find(n => n.id === numericId);
      
      // Per le notifiche locali (ID negativi), gestiamo localmente
      if (numericId < 0) {
        if (notificaEliminata) {
          // Aggiorna il conteggio se la notifica era non letta
          if (!notificaEliminata.letta) {
            this.cachedNonLetteCount = Math.max(0, (this.cachedNonLetteCount || 0) - 1);
          }
          
          // Rimuovi dalla cache
          this.lastFetchedNotifiche.data = this.lastFetchedNotifiche.data.filter(n => n.id !== numericId);
          
          // Salva le modifiche in AsyncStorage
          this.saveLocalNotifications();
          
          logger.log(`Notifica locale ${numericId} eliminata`);
          return true;
        } else {
          logger.warn(`Notifica locale ${numericId} non trovata in cache`);
          return false;
        }
      }
      
      // Per le notifiche dal server, procedi con la chiamata API
      const response = await api.delete(`${API_CONFIG.NOTIFICATIONS_API_URL}/${id}`);
      
      // Aggiorna la cache locale se la notifica era non letta
      if (notificaEliminata && !notificaEliminata.letta) {
        this.cachedNonLetteCount = Math.max(0, (this.cachedNonLetteCount || 0) - 1);
      }
      
      // Rimuovi dalla cache
      if (this.lastFetchedNotifiche.data.length > 0) {
        this.lastFetchedNotifiche.data = this.lastFetchedNotifiche.data.filter(n => n.id !== numericId);
      }
      
      return response.data.success || false;
    } catch (error) {
      logger.error(`NotificheService: Errore nell'eliminazione della notifica ${id}`, error);
      return false;
    }
  }

  /**
   * Avvia il polling per le notifiche non lette
   */
  avviaPollingNotifiche(callback: (count: number) => void): void {
    if (this.pollingInterval !== null) {
      this.interrompiPollingNotifiche();
    }
    
    this.isPolling = true;
    
    // Esegue il callback immediatamente con i dati attuali
    this.getNotificheNonLette()
      .then(count => callback(count))
      .catch(err => logger.error('Errore nel polling iniziale:', err));
    
    // Avvia il polling periodico
    this.pollingInterval = setInterval(async () => {
      if (!this.isPolling) return;
      
      try {
        const count = await this.getNotificheNonLette();
        callback(count);
      } catch (error) {
        logger.error('Errore durante il polling delle notifiche:', error);
      }
    }, this.pollingDelay);
    
    logger.log(`Polling notifiche avviato (ogni ${this.pollingDelay/1000} secondi)`);
  }

  /**
   * Interrompe il polling delle notifiche
   */
  interrompiPollingNotifiche(): void {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
      logger.log('Polling notifiche interrotto');
    }
  }

  /**
   * Ottiene i dettagli di una specifica notifica
   */
  async getDettaglioNotifica(notificaId: number): Promise<Notifica> {
    try {
      // Prima cerca nella cache locale
      const cachedNotifica = this.lastFetchedNotifiche.data.find(n => n.id === notificaId);
      if (cachedNotifica) {
        return cachedNotifica;
      }
      
      // Se non trovata in cache, fai la richiesta
      const response = await api.get(`/notifiche/${notificaId}`);
      return response.data.data;
    } catch (error) {
      logger.error(`Errore durante il recupero dei dettagli della notifica ${notificaId}:`, error);
      throw error;
    }
  }
  
  /**
   * Ottiene una notifica per ID con resilienza agli errori
   */
  async getNotifica(id: number | string): Promise<{data: Notifica}> {
    try {
      logger.log(`NotificheService: Richiesta dettaglio notifica ${id}`);
      
      // Verifica se la notifica è in cache
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      const cachedNotifica = this.lastFetchedNotifiche.data.find(n => n.id === numericId);
      
      if (cachedNotifica) {
        logger.log(`Notifica ${id} trovata in cache`);
        return { data: cachedNotifica };
      }
      
      // Per le notifiche locali (ID negativi) non fare chiamate al server
      if (numericId < 0) {
        logger.error(`Notifica locale con ID ${id} non trovata in cache.`);
        throw new Error(`Notifica con ID ${id} non trovata.`);
      }
      
      // Per le notifiche dal server, prova a recuperarle
      const response = await api.get(`${API_CONFIG.NOTIFICATIONS_API_URL}/${id}`, {
        timeout: API_CONFIG.REQUEST_TIMEOUT
      });
      
      return response.data;
    } catch (error) {
      // Se siamo in modalità sviluppo e abbiamo abilitato i mock, cerca di nuovo in cache
      if (__DEV__ && API_CONFIG.USE_MOCK_NOTIFICATIONS) {
        const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
        // Cerca in cache anche con piccole differenze (potrebbe essere un errore di conversione)
        const cachedNotifica = this.lastFetchedNotifiche.data.find(n => 
          n.id === numericId || n.id === -numericId || n.id === Math.abs(numericId)
        );
        
        if (cachedNotifica) {
          logger.log(`Trovata notifica in cache con ID alternativo: ${cachedNotifica.id}`);
          return { data: cachedNotifica };
        }
      }
      
      logger.error(`NotificheService: Errore nel recupero della notifica ${id}`, error);
      throw error;
    }
  }
  
  /**
   * Ottiene le notifiche per tipo specifico (es. notifiche relative ai lotti)
   */
  async getNotifichePerTipo(tipo: string, page = 1, limit = 20): Promise<NotificheResponse> {
    try {
      const filtri: NotificaFiltri = { tipo: tipo as any };
      return await this.getNotifiche(page, limit, filtri);
    } catch (error) {
      logger.error(`Errore durante il recupero delle notifiche di tipo ${tipo}:`, error);
      throw error;
    }
  }
  
  /**
   * Ottiene solo le notifiche relative ai lotti (CambioStato)
   */
  async getNotificheLotti(page = 1, limit = 20): Promise<NotificheResponse> {
    return this.getNotifichePerTipo('CambioStato', page, limit);
  }
  
  /**
   * Ottiene solo le notifiche relative alle prenotazioni
   */
  async getNotifichePrenotazioni(page = 1, limit = 20): Promise<NotificheResponse> {
    return this.getNotifichePerTipo('Prenotazione', page, limit);
  }
  
  /**
   * Ottiene il conteggio delle notifiche
   */
  async getConteggio(): Promise<number> {
    try {
      const response = await api.get('/notifiche/conteggio');
      return response.data.totale || 0;
    } catch (error) {
      logger.error('Errore durante il recupero del conteggio notifiche:', error);
      return 0;
    }
  }

  /**
   * Invia una notifica locale al server per salvarla nel database
   * @param notifica La notifica locale da sincronizzare con il server
   * @returns L'ID della notifica sul server
   */
  async syncLocalNotificaToServer(notifica: Notifica): Promise<number | null> {
    try {
      // Prepara i dati da inviare al server
      const notificaData = {
        titolo: notifica.titolo,
        messaggio: notifica.messaggio,
        tipo: notifica.tipo,
        priorita: notifica.priorita,
        letta: notifica.letta,
        // Mandiamo la data originale di creazione
        dataCreazione: notifica.dataCreazione
      };
      
      logger.log(`Invio notifica locale al server: ${JSON.stringify(notificaData)}`);
      
      // Ottieni il token di autenticazione
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      if (!token) {
        logger.error('Token di autenticazione mancante. Impossibile sincronizzare la notifica.');
        throw new Error('Token di autenticazione mancante');
      }
      
      // Utilizziamo il nuovo endpoint di sincronizzazione
      logger.log(`URL endpoint sincronizzazione: ${API_CONFIG.NOTIFICATIONS_API_URL}/sync`);
      
      // Effettua la chiamata al server con token esplicito
      const response = await api.post(
        `${API_CONFIG.NOTIFICATIONS_API_URL}/sync`, 
        notificaData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.success && response.data.data && response.data.data.id) {
        const serverNotificaId = response.data.data.id;
        logger.log(`Notifica sincronizzata con successo. ID server: ${serverNotificaId}`);
        
        // Trova l'indice della notifica locale
        const localIndex = this.lastFetchedNotifiche.data.findIndex(n => n.id === notifica.id);
        
        if (localIndex !== -1) {
          // Aggiorna l'ID e i dati della notifica con quelli del server
          const updatedNotifica = {
            ...this.lastFetchedNotifiche.data[localIndex],
            id: serverNotificaId,
            dataCreazione: response.data.data.dataCreazione || notifica.dataCreazione
          };
          
          // Rimuovi la vecchia notifica locale e aggiungi quella aggiornata
          this.lastFetchedNotifiche.data.splice(localIndex, 1);
          this.lastFetchedNotifiche.data.push(updatedNotifica);
          
          // Aggiorna la cache locale
          await this.saveLocalNotifications();
          
          // Mostra toast di conferma
          Toast.show({
            type: 'success',
            text1: 'Notifica sincronizzata',
            text2: `ID: ${serverNotificaId}`,
            visibilityTime: 2000,
          });
          
          return serverNotificaId;
        }
        
        return serverNotificaId;
      } else {
        logger.warn('Risposta server non valida durante la sincronizzazione della notifica');
        logger.warn(`Risposta: ${JSON.stringify(response.data)}`);
        return null;
      }
    } catch (error) {
      logger.error('Errore durante la sincronizzazione della notifica con il server:');
      if (error instanceof Error) {
        logger.error(`- Messaggio: ${error.message}`);
      }
      if (axios.isAxiosError(error)) {
        logger.error(`- Codice stato: ${error.response?.status}`);
        logger.error(`- Risposta: ${JSON.stringify(error.response?.data)}`);
        logger.error(`- URL richiesta: ${error.config?.url}`);
      }
      return null;
    }
  }
  
  /**
   * Sincronizza tutte le notifiche locali con il server
   * @returns Numero di notifiche sincronizzate con successo
   */
  async syncAllLocalNotificationsToServer(): Promise<number> {
    // Evita sincronizzazioni simultanee
    if (this.isSyncing) {
      logger.warn('Sincronizzazione già in corso, richiesta ignorata');
      return 0;
    }
    
    try {
      this.isSyncing = true;
      
      // Filtriamo solo le notifiche locali (ID negativo)
      const localNotifications = this.lastFetchedNotifiche.data.filter(n => n.id < 0);
      
      if (localNotifications.length === 0) {
        logger.log('Nessuna notifica locale da sincronizzare');
        return 0;
      }
      
      logger.log(`Sincronizzazione di ${localNotifications.length} notifiche locali con il server`);
      
      let syncSuccess = 0;
      
      // Sincronizza ogni notifica una alla volta
      for (const notifica of localNotifications) {
        const serverId = await this.syncLocalNotificaToServer(notifica);
        if (serverId) {
          syncSuccess++;
        }
      }
      
      // Aggiorna la cache dopo la sincronizzazione
      await this.saveLocalNotifications();
      
      logger.log(`Sincronizzazione completata: ${syncSuccess}/${localNotifications.length} notifiche sincronizzate`);
      
      // Aggiorna il conteggio delle notifiche non lette
      this.getNotificheNonLette();
      
      return syncSuccess;
    } catch (error) {
      logger.error('Errore durante la sincronizzazione delle notifiche con il server:', error);
      return 0;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Invia una notifica a tutti gli amministratori di un centro
   * @param centroId ID del centro
   * @param titolo Titolo della notifica
   * @param contenuto Corpo della notifica
   * @param operatoreName Nome dell'operatore che ha generato l'azione
   * @returns Promise<void>
   */
  public async addNotificaToAmministratori(
    centroId: number | null = null, 
    titolo: string, 
    contenuto: string, 
    operatoreName?: string
  ): Promise<void> {
    try {
      // Crea una notifica locale per l'operatore corrente usando il contenuto originale
      // che è già formulato dal punto di vista dell'operatore ("Hai modificato...")
      const notificaLocale = this.addLocalNotifica(
        titolo,
        contenuto, 
        false, // non letta
        true   // sincronizza con il server
      );
      
      logger.log('Notifica locale aggiunta al contesto con ID:', notificaLocale.id);
      
      // Se non è specificato un centroId, otteniamo un centro valido dal backend
      if (centroId === null) {
        try {
          const response = await this.getResilient<any>(
            `${API_CONFIG.NOTIFICATIONS_API_URL}/centro-test`, 
            {}, 
            null
          );
          
          if (response && response.success && response.data && response.data.centro) {
            centroId = response.data.centro.id;
            console.log(`Ottenuto automaticamente il centro ID ${centroId} per le notifiche`);
          } else {
            console.error('Impossibile ottenere un centro valido per le notifiche:', response);
            return;
          }
        } catch (error) {
          console.error('Errore nel recupero del centro per le notifiche:', error);
          return;
        }
      }
      
      // Controllo finale che il centroId sia valido
      if (!centroId) {
        console.error('CentroId non valido per inviare notifica agli amministratori');
        return;
      }

      // Recupera il token di autenticazione
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      if (!token) {
        console.warn('Token non disponibile per inviare notifica agli amministratori');
        // La notifica locale è già stata aggiunta sopra
        return;
      }
      
      // Prepara il contenuto per gli amministratori
      let messaggioAmministratori;
      
      // Se il contenuto è formulato come "Hai modificato il lotto...", lo convertiamo
      // per gli amministratori in "L'operatore X ha modificato il lotto..."
      if (contenuto.includes("Hai modificato")) {
        // Estrae il nome del lotto dalla notifica per l'operatore
        const lottoMatch = contenuto.match(/Hai modificato il lotto "([^"]+)"/);
        const lottoNome = lottoMatch ? lottoMatch[1] : "un lotto";
        
        // Estrae la descrizione delle modifiche
        const modificheMatch = contenuto.match(/Modifiche: (.*)/);
        const descrizioneModifiche = modificheMatch ? modificheMatch[1] : "";
        
        // Crea il messaggio per gli amministratori
        messaggioAmministratori = operatoreName 
          ? `L'operatore ${operatoreName} ha modificato il lotto "${lottoNome}". Modifiche: ${descrizioneModifiche}`
          : `Un operatore ha modificato il lotto "${lottoNome}". Modifiche: ${descrizioneModifiche}`;
      } else {
        // Se il contenuto non è formulato come "Hai modificato...", usiamo il contenuto originale
        // e aggiungiamo solo il nome dell'operatore se disponibile
        messaggioAmministratori = operatoreName 
          ? `${contenuto} - Da: ${operatoreName}`
          : contenuto;
      }
      
      // Prepara i dati della notifica per gli amministratori
      const notificaData = {
        titolo,
        messaggio: messaggioAmministratori,
        tipo: 'LottoModificato',
        priorita: 'Media'
      };
      
      console.log(`Invio notifica agli amministratori del centro ${centroId}: ${titolo}`);
      
      // Invia la notifica al backend
      const response = await fetch(`${API_CONFIG.NOTIFICATIONS_API_URL}/admin-centro/${centroId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(notificaData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Errore nell\'invio della notifica agli amministratori:', 
          response.status, errorData.message || response.statusText);
        
        // La notifica locale è già stata aggiunta sopra
        return;
      }
      
      const data = await response.json();
      console.log('Notifica inviata agli amministratori con successo:', data);
      
      // Emetti manualmente un evento di refresh delle notifiche 
      // per garantire che il contesto venga aggiornato
      emitEvent(APP_EVENTS.REFRESH_NOTIFICATIONS);
      
    } catch (error) {
      console.error('Errore nell\'invio della notifica agli amministratori:', error);
      
      // La notifica locale è già stata aggiunta sopra
    }
  }

  /**
   * Configura la richiesta API con parametri e gestione errori
   */
  private async configuraRichiesta(endpoint: string, params: Record<string, any> = {}) {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      return await api.get(endpoint, {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch (error) {
      logger.error(`Errore API: ${endpoint}`, error);
      throw error;
    }
  }
  
  /**
   * Esegue una richiesta GET con resilienza agli errori
   */
  private async getResilient<T>(endpoint: string, params: Record<string, any> = {}, defaultValue?: T): Promise<T> {
    try {
      const response = await this.configuraRichiesta(endpoint, params);
      return response.data;
    } catch (error) {
      logger.warn(`Errore nella richiesta resiliente a ${endpoint}:`, error);
      
      if (defaultValue !== undefined) {
        logger.info(`Utilizzando valore predefinito per ${endpoint}`);
        return defaultValue;
      }
      
      throw error;
    }
  }
}

// Crea e esporta un'istanza del servizio
const notificheService = new NotificheService();
export default notificheService; 