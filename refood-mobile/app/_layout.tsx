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

// Componente principale
function Layout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const pathname = usePathname();
  
  // Log per debugging
  useEffect(() => {
    logger.log('Layout - isAuthenticated:', isAuthenticated);
    logger.log('Layout - user:', user ? `${user.email} (${user.ruolo})` : 'null');
    logger.log('Layout - pathname:', pathname);
  }, [isAuthenticated, user, pathname]);
  
  // Reindirizza gli utenti autenticati che sono sulla pagina iniziale (index)
  useEffect(() => {
    if (isAuthenticated && !isLoading && pathname === '/') {
      logger.log('Layout - Utente autenticato alla home, reindirizzamento a (tabs)');
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, pathname]);
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Caricamento in corso...</Text>
      </View>
    );
  }
  
  if (!isAuthenticated || !user) {
    return <LoginScreen />;
  }
  
  // Utente autenticato, renderizza i contenuti dell'app tramite Slot
  return <Slot />;
}

// Componente con i provider
export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <NotificheProvider>
            <Layout />
            <Toast />
          </NotificheProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </PaperProvider>
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
