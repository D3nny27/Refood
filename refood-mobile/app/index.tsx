import React, { useEffect } from 'react';
import LoginScreen from '../src/screens/LoginScreen';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function IndexPage() {
  const params = useLocalSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  
  // Redirect automatico alla home se già autenticato
  // Manteniamo questo comportamento per permettere all'utente di tornare alla home
  // se in qualche modo atterra sulla schermata di login pur essendo già autenticato
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      console.log('index.tsx - Utente già autenticato, reindirizzamento a (tabs)');
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading]);
  
  // Mostra un indicatore di caricamento durante la verifica dell'autenticazione
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }
  
  // Mostra LoginScreen solo quando l'utente non è autenticato
  // Questo viene sempre mostrato per utenti non autenticati, indipendentemente
  // dal comportamento generale del layout
  if (!isAuthenticated) {
    return <LoginScreen />;
  }
  
  // Se siamo qui, l'utente è autenticato ma non abbiamo ancora reindirizzato
  // Mostra un caricamento mentre avviene il reindirizzamento
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#4CAF50" />
    </View>
  );
} 