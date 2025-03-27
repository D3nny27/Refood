import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, Appbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthDebug from '../../src/components/AuthDebug';
import { useNavigation } from '@react-navigation/native';

/**
 * Schermata di debug per risolvere problemi di autenticazione
 */
export default function AuthDebugScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Debug Autenticazione" />
      </Appbar.Header>
      
      <ScrollView style={styles.content}>
        <Text style={styles.description}>
          Questa schermata ti permette di diagnosticare e risolvere problemi relativi all'autenticazione dell'app.
        </Text>
        
        <Text style={styles.instructions}>
          Se l'app è in un ciclo infinito di autenticazione, prova a usare il pulsante "Reset Stato" per ripristinare
          il normale funzionamento. Se il problema persiste, puoi cancellare i token e rieffettuare il login.
        </Text>
        
        <AuthDebug />
        
        <View style={styles.footer}>
          <Button 
            mode="text" 
            onPress={() => navigation.goBack()}
            style={styles.footerButton}
          >
            Torna indietro
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  description: {
    fontSize: 16,
    marginBottom: 8,
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  footer: {
    marginTop: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  footerButton: {
    marginVertical: 8,
  },
}); 