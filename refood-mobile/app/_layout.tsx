import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { PaperProvider, MD3LightTheme as DefaultTheme } from 'react-native-paper';
import { PRIMARY_COLOR } from '../src/config/constants';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { NotificheProvider } from '../src/context/NotificheContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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

// Componente per proteggere le route autenticate
function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
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
  }, [isAuthenticated, segments, isLoading, router]);

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
    <PaperProvider theme={theme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <NotificheProvider>
            <RootLayoutNav />
            <Toast />
          </NotificheProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </PaperProvider>
  );
}
