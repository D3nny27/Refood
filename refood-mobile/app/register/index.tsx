import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, ScrollView, Platform, ImageBackground } from 'react-native';
import { TextInput, Button, Text, HelperText, Appbar, Card, Divider, Dialog, Portal, Paragraph } from 'react-native-paper';
import { router } from 'expo-router';
import { registerUser } from '../../src/services/authService';
import { PRIMARY_COLOR } from '../../src/config/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import logger from '../../src/utils/logger';
import { useAuth } from '../../src/context/AuthContext';

const RegisterScreen = () => {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithCredentials, login } = useAuth();
  
  // Stato per i dialoghi di feedback
  const [successDialogVisible, setSuccessDialogVisible] = useState(false);
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Errori di validazione
  const [nomeError, setNomeError] = useState('');
  const [cognomeError, setCognomeError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const validateNome = () => {
    if (!nome.trim()) {
      setNomeError('Il nome è obbligatorio');
      return false;
    }
    setNomeError('');
    return true;
  };

  const validateCognome = () => {
    if (!cognome.trim()) {
      setCognomeError('Il cognome è obbligatorio');
      return false;
    }
    setCognomeError('');
    return true;
  };

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('L\'email è obbligatoria');
      return false;
    } else if (!emailRegex.test(email)) {
      setEmailError('Inserisci un indirizzo email valido');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = () => {
    if (!password) {
      setPasswordError('La password è obbligatoria');
      return false;
    } else if (password.length < 6) {
      setPasswordError('La password deve contenere almeno 6 caratteri');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const validateConfirmPassword = () => {
    if (!confirmPassword) {
      setConfirmPasswordError('Conferma la password');
      return false;
    } else if (confirmPassword !== password) {
      setConfirmPasswordError('Le password non coincidono');
      return false;
    }
    setConfirmPasswordError('');
    return true;
  };

  const handleRegister = async () => {
    // Valida tutti i campi
    const isNomeValid = validateNome();
    const isCognomeValid = validateCognome();
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    const isConfirmPasswordValid = validateConfirmPassword();

    if (isNomeValid && isCognomeValid && isEmailValid && isPasswordValid && isConfirmPasswordValid) {
      setIsLoading(true);
      
      try {
        // Per impostazione predefinita, registriamo gli utenti come "Operatore"
        const userData = {
          nome,
          cognome,
          email,
          password,
          ruolo: 'Operatore' // Ruolo predefinito
        };
        
        // Step 1: Registra l'utente
        logger.log('Avvio registrazione utente con email:', email);
        const response = await registerUser(userData);
        logger.log('Registrazione completata con successo:', response);
        
        // Step 2: Mostra un dialog che blocca l'interfaccia finché l'utente non lo conferma
        setSuccessDialogVisible(true);
        
      } catch (error: any) {
        logger.error('Errore durante la registrazione:', error);
        
        // Mostra errore all'utente con un toast
        Toast.show({
          type: 'error',
          text1: 'Registrazione fallita',
          text2: error.message || 'Si è verificato un errore durante la registrazione',
          visibilityTime: 6000,
        });
        
        // Mostra anche un dialog di errore
        setErrorMessage(error.message || 'Si è verificato un problema. Riprova più tardi.');
        setErrorDialogVisible(true);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handler per il login automatico dopo la registrazione
  const handleAutoLogin = async () => {
    setSuccessDialogVisible(false);
    
    try {
      // Mostro stato di caricamento
      Toast.show({
        type: 'info',
        text1: 'Accesso in corso...',
        visibilityTime: 3000,
      });
      
      logger.log('Tentativo di login diretto dopo registrazione per:', email);
      const loginSuccess = await login(email, password);
      
      if (loginSuccess) {
        logger.log('Login automatico riuscito, redirezione alla home');
        
        // Mostra conferma di successo
        Toast.show({
          type: 'success',
          text1: 'Benvenuto in Refood!',
          text2: 'Accesso effettuato con successo',
          visibilityTime: 4000,
        });
        
        // Forza la navigazione alla home
        setTimeout(() => {
          router.replace('/');
        }, 500);
      } else {
        throw new Error('Login automatico fallito');
      }
    } catch (loginError) {
      logger.error('Errore durante login automatico:', loginError);
      
      // Mostra un dialog di errore login
      setErrorMessage('Non è stato possibile effettuare l\'accesso automatico. Verrai reindirizzato alla pagina di login.');
      setErrorDialogVisible(true);
    }
  };
  
  // Handler per reindirizzare alla pagina di login manuale
  const redirectToLogin = () => {
    setErrorDialogVisible(false);
    router.replace({
      pathname: "/",
      params: { 
        registrationSuccess: "true",
        email: email
      }
    });
  };
  
  const goBack = () => {
    router.push("/");
  };

  return (
    <View style={styles.mainContainer}>
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1974&auto=format&fit=crop' }} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView contentContainerStyle={styles.scrollView}>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons name="food-apple" size={54} color="#fff" />
              <Text style={styles.appName}>Refood</Text>
              <Text style={styles.tagline}>Unisciti a noi nella lotta contro lo spreco alimentare</Text>
            </View>

            <Card style={styles.formCard} elevation={5}>
              <Card.Content style={styles.formContainer}>
                <Text style={styles.registerTitle}>Crea il tuo account</Text>
                <Divider style={styles.divider} />
                
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Nome"
                    value={nome}
                    onChangeText={setNome}
                    onBlur={validateNome}
                    error={!!nomeError}
                    style={styles.input}
                    mode="outlined"
                    outlineColor={PRIMARY_COLOR}
                    activeOutlineColor={PRIMARY_COLOR}
                    left={<TextInput.Icon icon="account" />}
                  />
                  {nomeError ? <HelperText type="error">{nomeError}</HelperText> : null}
                </View>

                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Cognome"
                    value={cognome}
                    onChangeText={setCognome}
                    onBlur={validateCognome}
                    error={!!cognomeError}
                    style={styles.input}
                    mode="outlined"
                    outlineColor={PRIMARY_COLOR}
                    activeOutlineColor={PRIMARY_COLOR}
                    left={<TextInput.Icon icon="account" />}
                  />
                  {cognomeError ? <HelperText type="error">{cognomeError}</HelperText> : null}
                </View>
                
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    onBlur={validateEmail}
                    error={!!emailError}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                    mode="outlined"
                    outlineColor={PRIMARY_COLOR}
                    activeOutlineColor={PRIMARY_COLOR}
                    left={<TextInput.Icon icon="email" />}
                  />
                  {emailError ? <HelperText type="error">{emailError}</HelperText> : null}
                </View>

                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    onBlur={validatePassword}
                    secureTextEntry={!passwordVisible}
                    error={!!passwordError}
                    style={styles.input}
                    mode="outlined"
                    outlineColor={PRIMARY_COLOR}
                    activeOutlineColor={PRIMARY_COLOR}
                    left={<TextInput.Icon icon="lock" />}
                    right={
                      <TextInput.Icon
                        icon={passwordVisible ? 'eye-off' : 'eye'}
                        onPress={() => setPasswordVisible(!passwordVisible)}
                      />
                    }
                  />
                  {passwordError ? <HelperText type="error">{passwordError}</HelperText> : null}
                </View>
                
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Conferma Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onBlur={validateConfirmPassword}
                    secureTextEntry={!passwordVisible}
                    error={!!confirmPasswordError}
                    style={styles.input}
                    mode="outlined"
                    outlineColor={PRIMARY_COLOR}
                    activeOutlineColor={PRIMARY_COLOR}
                    left={<TextInput.Icon icon="lock-check" />}
                  />
                  {confirmPasswordError ? <HelperText type="error">{confirmPasswordError}</HelperText> : null}
                </View>

                <Button
                  mode="contained"
                  onPress={handleRegister}
                  loading={isLoading}
                  disabled={isLoading}
                  style={styles.registerButton}
                  buttonColor={PRIMARY_COLOR}
                  icon="account-plus"
                >
                  Registrati
                </Button>
                
                <Button
                  mode="text"
                  onPress={goBack}
                  style={styles.loginButton}
                >
                  Hai già un account? Accedi
                </Button>
              </Card.Content>
            </Card>
            
            <View style={styles.footer}>
              <Text style={styles.footerText}>© 2025 Refood App - Tutti i diritti riservati</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        
        {/* Dialog di successo */}
        <Portal>
          <Dialog visible={successDialogVisible} dismissable={false}>
            <Dialog.Title>Registrazione completata</Dialog.Title>
            <Dialog.Content>
              <Paragraph>Registrazione completata con successo! Vuoi accedere automaticamente?</Paragraph>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={handleAutoLogin}>Accedi</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        
        {/* Dialog di errore */}
        <Portal>
          <Dialog visible={errorDialogVisible} dismissable={false}>
            <Dialog.Title>Errore</Dialog.Title>
            <Dialog.Content>
              <Paragraph>{errorMessage}</Paragraph>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={redirectToLogin}>OK</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scrollView: {
    flexGrow: 1,
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  tagline: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 5,
  },
  formCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  formContainer: {
    padding: 16,
  },
  registerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    textAlign: 'center',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    marginBottom: 16,
    backgroundColor: '#e0e0e0',
  },
  inputWrapper: {
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#fff',
  },
  registerButton: {
    marginTop: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  loginButton: {
    marginTop: 10,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.7,
  },
});

export default RegisterScreen; 