import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet, ScrollView } from 'react-native';
import * as AuthService from '../services/authService';
import axios from 'axios';
import { API_URL, BACKUP_API_URLS } from '../config/constants';
import { Platform } from 'react-native';

// Funzione di test della connessione API
const testApiConnection = async () => {
  try {
    const response = await axios.get(`${API_URL}/health`);
    return {
      success: true,
      message: 'Connessione API stabilita',
      data: {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Connessione API fallita: ${error.message}`,
      data: {
        error: error.message
      }
    };
  }
};

const AuthDebug = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [apiConfig, setApiConfig] = useState<any>(null);

  // Carica configurazione API all'avvio
  useEffect(() => {
    setApiConfig({
      currentUrl: API_URL,
      backupUrls: BACKUP_API_URLS,
      platform: Platform.OS,
      isDev: __DEV__
    });
  }, []);

  const handleTestApiConnection = async () => {
    setIsLoading(true);
    setResults('Test in corso...');
    try {
      const response = await testApiConnection();
      setResults(JSON.stringify(response, null, 2));
    } catch (error: any) {
      setResults(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Connessione API</Text>
        <Button
          title="Test Connessione API Default"
          onPress={handleTestApiConnection}
          disabled={isLoading}
        />
        <Button
          title="Trova API URL Funzionante"
          onPress={async () => {
            setIsLoading(true);
            setResults('Ricerca URL funzionante in corso...');
            try {
              const workingUrl = await AuthService.findWorkingApiUrl();
              if (workingUrl) {
                setResults(`URL API funzionante trovato: ${workingUrl}`);
              } else {
                setResults('Nessun URL API funzionante trovato. Verifica la connessione di rete e che il server sia in esecuzione.');
              }
            } catch (error: any) {
              setResults(`Errore: ${error.message}`);
            } finally {
              setIsLoading(false);
            }
          }}
          disabled={isLoading}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verifica Risposta Server</Text>
        <Text style={styles.label}>Endpoint da testare:</Text>
        <TextInput
          style={styles.input}
          value={endpoint || '/health'}
          onChangeText={setEndpoint}
          placeholder="Endpoint da testare (es. /health)"
        />
        <Button
          title="Test Risposta Server"
          onPress={async () => {
            if (!endpoint) {
              setResults('Inserisci un endpoint da testare');
              return;
            }
            
            setIsLoading(true);
            setResults('Test in corso...');
            try {
              // Crea axios senza interceptor
              const directAxios = axios.create({
                baseURL: API_URL,
                timeout: 5000,
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                }
              });
              
              // Rimuovi la barra iniziale se presente
              const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
              
              const response = await directAxios.get(`${API_URL}/${cleanEndpoint}`);
              setResults(JSON.stringify(response.data, null, 2));
            } catch (error: any) {
              setResults(`Errore: ${error.message}\nDettagli: ${JSON.stringify(error.response?.data || {}, null, 2)}`);
            } finally {
              setIsLoading(false);
            }
          }}
          disabled={isLoading}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Login con Varianti</Text>
        <Text style={styles.label}>Email:</Text>
        <TextInput
          style={styles.input}
          value={testEmail}
          onChangeText={setTestEmail}
          placeholder="Email da testare"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Password:</Text>
        <TextInput
          style={styles.input}
          value={testPassword}
          onChangeText={setTestPassword}
          placeholder="Password da testare"
          secureTextEntry
        />
        <Button
          title="Test Login con Varianti"
          onPress={async () => {
            setIsLoading(true);
            setResults('Test in corso...');
            try {
              const response = await AuthService.testDirectLoginVariants(testEmail, testPassword);
              setResults(JSON.stringify(response, null, 2));
            } catch (error: any) {
              setResults(`Errore: ${error.message}`);
            } finally {
              setIsLoading(false);
            }
          }}
          disabled={isLoading || !testEmail || !testPassword}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reset Admin Password</Text>
        <TextInput
          style={styles.input}
          value={adminEmail}
          onChangeText={setAdminEmail}
          placeholder="Email admin (default: admin@refood.org)"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={newAdminPassword}
          onChangeText={setNewAdminPassword}
          placeholder="Nuova password"
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          value={adminKey}
          onChangeText={setAdminKey}
          placeholder="Chiave admin (richiedi al team)"
          secureTextEntry
        />
        <Button
          title="Reset Password Admin"
          onPress={async () => {
            if (!adminEmail || !newAdminPassword || !adminKey) {
              Alert.alert('Errore', 'Compila tutti i campi');
              return;
            }
            
            setIsLoading(true);
            setResults('Reset in corso...');
            try {
              // Verifica se la funzione resetAdminPassword esiste
              if (!AuthService.resetAdminPassword) {
                throw new Error("Funzione resetAdminPassword non disponibile");
              }
              
              // Ora passiamo anche la chiave admin come terzo parametro
              const response = await AuthService.resetAdminPassword(
                adminEmail || 'admin@refood.org',
                newAdminPassword,
                adminKey
              );
              
              setResults(JSON.stringify(response, null, 2));
              if (response.success) {
                Alert.alert('Successo', 'Password admin resettata');
              }
            } catch (error: any) {
              setResults(`Errore: ${error.message}`);
              Alert.alert('Errore', error.message);
            } finally {
              setIsLoading(false);
            }
          }}
          disabled={isLoading || !adminEmail || !newAdminPassword || !adminKey}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Login Diretto</Text>
        <Text style={styles.label}>Email:</Text>
        <TextInput
          style={styles.input}
          value={testEmail}
          onChangeText={setTestEmail}
          placeholder="Email da testare"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Password:</Text>
        <TextInput
          style={styles.input}
          value={testPassword}
          onChangeText={setTestPassword}
          placeholder="Password da testare"
          secureTextEntry
        />
        <Button
          title="Test Login Diretto"
          onPress={async () => {
            setIsLoading(true);
            setResults('Test in corso...');
            try {
              const response = await AuthService.testDirectLogin(testEmail, testPassword);
              setResults(JSON.stringify(response, null, 2));
            } catch (error: any) {
              setResults(`Errore: ${error.message}`);
            } finally {
              setIsLoading(false);
            }
          }}
          disabled={isLoading || !testEmail || !testPassword}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verifica Credenziali Admin</Text>
        <Text style={styles.label}>Email:</Text>
        <TextInput
          style={styles.input}
          value={testEmail}
          onChangeText={setTestEmail}
          placeholder="Email da verificare (es. admin@refood.org)"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Password:</Text>
        <TextInput
          style={styles.input}
          value={testPassword}
          onChangeText={setTestPassword}
          placeholder="Password da verificare"
          secureTextEntry
        />
        <Button
          title="Verifica Credenziali Admin"
          onPress={async () => {
            setIsLoading(true);
            setResults('Verifica in corso...');
            try {
              const response = await AuthService.verifyAdminCredentials(testEmail, testPassword);
              setResults(JSON.stringify(response, null, 2));
            } catch (error: any) {
              setResults(`Errore: ${error.message}`);
            } finally {
              setIsLoading(false);
            }
          }}
          disabled={isLoading || !testEmail || !testPassword}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configurazione API</Text>
        {apiConfig && (
          <View style={styles.resultItem}>
            <Text style={styles.boldText}>URL API Attuale:</Text>
            <Text>{apiConfig.currentUrl}</Text>
            
            <Text style={[styles.boldText, {marginTop: 10}]}>URL di Backup:</Text>
            {apiConfig.backupUrls.map((url: string, index: number) => (
              <Text key={index}>• {url}</Text>
            ))}
            
            <Text style={[styles.boldText, {marginTop: 10}]}>Piattaforma: {apiConfig.platform}</Text>
            <Text>Modalità: {apiConfig.isDev ? 'Sviluppo' : 'Produzione'}</Text>
          </View>
        )}
        <Button
          title="Testa Tutti gli URL API"
          onPress={async () => {
            setIsLoading(true);
            setResults('Test di tutti gli URL API in corso...');
            try {
              const workingUrl = await AuthService.testAllApiUrls();
              if (workingUrl) {
                setResults(`URL API funzionante trovato: ${workingUrl}\n\nDettagli: ${JSON.stringify({
                  currentUrl: API_URL,
                  workingUrl,
                  isCurrentWorking: workingUrl === API_URL,
                  platform: Platform.OS
                }, null, 2)}`);
              } else {
                setResults('Nessun URL API funzionante trovato. Verifica la connessione di rete e che il server sia in esecuzione.');
              }
            } catch (error: any) {
              setResults(`Errore: ${error.message}`);
            } finally {
              setIsLoading(false);
            }
          }}
          disabled={isLoading}
        />
      </View>

      <Text style={styles.label}>Risultati:</Text>
      <Text style={styles.results}>{results}</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
  },
  results: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginTop: 10,
    backgroundColor: '#f9f9f9',
    minHeight: 100,
  },
  resultItem: {
    marginBottom: 10,
  },
  boldText: {
    fontWeight: 'bold' as const,
  },
});

export default AuthDebug; 