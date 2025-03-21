import { Stack, Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, Platform, AppState, AppStateStatus } from 'react-native';
import { PaperProvider, MD3LightTheme as DefaultTheme, Button } from 'react-native-paper';
import { PRIMARY_COLOR } from '../src/config/constants';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import LoginScreen from '../src/screens/LoginScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../src/config/constants';
import Toast from 'react-native-toast-message';
import logger from '../src/utils/logger';

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
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
      <Toast />
    </PaperProvider>
  );
}

// Componente per la navigazione condizionale in base allo stato di autenticazione
function RootLayoutNav() {
  const { user, isLoading, error, refreshUserStatus, isAuthenticated } = useAuth();
  const [refreshAttempts, setRefreshAttempts] = useState(0);

  // Log per debug
  useEffect(() => {
    logger.log('RootLayoutNav - isAuthenticated:', isAuthenticated);
    logger.log('RootLayoutNav - user:', user ? `${user.email} (${user.ruolo})` : 'null');
  }, [user, isAuthenticated]);

  // Effetto per gestire cambiamenti di stato dell'app
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // L'app è tornata in primo piano, aggiorna lo stato dell'utente
        logger.log('App tornata attiva, verifico autenticazione...');
        refreshUserStatus().catch(err => {
          logger.error('Errore durante il refresh al ritorno attivo:', err);
        });
      }
    };
    
    // Per il web, aggiungiamo listener per visibilitychange
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.log('Documento tornato visibile, verifico autenticazione...');
        refreshUserStatus().catch(err => {
          logger.error('Errore durante il refresh dopo visibilitychange:', err);
        });
      }
    };
    
    // Aggiungi listener per i cambiamenti di stato dell'app
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Per il web, aggiungi listener per visibility change
    if (!Platform.isTV && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    // Pulizia al dismount
    return () => {
      subscription.remove();
      if (!Platform.isTV && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [refreshUserStatus]);

  // Gestione dei tentativi di refresh in caso di problemi
  const handleManualRefresh = () => {
    setRefreshAttempts(prev => prev + 1);
    refreshUserStatus();
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
          const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
          
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
    
    // Invece di usare <LoginScreen /> direttamente, includiamolo in una View per evitare problemi di navigazione
    return (
      <View style={{ flex: 1 }}>
        <LoginScreen />
      </View>
    );
  }

  // Se l'utente è autenticato, mostra il contenuto principale dell'app
  logger.log('RootLayoutNav - Utente autenticato, mostrando (tabs)');
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      {/* La route "lotti" nell'errore si riferisce probabilmente a un percorso nidificato errato */}
      {/* Le route per i lotti devono essere definite correttamente nel file */}
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
