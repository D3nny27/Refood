import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { PRIMARY_COLOR } from '../src/config/constants';

// Questo è il punto di ingresso principale dell'app
export default function IndexPage() {
  const { isAuthenticated, isLoading } = useAuth();

  // Mostra il caricamento mentre verifichiamo lo stato di autenticazione
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Caricamento in corso...</Text>
      </View>
    );
  }

  // Reindirizza in base allo stato di autenticazione (semplice)
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/login" />;
  }
}

const styles = StyleSheet.create({
  container: {
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
}); 