import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../../src/context/AuthContext';
import { RUOLI } from '../../src/config/constants';
import { router } from 'expo-router';
import { Alert } from 'react-native';

export default function AdminLayout() {
  const { user } = useAuth();
  
  // Verifica che l'utente sia un amministratore
  useEffect(() => {
    if (!user || user.ruolo !== RUOLI.AMMINISTRATORE) {
      Alert.alert(
        'Accesso non autorizzato',
        'Questa sezione è riservata agli amministratori',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
    }
  }, [user]);

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#4CAF50',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    />
  );
} 