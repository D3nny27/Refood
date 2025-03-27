import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, useTheme, Avatar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, testDirectLogin } from '../src/services/authService';
import { STORAGE_KEYS } from '../src/config/constants';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Funzione per normalizzare le credenziali prima dell'invio
  const normalizeCredentials = (email: string, password: string) => {
    // Rimuove spazi extra all'inizio e alla fine
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    
    console.log('[LOGIN] Normalizzazione credenziali');
    console.log('[LOGIN] Email originale lunghezza:', email.length, 'normalizzata lunghezza:', trimmedEmail.length);
    console.log('[LOGIN] Password originale lunghezza:', password.length, 'normalizzata lunghezza:', trimmedPassword.length);
    
    return { email: trimmedEmail, password: trimmedPassword };
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setLoginError('');
    
    try {
      // Normalizza le credenziali
      const { email: normalizedEmail, password: normalizedPassword } = normalizeCredentials(email, password);
      
      if (normalizedEmail !== email || normalizedPassword !== password) {
        console.log('[LOGIN] Credenziali normalizzate, spazi rimossi');
      }
      
      // Log dettagliati per debug
      console.log(`[LOGIN] Tentativo di login con email: ${normalizedEmail}`);
      console.log(`[LOGIN] Lunghezza password: ${normalizedPassword.length} caratteri`);
      
      // Verifica le credenziali prima di inviarle
      if (!normalizedEmail.includes('@')) {
        setLoginError('L\'email non è in un formato valido');
        setIsLoading(false);
        return;
      }
      
      if (normalizedPassword.length < 6) {
        setLoginError('La password deve contenere almeno 6 caratteri');
        setIsLoading(false);
        return;
      }
      
      // Prima rimuoviamo i token esistenti per evitare conflitti
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      console.log('[LOGIN] Token esistenti rimossi per pulizia');
      
      // Se le credenziali sono quelle specifiche, usiamo il test diretto
      if (normalizedEmail === 'admin@refood.org' && normalizedPassword === 'admin123') {
        console.log('[LOGIN] Rilevate credenziali di test, utilizzo metodo diretto');
        
        try {
          const testResult = await testDirectLogin(normalizedEmail, normalizedPassword);
          
          if (testResult.success) {
            console.log('[LOGIN] Login diretto completato con successo');
            navigation.replace('(app)');
            return;
          } else {
            console.error('[LOGIN] Login diretto fallito:', testResult.message);
            setLoginError(`Login diretto fallito: ${testResult.message}`);
            setIsLoading(false);
            return;
          }
        } catch (directError: any) {
          console.error('[LOGIN] Errore nel login diretto:', directError);
          setLoginError(`Errore nel metodo diretto: ${directError.message}`);
          // Non ritorniamo, ma procediamo con il metodo normale
        }
      }
      
      // Effettua il login normale
      try {
        console.log('[LOGIN] Tentativo di login normale con authService.loginUser');
        const response = await loginUser(normalizedEmail, normalizedPassword);
        
        console.log('[LOGIN] Risposta loginUser:', JSON.stringify(response, null, 2));
        
        if (response && response.token) {
          console.log('[LOGIN] Login completato con successo, token ricevuto');
          navigation.replace('(app)');
        } else {
          console.error('[LOGIN] Login fallito - risposta non valida:', response);
          setLoginError('Risposta del server incompleta. Controlla i log per maggiori dettagli.');
        }
      } catch (loginError: any) {
        console.error('[LOGIN] Errore nel login normale:', loginError);
        
        // Gestione dettagliata degli errori di login
        if (loginError.response) {
          console.error('[LOGIN] Dettagli risposta:', loginError.response.status, loginError.response.data);
          
          // Errori specifici in base allo status code
          if (loginError.response.status === 401) {
            setLoginError('Credenziali non valide. Controlla email e password.');
          } else if (loginError.response.status === 429) {
            setLoginError('Troppi tentativi di accesso. Riprova più tardi.');
          } else {
            setLoginError(`Errore dal server: ${loginError.response.status} - ${loginError.response.data?.message || 'Errore sconosciuto'}`);
          }
        } else if (loginError.message.includes('Network Error')) {
          setLoginError('Errore di connessione. Verifica la tua rete e che il server sia in esecuzione.');
        } else {
          setLoginError(`Errore di login: ${loginError.message || 'Errore sconosciuto'}`);
        }
      }
    } catch (error: any) {
      // Log dettagliato dell'errore
      console.error('[LOGIN] Errore generale durante il login:', error);
      if (error.response) {
        console.error('[LOGIN] Risposta server:', error.response.status, error.response.data);
      }
      
      // Gestione personalizzata degli errori
      if (error.response && error.response.status === 401) {
        setLoginError('Credenziali non valide. Controlla email e password.');
      } else if (error.response && error.response.status === 429) {
        setLoginError('Troppi tentativi di accesso. Riprova più tardi.');
      } else if (error.message && error.message.includes('Network Error')) {
        setLoginError('Errore di connessione. Verifica la tua connessione internet.');
      } else {
        setLoginError(`Errore durante il login: ${error.message || 'Errore sconosciuto'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToDebug = () => {
    navigation.navigate('debug/auth');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <Avatar.Icon 
            size={120} 
            icon="food-apple" 
            color="#fff"
            style={{backgroundColor: theme.colors.primary}}
          />
          <Text style={styles.title}>Refood</Text>
          <Text style={styles.subtitle}>La tua app per la gestione degli alimenti</Text>
        </View>

        <View style={styles.formContainer}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            disabled={isLoading}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            style={styles.input}
            disabled={isLoading}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />

          {loginError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{loginError}</Text>
            </View>
          ) : null}

          <Button
            mode="contained"
            onPress={handleLogin}
            style={styles.loginButton}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator animating={true} color={theme.colors.surface} />
            ) : (
              'Accedi'
            )}
          </Button>

          <Button
            mode="text"
            onPress={() => Alert.alert('Info', 'Contatta l\'amministratore per assistenza')}
            style={styles.forgotButton}
            disabled={isLoading}
          >
            Password dimenticata?
          </Button>
          
          <Button
            mode="text"
            onPress={navigateToDebug}
            style={styles.debugButton}
          >
            Strumenti di diagnosi
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    color: '#666',
  },
  formContainer: {
    width: '100%',
  },
  input: {
    marginBottom: 16,
  },
  loginButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  forgotButton: {
    marginTop: 8,
  },
  debugButton: {
    marginTop: 32,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 4,
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
  },
}); 