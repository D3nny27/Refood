import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button, Card, Divider, TextInput } from 'react-native-paper';
import { debugAuthState, resetAuthState } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';
import { testDirectLogin } from '../services/authService';

/**
 * Componente per il debug e reset dell'autenticazione
 * Utile per risolvere problemi di loop di autenticazione
 */
const AuthDebug = () => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  // Recupera informazioni di debug
  const handleDebug = async () => {
    setLoading(true);
    try {
      const info = await debugAuthState();
      setDebugInfo(info);
    } catch (e) {
      console.error('Errore durante il debug:', e);
    } finally {
      setLoading(false);
    }
  };

  // Reset dello stato di autenticazione
  const handleReset = async () => {
    setLoading(true);
    try {
      const result = await resetAuthState();
      console.log('Risultato reset:', result);
      
      // Aggiorna le informazioni di debug dopo il reset
      const info = await debugAuthState();
      setDebugInfo({...info, resetResult: result});
    } catch (e) {
      console.error('Errore durante il reset:', e);
    } finally {
      setLoading(false);
    }
  };

  // Cancellazione completa dei token
  const handleClearTokens = async () => {
    setLoading(true);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      console.log('Token cancellati con successo');
      
      // Aggiorna le informazioni di debug
      const info = await debugAuthState();
      setDebugInfo({...info, tokensCleared: true});
    } catch (e) {
      console.error('Errore durante la cancellazione dei token:', e);
    } finally {
      setLoading(false);
    }
  };

  // Test diretto delle credenziali
  const handleTestLogin = async () => {
    if (!email || !password) {
      setTestResult({
        success: false,
        message: 'Inserisci email e password'
      });
      return;
    }

    setLoading(true);
    try {
      const result = await testDirectLogin(email, password);
      setTestResult(result);
      
      // Aggiorna le informazioni di debug dopo il test
      const info = await debugAuthState();
      setDebugInfo(info);
    } catch (e: any) {
      console.error('Errore durante il test di login:', e);
      setTestResult({
        success: false,
        message: e.message || 'Errore durante il test'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={styles.container}>
      <Card.Title title="Debug Autenticazione" />
      <Card.Content>
        <Text style={styles.description}>
          Questa schermata ti aiuta a risolvere i problemi di autenticazione.
        </Text>
        <Divider style={styles.divider} />
        
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={handleDebug}
            loading={loading}
            style={styles.button}
          >
            Diagnostica
          </Button>
          
          <Button
            mode="contained"
            onPress={handleReset}
            loading={loading}
            style={styles.button}
          >
            Reset Stato
          </Button>
          
          <Button
            mode="outlined"
            onPress={handleClearTokens}
            loading={loading}
            style={styles.button}
            textColor="red"
          >
            Cancella Token
          </Button>
        </View>

        {debugInfo && (
          <ScrollView style={styles.resultsContainer}>
            <Text style={styles.resultTitle}>Risultati Diagnostica:</Text>
            <View style={styles.resultItem}>
              <Text>Auth Token: {debugInfo.authToken ? 'Presente' : 'Assente'}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text>Refresh Token: {debugInfo.refreshToken ? 'Presente' : 'Assente'}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text>Header Authorization: {debugInfo.headerSet ? 'Impostato' : 'Non impostato'}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text>Refresh in corso: {debugInfo.pendingAuthRefresh ? 'Sì' : 'No'}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text>Errori consecutivi: {debugInfo.consecutiveAuthErrors}</Text>
            </View>
            {debugInfo.resetResult && (
              <View style={styles.resultItem}>
                <Text>Reset: {debugInfo.resetResult.success ? 'Completato' : 'Fallito'}</Text>
              </View>
            )}
            {debugInfo.tokensCleared && (
              <View style={styles.resultItem}>
                <Text style={{color: 'red'}}>Token cancellati</Text>
              </View>
            )}
            {debugInfo.error && (
              <View style={styles.resultItem}>
                <Text style={{color: 'red'}}>Errore: {debugInfo.error}</Text>
              </View>
            )}
          </ScrollView>
        )}

        <Divider style={styles.divider} />
        
        <Text style={styles.subtitle}>Test Credenziali</Text>
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          placeholder="admin@refood.org"
        />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry
          style={styles.input}
          placeholder="admin123"
        />
        <Button
          mode="contained"
          onPress={handleTestLogin}
          loading={loading}
          style={styles.fullButton}
        >
          Testa Credenziali
        </Button>

        {testResult && (
          <View style={[styles.resultItem, {marginTop: 16, backgroundColor: testResult.success ? '#e6ffe6' : '#ffe6e6'}]}>
            <Text style={{fontWeight: 'bold'}}>{testResult.success ? 'Test completato' : 'Test fallito'}</Text>
            <Text>{testResult.message}</Text>
            {testResult.data && (
              <ScrollView style={{maxHeight: 150}}>
                {Object.entries(testResult.data).map(([key, value]: [string, any]) => (
                  <Text key={key}>{key}: {typeof value === 'object' ? JSON.stringify(value) : value}</Text>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
  },
  description: {
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  button: {
    marginVertical: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  fullButton: {
    marginTop: 8
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8
  },
  input: {
    marginBottom: 8
  },
  resultsContainer: {
    maxHeight: 300,
    marginTop: 16,
  },
  resultTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultItem: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
});

export default AuthDebug; 