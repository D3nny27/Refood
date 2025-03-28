import { Stack, router } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, Platform, AppState, AppStateStatus } from 'react-native';
import { PaperProvider, MD3LightTheme as DefaultTheme, Button, Portal, Dialog, Snackbar } from 'react-native-paper';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Definizione di colori per il tema
const ERROR_COLOR = '#D32F2F';
const SUCCESS_COLOR = '#4CAF50';
const INFO_COLOR = '#2196F3';
const WARNING_COLOR = '#FFC107';

// Definizione del tema personalizzato per react-native-paper
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: PRIMARY_COLOR,
    secondary: '#FF9800',
    error: ERROR_COLOR,
    success: SUCCESS_COLOR,
    info: INFO_COLOR,
    warning: WARNING_COLOR,
  },
  roundness: 12,
};

// Verifica se siamo in ambiente SSR
const isSSR = () => typeof window === 'undefined';

// Wrapper sicuro per AsyncStorage che gestisce l'ambiente SSR
const safeAsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (isSSR()) {
      console.log('Ambiente SSR: AsyncStorage.getItem non disponibile');
      return null;
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Errore in AsyncStorage.getItem(${key}):`, error);
      return null;
    }
  }
};

// Componente RootLayout che definisce la struttura principale dell'app
export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <NavigationStructure />
        </AuthProvider>
      </GestureHandlerRootView>
    </PaperProvider>
  );
}

// Componente per gestire la navigazione dopo che AuthProvider è inizializzato
function NavigationStructure() {
  const { isAuthenticated } = useAuth();
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Configurazione per Stack.Screen
  const screenOptions = {
    headerShown: false,
  };

  return (
    <NotificheProvider>
      <Stack 
        screenOptions={screenOptions}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="lotti/disponibili" />
        <Stack.Screen name="lotti/nuovo" />
        <Stack.Screen name="lotti/dettaglio/[id]" />
        <Stack.Screen name="notifiche/[id]" />
        <Stack.Screen name="notifiche/index" />
        <Stack.Screen name="prenotazioni/index" />
        <Stack.Screen name="register/index" />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="test-radio" />
      </Stack>

      {/* Snackbar per notifiche del sistema */}
      <Snackbar
        visible={notificationVisible}
        onDismiss={() => setNotificationVisible(false)}
        duration={3000}
        action={{
          label: 'Chiudi',
          onPress: () => setNotificationVisible(false),
        }}
        style={styles.snackbar}
      >
        {notificationMessage}
      </Snackbar>

      {/* Toast personalizzato */}
      <Toast />
    </NotificheProvider>
  );
}

// Componente per la navigazione condizionale in base allo stato di autenticazione
function RootLayoutNav() {
  const { user, isLoading, error, refreshUserStatus, isAuthenticated } = useAuth();
  const [refreshAttempts, setRefreshAttempts] = useState(0);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const [isNavigating, setIsNavigating] = useState(false); // Previene navigazione multipla
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);

  // Log per debug
  useEffect(() => {
    logger.log('RootLayoutNav - isAuthenticated:', isAuthenticated);
    logger.log('RootLayoutNav - user:', user ? `${user.email} (${user.ruolo})` : 'null');
  }, [user, isAuthenticated]);
  
  // Listener per eventi di token JWT scaduto usando il sistema di eventi personalizzato
  useEffect(() => {
    const handleJwtExpired = () => {
      logger.warn('Evento JWT scaduto rilevato in RootLayoutNav');
      
      // Naviga alla schermata di login dopo un breve ritardo
      setTimeout(() => {
        // Utilizza safeNavigate per prevenire navigazioni multiple
        if (!isNavigating) {
          setIsNavigating(true);
          
          router.replace('/');
          
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

  // Effetto per configurare le notifiche push
  useEffect(() => {
    // Configura le notifiche push solo se l'utente è autenticato
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
              } else {
                logger.warn('Impossibile registrare il token push con il server');
              }
            } catch (regError) {
              logger.error('Errore durante la registrazione del token push:', regError);
            }
            
            // Imposta i listener per le notifiche
            notificationListener.current = Notifications.addNotificationReceivedListener(
              notification => {
                logger.log('Notifica ricevuta:', notification);
                
                // Mostra un toast quando la notifica arriva mentre l'app è in primo piano
                Toast.show({
                  type: 'info',
                  text1: notification.request.content.title || 'Nuova notifica',
                  text2: notification.request.content.body || '',
                  visibilityTime: 4000,
                  topOffset: 50,
                  onPress: () => {
                    // Gestisci il tocco del toast come se fosse stata toccata la notifica stessa
                    const { data } = notification.request.content;
                    if (data?.type === 'notifica' && data?.id) {
                      // Verifica che l'ID sia un numero valido
                      const notificaId = parseInt(String(data.id), 10);
                      if (!isNaN(notificaId)) {
                        logger.log(`Toast: navigazione alla notifica ID ${notificaId}`);
                        safeNavigate('/notifiche/[id]', {id: String(notificaId)});
                      } else {
                        logger.warn(`Toast: ID notifica non valido ${data.id}, navigazione alla lista`);
                        safeNavigate('/notifiche/index');
                      }
                    } else if (data?.type === 'notifica') {
                      safeNavigate('/notifiche/index');
                    }
                  }
                });
              }
            );
            
            responseListener.current = Notifications.addNotificationResponseReceivedListener(
              response => onNotificationResponseReceived(response)
            );
          } else {
            logger.warn('Non è stato possibile configurare le notifiche push');
          }
        } catch (error) {
          logger.error('Errore durante la configurazione delle notifiche push:', error);
        }
      };
      
      configurePushNotifications();
      
      // Cleanup dei listener
      return () => {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      };
    }
  }, [isAuthenticated, user]);

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

  // Gestione dei tentativi di refresh in caso di problemi
  const handleManualRefresh = () => {
    setRefreshAttempts(prev => prev + 1);
    setErrorDialogVisible(false);
    refreshUserStatus();
  };

  // Mostra un loader migliorato mentre l'app verifica lo stato di autenticazione
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingTitle}>Refood</Text>
          <Text style={styles.loadingText}>Caricamento in corso...</Text>
        </View>
      </View>
    );
  }

  // Se c'è un errore e troppi tentativi di refresh
  if (error && refreshAttempts > 2) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={80} color={ERROR_COLOR} />
        <Text style={styles.errorTitle}>Oops!</Text>
        <Text style={styles.errorText}>Si è verificato un errore durante il caricamento</Text>
        <Text style={styles.errorMessage}>
          L'applicazione ha riscontrato un problema. Prova a ricaricare o a controllare la tua connessione.
        </Text>
        
        <Button 
          mode="contained" 
          onPress={() => setErrorDialogVisible(true)}
          style={styles.errorButton}
          icon="refresh"
        >
          Riprova
        </Button>
        
        <Portal>
          <Dialog visible={errorDialogVisible} onDismiss={() => setErrorDialogVisible(false)}>
            <Dialog.Icon icon="alert" />
            <Dialog.Title style={styles.dialogTitle}>Dettagli errore</Dialog.Title>
            <Dialog.Content>
              <Text style={styles.dialogContent}>{error}</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setErrorDialogVisible(false)}>Annulla</Button>
              <Button onPress={handleManualRefresh} mode="contained">Riprova</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
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
          const userData = await safeAsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
          const token = await safeAsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
          
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
    
    // IMPORTANTE: Non facciamo più un reindirizzamento automatico qui
    // Il reindirizzamento avviene esplicitamente dalle funzioni di logout
    // Questo permette di evitare reindirizzamenti indesiderati
    logger.log('RootLayoutNav - Mostrando la struttura completa, la navigazione sarà gestita dalle pagine');
    
    // Stack completo che permette il reindirizzamento esplicito
    // La principale differenza è che ora usiamo lo stesso Stack in entrambi i casi
    // (utente autenticato e non autenticato) per evitare inconsistenze
    return (
      <Stack>
        <Stack.Screen 
          name="index"
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen 
          name="(tabs)"
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen 
          name="home/index"
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen 
          name="register/index"
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen 
          name="dashboard/index"
          options={{
            headerShown: false
          }}
        />
      </Stack>
    );
  }

  // Se l'utente è autenticato, mostra lo stesso Stack con tutte le schermate disponibili
  // Questo assicura consistenza quando lo stato di autenticazione cambia
  logger.log('RootLayoutNav - Utente autenticato, mostrando Stack completo');
  return (
    <Stack>
      <Stack.Screen 
        name="index"
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="(tabs)"
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="register/index"
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="home/index"
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="dashboard/index"
        options={{
          headerShown: false
        }}
      />
    </Stack>
  );
}

// Stili migliorati con design moderno
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginTop: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 30,
  },
  errorTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: ERROR_COLOR,
    marginTop: 20,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  errorButton: {
    paddingHorizontal: 24,
    borderRadius: 30,
    marginTop: 16,
    backgroundColor: PRIMARY_COLOR,
    elevation: 4,
  },
  dialogTitle: {
    color: '#333',
  },
  dialogContent: {
    color: '#555',
    lineHeight: 22,
  },
  snackbar: {
    marginBottom: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
  },
});
