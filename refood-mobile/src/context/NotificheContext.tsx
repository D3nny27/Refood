import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Notifica, NotificaFiltri } from '../types/notification';
import notificheService from '../services/notificheService';
import { useAuth } from './AuthContext';
import { listenEvent, APP_EVENTS } from '../utils/events';
import logger from '../utils/logger';

interface NotificheContextType {
  notifiche: Notifica[];
  nonLette: number;
  loading: boolean;
  error: string | null;
  caricaNotifiche: (page?: number, limit?: number, filtri?: NotificaFiltri) => Promise<void>;
  segnaComeLetta: (notificaId: number) => Promise<boolean>;
  segnaTutteLette: () => Promise<boolean>;
  eliminaNotifica: (notificaId: number) => Promise<boolean>;
  refreshNotifiche: () => Promise<void>;
  aggiornaConteggio: () => Promise<void>;
  segnalaComeLetta: (id: number) => Promise<void>;
  syncLocalNotificheToServer: () => Promise<number>;
}

// Creazione del contesto con valori di default
const NotificheContext = createContext<NotificheContextType>({
  notifiche: [],
  nonLette: 0,
  loading: false,
  error: null,
  caricaNotifiche: async () => {},
  segnaComeLetta: async () => false,
  segnaTutteLette: async () => false,
  eliminaNotifica: async () => false,
  refreshNotifiche: async () => {},
  aggiornaConteggio: async () => {},
  segnalaComeLetta: async () => {},
  syncLocalNotificheToServer: async () => 0,
});

// Hook personalizzato per utilizzare il contesto
export const useNotifiche = () => useContext(NotificheContext);

interface NotificheProviderProps {
  children: ReactNode;
}

// Provider del contesto
export const NotificheProvider: React.FC<NotificheProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
  const [nonLette, setNonLette] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Carica le notifiche dal server
  const caricaNotifiche = useCallback(async (page = 1, limit = 20, filtri?: NotificaFiltri) => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await notificheService.getNotifiche(page, limit, filtri);
      
      if (page === 1) {
        // Se è la prima pagina, sostituisci l'array
        setNotifiche(response.data);
      } else {
        // Altrimenti, aggiungi alla fine dell'array esistente
        setNotifiche(prevNotifiche => [...prevNotifiche, ...response.data]);
      }
    } catch (err) {
      console.error('Errore durante il caricamento delle notifiche:', err);
      setError('Impossibile caricare le notifiche');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Aggiorna il conteggio delle notifiche non lette
  const aggiornaConteggio = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const count = await notificheService.getNotificheNonLette();
      setNonLette(count);
    } catch (err) {
      console.error('Errore durante l\'aggiornamento del conteggio notifiche:', err);
    }
  }, [isAuthenticated]);

  // Segna una notifica come letta
  const segnaComeLetta = useCallback(async (notificaId: number) => {
    try {
      await notificheService.segnaComeLetta(notificaId);
      
      // Aggiorna l'array locale di notifiche
      setNotifiche(prevNotifiche => 
        prevNotifiche.map(notifica => 
          notifica.id === notificaId ? { ...notifica, letta: true } : notifica
        )
      );
      
      // Aggiorna il conteggio delle notifiche non lette
      await aggiornaConteggio();
      
      return true;
    } catch (err) {
      console.error('Errore durante la marcatura della notifica come letta:', err);
      return false;
    }
  }, [aggiornaConteggio]);

  // Segna tutte le notifiche come lette
  const segnaTutteLette = useCallback(async () => {
    try {
      const success = await notificheService.segnaTutteComeLette();
      
      if (success) {
        // Aggiorna l'array locale di notifiche
        setNotifiche(prevNotifiche => 
          prevNotifiche.map(notifica => ({ ...notifica, letta: true }))
        );
        
        // Azzera il conteggio delle notifiche non lette
        setNonLette(0);
      }
      
      return success;
    } catch (err) {
      console.error('Errore durante la marcatura di tutte le notifiche come lette:', err);
      return false;
    }
  }, []);

  // Elimina una notifica
  const eliminaNotifica = useCallback(async (notificaId: number) => {
    try {
      const success = await notificheService.eliminaNotifica(notificaId);
      
      if (success) {
        // Rimuovi la notifica dall'array locale
        setNotifiche(prevNotifiche => 
          prevNotifiche.filter(notifica => notifica.id !== notificaId)
        );
        
        // Aggiorna il conteggio
        await aggiornaConteggio();
      }
      
      return success;
    } catch (err) {
      console.error('Errore durante l\'eliminazione della notifica:', err);
      return false;
    }
  }, [aggiornaConteggio]);

  // Ricarica completamente le notifiche
  const refreshNotifiche = useCallback(async () => {
    logger.log('Aggiornamento completo delle notifiche...');
    await caricaNotifiche(1, 20);
    await aggiornaConteggio();
  }, [caricaNotifiche, aggiornaConteggio]);

  // Effetto per impostare il polling delle notifiche
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Funzione di callback per il polling
    const onNewNotificheCount = (count: number) => {
      setNonLette(count);
    };
    
    // Avvia il polling
    notificheService.avviaPollingNotifiche(onNewNotificheCount);
    
    // Cleanup quando il componente si smonta
    return () => {
      notificheService.interrompiPollingNotifiche();
    };
  }, [isAuthenticated]);
  
  // Ascolta l'evento di refresh notifiche (quando l'app torna in primo piano)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    logger.log('Configuro listener per refresh notifiche');
    const removeListener = listenEvent(APP_EVENTS.REFRESH_NOTIFICATIONS, () => {
      logger.log('Evento refresh notifiche ricevuto, aggiornamento in corso...');
      refreshNotifiche().catch(err => {
        logger.error('Errore durante il refresh delle notifiche:', err);
      });
    });
    
    return () => {
      removeListener();
    };
  }, [isAuthenticated, refreshNotifiche]);

  // Carica le notifiche all'avvio o quando cambia l'utente
  useEffect(() => {
    if (isAuthenticated) {
      refreshNotifiche();
    } else {
      // Reset dello stato quando non c'è un utente autenticato
      setNotifiche([]);
      setNonLette(0);
    }
  }, [isAuthenticated, refreshNotifiche]);

  // Valore del contesto
  const value = {
    notifiche,
    nonLette,
    loading,
    error,
    caricaNotifiche,
    segnaComeLetta,
    segnaTutteLette,
    eliminaNotifica,
    refreshNotifiche,
    aggiornaConteggio,
    segnalaComeLetta: async (id: number) => {
      try {
        await notificheService.segnaComeLetta(id);
        
        // Aggiorna lo stato locale delle notifiche
        setNotifiche(prev => 
          prev.map(notifica => 
            notifica.id === id 
              ? { ...notifica, letta: true, dataLettura: new Date().toISOString() } 
              : notifica
          )
        );
        
        // Aggiorna il conteggio delle non lette
        aggiornaConteggio();
      } catch (error) {
        console.error(`Errore nel segnare come letta la notifica ${id}:`, error);
        setError('Impossibile segnare la notifica come letta');
      }
    },
    syncLocalNotificheToServer: async () => {
      try {
        // Verifica se il caricamento è già in corso
        if (loading) {
          logger.warn('Sincronizzazione ignorata: caricamento già in corso');
          return 0;
        }
        
        setLoading(true);
        const count = await notificheService.syncAllLocalNotificationsToServer();
        
        // Ricarica le notifiche dopo la sincronizzazione
        if (count > 0) {
          await refreshNotifiche();
        }
        
        return count;
      } catch (error) {
        console.error('Errore durante la sincronizzazione delle notifiche:', error);
        setError('Impossibile sincronizzare le notifiche con il server');
        return 0;
      } finally {
        setLoading(false);
      }
    },
  };

  return (
    <NotificheContext.Provider value={value}>
      {children}
    </NotificheContext.Provider>
  );
};

export default NotificheProvider; 