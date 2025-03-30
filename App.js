import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import { LogBox } from 'react-native';
import { expo } from './app.json';

// Disabilita completamente i log di errore e warning in React Native
// Questo rimuoverà tutti i messaggi di errore e warning dall'interfaccia utente
LogBox.ignoreAllLogs();

// Tema personalizzato per react-native-paper
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#4CAF50',
    accent: '#FF9800',
  },
};

/**
 * App.js è ora solo un punto di ingresso che carica il provider di autenticazione.
 * La navigazione è interamente gestita da expo-router nella cartella app/.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          {/* Expo Router gestisce tutta la navigazione */}
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
} 