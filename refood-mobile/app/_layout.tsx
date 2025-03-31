import { Stack } from 'expo-router/stack';
import { router, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { PRIMARY_COLOR } from '../src/config/constants';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { NotificheProvider } from '../src/context/NotificheContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import logger from '../src/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Chiave per la preferenza del tema
const THEME_PREFERENCE_KEY = 'theme_mode';

// Tema chiaro personalizzato
const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: PRIMARY_COLOR,
    secondary: '#FF9800',
  },
};

// Tema scuro personalizzato
const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: PRIMARY_COLOR,
    secondary: '#FF9800',
  },
};

// Creiamo un contesto React per il tema
export const ThemeContext = React.createContext({
  isDarkMode: false,
  toggleTheme: () => {},
});

// Componente per proteggere le route autenticate
function RootLayoutNav() {
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    if (isLoading) return; // Non fare nulla mentre carica
    
    const inAuthGroup = segments[0] === '(tabs)';
    const inAuthRequiredPage = inAuthGroup;
    const inAuthPages = segments[0] === 'login' || segments[0] === 'register';
    
    logger.log('RootLayoutNav - Percorso:', segments.join('/'));
    logger.log('RootLayoutNav - isAuthenticated:', isAuthenticated);
    logger.log('RootLayoutNav - inAuthGroup:', inAuthGroup);
    logger.log('RootLayoutNav - inAuthPages:', inAuthPages);
    
    if (!isAuthenticated && inAuthRequiredPage) {
      // Redirect to login if accessing protected pages while not authenticated
      logger.log('RootLayoutNav - Utente non autenticato, reindirizzamento al login');
      router.replace('/login');
    } else if (isAuthenticated && inAuthPages) {
      // Redirect to home if accessing auth pages while authenticated
      logger.log('RootLayoutNav - Utente già autenticato, reindirizzamento alla home');
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

// Componente con i provider
export default function RootLayout() {
  // Stato per il tema
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Carica la preferenza del tema all'avvio
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (savedTheme === 'dark') {
          setIsDarkMode(true);
        }
      } catch (error) {
        console.error('Errore nel caricamento della preferenza del tema:', error);
      }
    };

    loadThemePreference();
  }, []);

  // Funzione per alternare il tema
  const toggleTheme = async () => {
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);
    
    try {
      await AsyncStorage.setItem(THEME_PREFERENCE_KEY, newIsDarkMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Errore nel salvataggio della preferenza del tema:', error);
    }
  };

  // Ignora warning di useLayoutEffect per il web
  React.useEffect(() => {
    // Soluzione per l'avviso useLayoutEffect sul SSR
    if (Platform.OS === 'web') {
      const originalWarn = console.warn;
      console.warn = (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) {
          return;
        }
        originalWarn(...args);
      };
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <PaperProvider theme={isDarkMode ? darkTheme : lightTheme}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthProvider>
            <NotificheProvider>
              <RootLayoutNav />
              <Toast />
            </NotificheProvider>
          </AuthProvider>
        </GestureHandlerRootView>
      </PaperProvider>
    </ThemeContext.Provider>
  );
}
