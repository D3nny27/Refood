import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ImageBackground, Animated } from 'react-native';
import { TextInput, Button, Text, HelperText, Card, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { PRIMARY_COLOR } from '../config/constants';
import Toast from 'react-native-toast-message';
import logger from '../utils/logger';
import { router, Link } from 'expo-router';

const RegistrationScreen = () => {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [nomeError, setNomeError] = useState('');
  const [cognomeError, setCognomeError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const { register, error, clearError, isLoading } = useAuth();
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Pulisci gli errori quando il componente viene montato
    clearError();
  }, []);

  // Mostra Toast quando cambia l'errore
  useEffect(() => {
    if (error) {
      Toast.show({
        type: "error",
        position: "bottom",
        text1: "Registrazione non riuscita",
        text2: error,
        visibilityTime: 4000,
        autoHide: true,
      });
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [error, fadeAnim]);

  const validateNome = () => {
    if (!nome) {
      setNomeError('Il nome è obbligatorio');
      return false;
    } else {
      setNomeError('');
      return true;
    }
  };

  const validateCognome = () => {
    if (!cognome) {
      setCognomeError('Il cognome è obbligatorio');
      return false;
    } else {
      setCognomeError('');
      return true;
    }
  };

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('L\'email è obbligatoria');
      return false;
    } else if (!emailRegex.test(email)) {
      setEmailError('Inserisci un indirizzo email valido');
      return false;
    } else {
      setEmailError('');
      return true;
    }
  };

  const validatePassword = () => {
    if (!password) {
      setPasswordError('La password è obbligatoria');
      return false;
    } else if (password.length < 6) {
      setPasswordError('La password deve contenere almeno 6 caratteri');
      return false;
    } else {
      setPasswordError('');
      return true;
    }
  };

  const validateConfirmPassword = () => {
    if (!confirmPassword) {
      setConfirmPasswordError('La conferma password è obbligatoria');
      return false;
    } else if (confirmPassword !== password) {
      setConfirmPasswordError('Le password non coincidono');
      return false;
    } else {
      setConfirmPasswordError('');
      return true;
    }
  };

  const handleRegistration = async () => {
    // Valida i campi di input
    const isNomeValid = validateNome();
    const isCognomeValid = validateCognome();
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    const isConfirmPasswordValid = validateConfirmPassword();

    if (isNomeValid && isCognomeValid && isEmailValid && isPasswordValid && isConfirmPasswordValid) {
      logger.log('RegistrationScreen - Tentativo di registrazione con:', email);
      const success = await register(nome, cognome, email, password);
      logger.log('RegistrationScreen - Risultato registrazione:', success ? 'successo' : 'fallito');
      
      if (success) {
        Toast.show({
          type: "success",
          position: "bottom",
          text1: "Registrazione completata",
          text2: "Puoi accedere con le tue credenziali",
          visibilityTime: 4000,
          autoHide: true,
        });
        
        // Non usiamo più una navigazione diretta qui
        // ma lasciamo che l'utente clicchi manualmente sul link "Hai già un account? Accedi"
        logger.log('RegistrationScreen - Registrazione completata con successo, attendiamo che l\'utente ritorni alla login');
      }
    }
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
              <MaterialCommunityIcons name="food-apple" size={64} color="#fff" />
              <Text style={styles.appName}>Refood</Text>
              <Text style={styles.tagline}>Riduci lo spreco alimentare</Text>
            </View>

            <Card style={styles.formCard} elevation={5}>
              <Card.Content style={styles.formContainer}>
                <Text style={styles.registrationTitle}>Registrazione</Text>
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
                  onPress={handleRegistration}
                  loading={isLoading}
                  disabled={isLoading}
                  style={styles.registrationButton}
                  buttonColor={PRIMARY_COLOR}
                  icon="account-plus"
                >
                  Registrati
                </Button>
                
                <Link href="/" asChild>
                  <Button
                    mode="text"
                    style={styles.loginLink}
                  >
                    Hai già un account? Accedi
                  </Button>
                </Link>
              </Card.Content>
            </Card>
            
            <View style={styles.footer}>
              <Text style={styles.footerText}>© 2025 Refood App - Tutti i diritti riservati</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scrollView: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.8,
  },
  formCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  formContainer: {
    padding: 16,
  },
  registrationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    textAlign: 'center',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    marginBottom: 20,
    backgroundColor: '#e0e0e0',
  },
  inputWrapper: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
  },
  registrationButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  loginLink: {
    marginTop: 16,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.7,
  },
});

export default RegistrationScreen; 