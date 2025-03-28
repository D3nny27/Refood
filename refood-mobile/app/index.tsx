import React, { useEffect, useState } from 'react';
import LoginScreen from '../src/screens/LoginScreen';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { View, ActivityIndicator, Text, Platform } from 'react-native';

export default function IndexPage() {
  const params = useLocalSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  // Stato per tenere traccia del tentativo di renderizzare il LoginScreen
  const [showingLogin, setShowingLogin] = useState(false);
  
  // Log aggiuntivo per debug
  useEffect(() => {
    console.log('IndexPage - Stato autenticazione:', isAuthenticated ? 'autenticato' : 'non autenticato');
    console.log('IndexPage - Stato caricamento:', isLoading ? 'caricamento' : 'completato');
    console.log('IndexPage - Mostrando login:', showingLogin ? 'sì' : 'no');
  }, [isAuthenticated, isLoading, showingLogin]);

  // Correzione errori di navigazione in ambiente web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = window.location.href;
      
      // Controlla se c'è un errore di navigazione nell'URL
      if (url.includes('__EXPO_ROUTER_key=undefined')) {
        console.log('IndexPage - Correzione URL problematico:', url);
        
        try {
          // Ripulisci l'URL da parametri problematici
          window.history.replaceState({}, document.title, '/');
          
          // Se il problema persiste, forza un reload della pagina
          if (!isAuthenticated && !isLoading) {
            console.log('IndexPage - Forzo reload della pagina per correggere la navigazione');
            if (url.includes('?__EXPO_ROUTER')) {
              window.location.href = '/';
            }
          }
        } catch (error) {
          console.error('IndexPage - Errore durante la correzione URL:', error);
        }
      }
    }
  }, [isAuthenticated, isLoading]);
  
  // Redirect automatico alla home se già autenticato
  // Manteniamo questo comportamento per permettere all'utente di tornare alla home
  // se in qualche modo atterra sulla schermata di login pur essendo già autenticato
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      console.log('index.tsx - Utente già autenticato, reindirizzamento a (tabs)');
      
      // Reset dello stato di visualizzazione login
      setShowingLogin(false);
      
      // Utilizziamo un piccolo timeout per assicurarci che tutto sia pronto
      setTimeout(() => {
        try {
          // Su web utilizziamo un approccio diverso per evitare problemi di routing
          if (Platform.OS === 'web') {
            console.log('index.tsx - Ambiente web: utilizzo navigazione adattata');
            router.replace('/(tabs)');
          } else {
            router.replace('/(tabs)');
          }
          console.log('index.tsx - Reindirizzamento a (tabs) completato');
        } catch (navError) {
          console.error('index.tsx - Errore durante il reindirizzamento a (tabs):', navError);
          
          // Su web, tenta di utilizzare la manipolazione diretta dell'URL come fallback
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            try {
              window.location.href = '/(tabs)';
            } catch (webError) {
              console.error('index.tsx - Anche il fallback di navigazione è fallito:', webError);
            }
          }
        }
      }, 100);
    } else if (!isAuthenticated && !isLoading) {
      // Se non è autenticato e non sta caricando, mostriamo il login
      console.log('index.tsx - Utente non autenticato, preparazione a mostrare LoginScreen');
      setShowingLogin(true);
      
      // Su web, verifica che siamo nella pagina corretta
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const url = window.location.href;
        // Se l'URL non è pulito, ripuliscilo
        if (url.includes('?') || url.includes('#')) {
          console.log('index.tsx - Pulizia URL per pagina di login');
          window.history.replaceState({}, document.title, '/');
        }
      }
    }
  }, [isAuthenticated, isLoading]);
  
  // Mostra un indicatore di caricamento durante la verifica dell'autenticazione
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={{ marginTop: 10, color: '#4CAF50' }}>Caricamento...</Text>
      </View>
    );
  }
  
  // Mostra LoginScreen quando l'utente non è autenticato
  if (!isAuthenticated) {
    console.log('index.tsx - Rendering LoginScreen');
    return <LoginScreen />;
  }
  
  // Se siamo qui, l'utente è autenticato ma non abbiamo ancora reindirizzato
  // Mostra un caricamento mentre avviene il reindirizzamento
  console.log('index.tsx - Utente autenticato, in attesa di reindirizzamento...');
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#4CAF50" />
      <Text style={{ marginTop: 10, color: '#4CAF50' }}>Reindirizzamento in corso...</Text>
    </View>
  );
} 