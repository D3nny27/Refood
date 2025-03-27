import React from 'react';
import { Stack } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { IconButton } from 'react-native-paper';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { PRIMARY_COLOR } from '../../../src/config/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function Layout() {
  const navigation = useNavigation();

  // Funzione per tornare indietro
  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <Stack screenOptions={{
      headerStyle: {
        backgroundColor: PRIMARY_COLOR,
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      headerLeft: () => (
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
      ),
      headerShadowVisible: true,
    }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Gestione Utenti',
          headerTitleAlign: 'center',
        }}
      />
      <Stack.Screen
        name="nuovo"
        options={{
          title: 'Nuovo Utente',
          headerTitleAlign: 'center',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="modifica"
        options={{
          title: 'Modifica Utente',
          headerTitleAlign: 'center',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="operatori"
        options={{
          title: 'Gestione Operatori',
          headerTitleAlign: 'center',
          presentation: 'card',
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    marginLeft: 15,
  },
}); 