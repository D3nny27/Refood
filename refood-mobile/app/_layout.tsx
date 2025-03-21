import { Stack, Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, Platform } from 'react-native';
import { PaperProvider, MD3LightTheme as DefaultTheme, Button } from 'react-native-paper';
import { PRIMARY_COLOR } from '../src/config/constants';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import LoginScreen from '../src/screens/LoginScreen';

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
    </PaperProvider>
  );
}

// Componente per la navigazione condizionale in base allo stato di autenticazione
function RootLayoutNav() {
  const { user, isLoading, error, refreshUserStatus } = useAuth();
  const [refreshAttempts, setRefreshAttempts] = useState(0);

  // Effetto per il refresh periodico dello stato utente (solo in ambiente web)
  useEffect(() => {
    // Su web, monitoriamo lo stato della connessione e aggiorniamo lo stato quando l'app torna in primo piano
    if (Platform.OS === 'web') {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('Documento tornato visibile, aggiorno lo stato utente');
          refreshUserStatus();
        }
      };

      // Aggiungi listener per la visibilità del documento
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Pulisci il listener quando il componente viene smontato
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
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
  if (!user) {
    return <LoginScreen />;
  }

  // Se l'utente è autenticato, mostra il contenuto principale dell'app
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
