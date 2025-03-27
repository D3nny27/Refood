import { Stack, Slot, router, usePathname, useSegments } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, Platform, AppState, AppStateStatus } from 'react-native';
import { PaperProvider, MD3LightTheme as DefaultTheme, Button } from 'react-native-paper';
import { PRIMARY_COLOR } from '../src/config/constants';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { NotificheProvider } from '../src/context/NotificheContext';
import pushNotificationService from '../src/services/pushNotificationService';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LoginScreen from '../src/screens/LoginScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../src/config/constants';
import Toast from 'react-native-toast-message';
import logger from '../src/utils/logger';
import { listenEvent, APP_EVENTS } from '../src/utils/events';
import { emitEvent } from '../src/utils/events';

// Definizione del tema personalizzato per react-native-paper
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: PRIMARY_COLOR,
    secondary: '#FF9800',
  },
};

// Componente RootLayout che definisce la struttura principale dell'app
export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          {/* Utilizziamo un wrapper View per isolare l'AuthProvider */}
          <AuthProviderInitializer>
            <Toast />
          </AuthProviderInitializer>  
        </AuthProvider>
      </GestureHandlerRootView>
    </PaperProvider>
  );
}

// Componente intermedio per garantire che AuthProvider sia completamente inizializzato
function AuthProviderInitializer({ children }: { children: React.ReactNode }) {
  // Ottieni l'autenticazione PRIMA di utilizzare NotificheProvider
  const auth = useAuth();
  
  // Se l'autenticazione è in caricamento, mostra un loader
  if (auth.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Caricamento in corso...</Text>
      </View>
    );
  }
  
  // Solo dopo che l'autenticazione è completamente inizializzata, renderizziamo NotificheProvider
  return (
    <>
      <NotificheProvider>
        <RootLayoutNav />
      </NotificheProvider>
      {children}
    </>
  );
}

// Componente per la navigazione condizionale in base allo stato di autenticazione
function RootLayoutNav() {
  const { user, isLoading, error, refreshUserStatus, isAuthenticated } = useAuth();
  const [refreshAttempts, setRefreshAttempts] = useState(0);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const [isNavigating, setIsNavigating] = useState(false); // Previene navigazione multipla

  // Log per debug
  useEffect(() => {
    logger.log('RootLayoutNav - isAuthenticated:', isAuthenticated);
    logger.log('RootLayoutNav - user:', user ? `${user.email} (${user.ruolo})` : 'null');
  }, [user, isAuthenticated]);
  
  // Listener per eventi di token JWT scaduto usando il sistema di eventi personalizzato
  useEffect(() => {
    // Contatore per prevenire loop infiniti
    let expiredEventCount = 0;
    const maxExpiredEvents = 3;
    let lastExpiredEventTime = 0;
    
    const handleJwtExpired = () => {
      logger.warn('Evento JWT scaduto rilevato in RootLayoutNav');
      
      const now = Date.now();
      // Resetta il contatore se è passato più di un minuto dall'ultimo evento
      if (now - lastExpiredEventTime > 60000) {
        expiredEventCount = 0;
      }
      lastExpiredEventTime = now;
      
      // Incrementa il contatore degli eventi
      expiredEventCount++;
      
      // Se riceviamo troppi eventi in rapida successione, blocca per evitare loop
      if (expiredEventCount > maxExpiredEvents) {
        logger.error(`Troppi eventi JWT_EXPIRED in rapida successione (${expiredEventCount}), ignoro per prevenire loop`);
        return;
      }
      
      // Naviga alla schermata di login dopo un breve ritardo
      setTimeout(() => {
        // Utilizza safeNavigate per prevenire navigazioni multiple
        if (!isNavigating) {
          setIsNavigating(true);
          
          // Gestione specifica per il web
          if (Platform.OS === 'web') {
            logger.log('Gestione JWT scaduto specifica per Web');
            // Nel web, forziamo un reload completo per pulire tutti gli stati
            try {
              // Pulisci prima cache e storage
              AsyncStorage.clear().catch(err => logger.error('Errore pulizia storage:', err));
              
              // Attendi un attimo e poi vai alla pagina di login
              setTimeout(() => {
                router.replace('/');
              }, 200);
            } catch (error) {
              logger.error('Errore nella gestione JWT scaduto per web:', error);
              // Fallback: redirect semplice
              router.replace('/');
            }
          } else {
            // Comportamento normale per mobile
            router.replace('/');
          }
          
          // Mostra un messaggio all'utente
          Toast.show({
            type: 'info',
            text1: 'Sessione scaduta',
            text2: 'Effettua nuovamente il login per continuare',
            visibilityTime: 5000,
          });
          
          setTimeout(() => {
            setIsNavigating(false);
          }, 300);
        }
      }, 500);
    };
    
    // Usa il sistema di eventi personalizzato invece di window.addEventListener
    const removeListener = listenEvent(APP_EVENTS.JWT_EXPIRED, handleJwtExpired);
    
    // Cleanup quando il componente si smonta
    return () => {
      removeListener();
    };
  }, [isNavigating]);

  // Funzione sicura per la navigazione che previene navigazioni multiple simultanee
  const safeNavigate = (destination: any, params?: any) => {
    if (isNavigating) return; // Se già sta navigando, esce
    
    try {
      setIsNavigating(true);
      if (params) {
        router.push({pathname: destination, params});
      } else {
        router.push(destination);
      }
      
      // Resetta lo stato dopo un breve ritardo
      setTimeout(() => {
        setIsNavigating(false);
      }, 300);
    } catch (e) {
      logger.error('Errore durante la navigazione:', e);
      setIsNavigating(false);
    }
  };

  // Effetto per configurare le notifiche push e monitorare il cambio di stato dell'app
  useEffect(() => {
    // Configura notifiche push solo se l'utente è autenticato
    if (isAuthenticated && user) {
      // Configura notifiche push
      const configurePushNotifications = async () => {
        try {
          const success = await pushNotificationService.configurePushNotifications();
          if (success) {
            logger.log('Notifiche push configurate con successo');
            
            // Registra il token push con il server
            try {
              const registrationSuccess = await pushNotificationService.registerPushTokenWithServer();
              if (registrationSuccess) {
                logger.log('Token push registrato con successo sul server');
              }
            } catch (err) {
              logger.error('Errore nella registrazione del token push:', err);
            }
          }
        } catch (err) {
          logger.error('Errore nella configurazione delle notifiche push:', err);
        }
      };
      
      configurePushNotifications();
      
      // Configura listener per notifiche
      if (!notificationListener.current) {
        // Rimuovi prima eventuali listener esistenti per evitare duplicati
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        
        // Configura il nuovo listener
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
          logger.log('Notifica ricevuta:', notification);
        });
      }
      
      if (!responseListener.current) {
        // Rimuovi prima eventuali listener esistenti per evitare duplicati
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
        
        // Configura il nuovo listener per le risposte alle notifiche
        responseListener.current = Notifications.addNotificationResponseReceivedListener(onNotificationResponseReceived);
      }
    }
    
    // Gestione cambio di stato dell'applicazione (background, foreground)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      logger.log(`App cambia stato: ${nextAppState}`);
      
      // Se l'app torna in foreground e l'utente è autenticato, aggiorna lo stato dell'utente
      if (nextAppState === 'active' && isAuthenticated) {
        logger.log('App tornata in foreground, aggiorno stato utente');
        handleManualRefresh();
      }
    };
    
    // Gestione visibilità pagina specifica per browser
    const handleVisibilityChange = () => {
      if (Platform.OS === 'web' && document.visibilityState === 'visible' && isAuthenticated) {
        logger.log('Pagina tornata visibile, aggiorno stato utente');
        
        // Verifica che il token sia ancora presente
        AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN).then(token => {
          if (token) {
            handleManualRefresh();
          } else if (isAuthenticated) {
            // Se il token è scomparso ma lo stato è autenticato, verifica l'autenticazione o esci
            logger.warn('Token mancante ma stato autenticato, verifico autenticazione');
            refreshUserStatus();
          }
        });
      }
    };
    
    // Aggiungi listener per il cambio di stato dell'app
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Aggiungi listener di visibilità pagina per browser
    if (Platform.OS === 'web') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    // Controlla periodicamente lo stato di autenticazione (ogni 5 minuti)
    const authCheckInterval = setInterval(() => {
      if (isAuthenticated) {
        // Verifica la validità del token
        AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN).then(token => {
          if (token) {
            // Refresh silenzioso
            refreshUserStatus().catch(err => {
              logger.error('Errore nel refresh periodico:', err);
            });
          }
        });
      }
    }, 5 * 60 * 1000); // 5 minuti
    
    // Verifica lo stato iniziale dopo il montaggio
    if (isAuthenticated) {
      AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN).then(token => {
        if (!token && isAuthenticated) {
          // Stato incoerente: autenticato ma senza token
          logger.warn('Stato incoerente: autenticato ma senza token');
          refreshUserStatus();
        }
      });
    }
    
    // Pulisci listener e intervalli alla smontaggio
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      subscription.remove();
      
      if (Platform.OS === 'web') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      
      clearInterval(authCheckInterval);
    };
  }, [isAuthenticated, user]);

  // Gestione dei tentativi di refresh in caso di problemi
  const handleManualRefresh = () => {
    setRefreshAttempts(prev => prev + 1);
    refreshUserStatus();
  };

  // Quando l'utente tocca una notifica
  const onNotificationResponseReceived = (response: Notifications.NotificationResponse) => {
    if (isNavigating) return; // Previene navigazioni multiple
    
    const { data } = response.notification.request.content;
    logger.log('Risposta alla notifica:', data);
    
    // Gestione semplificata della navigazione
    try {
      if (data?.type === 'notifica' && data?.id) {
        // Verifica che l'id sia un numero valido
        const notificaId = parseInt(String(data.id), 10);
        if (!isNaN(notificaId) && notificaId > 0) {
          logger.log(`Navigazione alla notifica ID: ${notificaId}`);
          // Passa l'ID come parametro numerico
          safeNavigate('/notifiche/[id]', {id: String(notificaId)});
        } else {
          logger.error(`ID notifica non valido nei dati della notifica: ${data.id}`);
          // Per evitare loop, prima disattiviamo temporaneamente la navigazione
          setIsNavigating(true);
          setTimeout(() => {
            safeNavigate('/notifiche/index');
          }, 500);
        }
      } else if (data?.type === 'notifica') {
        logger.log('Navigazione alla lista notifiche');
        // Per evitare loop, prima disattiviamo temporaneamente la navigazione
        setIsNavigating(true);
        setTimeout(() => {
          safeNavigate('/notifiche/index');
        }, 500);
      } else if (data?.type === 'lotto') {
        safeNavigate('/(tabs)/lotti');
      } else {
        safeNavigate('/');
      }
    } catch (error) {
      logger.error('Errore durante la navigazione dalla notifica:', error);
      safeNavigate('/');
    }
  };

  // Mostra un loader mentre l'app verifica lo stato di autenticazione
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Caricamento in corso...</Text>
      </View>
    );
  }

  // Se c'è un errore e troppi tentativi di refresh
  if (error && refreshAttempts > 2) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Si è verificato un errore: {error}</Text>
        <Text style={styles.errorMessage}>
          L'applicazione ha riscontrato un problema durante il caricamento. 
          Prova a ricaricare o a controllare la tua connessione.
        </Text>
        <Button 
          mode="contained" 
          onPress={handleManualRefresh}
          style={styles.refreshButton}
        >
          Riprova
        </Button>
      </View>
    );
  }

  // Se l'utente non è autenticato, mostra la schermata di login
  if (!isAuthenticated || !user) {
    logger.log('RootLayoutNav - Utente non autenticato, mostrando LoginScreen');
    
    // Verifica aggiuntiva asincrona, ma senza bloccare il rendering
    if (!isLoading) {
      (async () => {
        try {
          // Controlla se abbiamo dati utente locali
          const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
          const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
          
          // Se abbiamo dati utente e token, ma lo stato è non autenticato, prova a forzare un refresh
          if (userData && token && !isAuthenticated) {
            logger.log('RootLayoutNav - Dati utente trovati in storage nonostante stato non autenticato, forzando refresh...');
            refreshUserStatus();
          }
        } catch (error) {
          logger.error('RootLayoutNav - Errore verifica supplementare:', error);
        }
      })();
    }
    
    // Torniamo ad usare View per evitare errori di tipo con Slot
    return (
      <View style={{ flex: 1 }}>
        <LoginScreen />
      </View>
    );
  }

  // Se l'utente è autenticato, mostra il contenuto principale dell'app
  logger.log('RootLayoutNav - Utente autenticato, mostrando (tabs)');
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        // Disabilita le animazioni tra le schermate per ridurre le possibilità di errori di navigazione
        animation: 'none'
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="admin/utenti/index" />
      <Stack.Screen name="admin/utenti/nuovo" />
      <Stack.Screen name="admin/utenti/modifica/[id]" />
      <Stack.Screen name="admin/utenti/operatori/[id]" />
      <Stack.Screen name="lotti/nuovo" options={{ headerShown: false }} />
      <Stack.Screen name="notifiche/index" options={{ headerShown: false }} />
      <Stack.Screen name="notifiche/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#d32f2f',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  refreshButton: {
    marginTop: 16,
    paddingHorizontal: 24,
  },
});
