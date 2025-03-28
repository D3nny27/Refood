import React from 'react';
import { useNavigationState } from '@react-navigation/native';
import { View, Text } from 'react-native';

// Semplice pagina vuota che non fa nulla, poiché 
// la gestione dell'autenticazione e della redirezione 
// viene gestita nel layout principale
export default function IndexPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Reindirizzamento in corso...</Text>
    </View>
  );
} 