import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image, ImageBackground, Animated } from 'react-native';
import { TextInput, Button, Text, HelperText, Surface, Card, Divider } from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { PRIMARY_COLOR } from '../config/constants';
import Toast from 'react-native-toast-message';
import logger from '../utils/logger';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { login, error, clearError, isLoading, isAuthenticated } = useAuth();
  const [fadeAnim] = useState(new Animated.Value(0)); // Animazione per il messaggio di errore

  useEffect(() => {
    logger.log('LoginScreen - isAuthenticated cambiato:', isAuthenticated);
    if (isAuthenticated) {
      logger.log('LoginScreen - Utente autenticato, dovrebbe reindirizzare automaticamente');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Pulisci gli errori quando il componente viene montato
    clearError();
  }, []);

  // Mostra Toast quando cambia l'errore
  useEffect(() => {
    if (error) {
      // Mostra Toast per l errore
      Toast.show({
        type: "error",
        position: "bottom",
        text1: "Accesso non riuscito",
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

  const handleLogin = async () => {
    // Valida i campi di input
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();

    if (isEmailValid && isPasswordValid) {
      logger.log('LoginScreen - Tentativo di login con:', email);
      const success = await login(email, password);
      logger.log('LoginScreen - Risultato login:', success ? 'successo' : 'fallito');
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
                <Text style={styles.loginTitle}>Accedi</Text>
                <Divider style={styles.divider} />
                
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

                <Button
                  mode="contained"
                  onPress={handleLogin}
                  loading={isLoading}
                  disabled={isLoading}
                  style={styles.loginButton}
                  buttonColor={PRIMARY_COLOR}
                  icon="login"
                >
                  Accedi
                </Button>
                
                <Button
                  mode="text"
                  onPress={() => logger.log('Password dimenticata')}
                  style={styles.forgotPasswordButton}
                >
                  Password dimenticata?
                </Button>
              </Card.Content>
            </Card>
            
            <View style={styles.footer}>
              <Text style={styles.footerText}>© 2023 Refood App - Tutti i diritti riservati</Text>
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
  } as any,
  backgroundImage: {
    flex: 1,
    justifyContent: 'center',
  } as any,
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  } as any,
  scrollView: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  } as any,
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  } as any,
  appName: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  } as any,
  tagline: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.8,
  } as any,
  formCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  } as any,
  formContainer: {
    padding: 16,
  } as any,
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    textAlign: 'center',
    marginBottom: 8,
  } as any,
  divider: {
    height: 1,
    marginBottom: 20,
    backgroundColor: '#e0e0e0',
  } as any,
  inputWrapper: {
    marginBottom: 12,
  } as any,
  input: {
    backgroundColor: '#fff',
  } as any,
  errorContainer: {
    marginVertical: 16,
    width: '100%',
  } as any,
  errorSurface: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  } as any,
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff9fa',
    padding: 12,
  } as any,
  errorIcon: {
    marginRight: 10,
  } as any,
  errorText: {
    color: '#d32f2f',
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  } as any,
  loginButton: {
    marginTop: 20,
    paddingVertical: 8,
    borderRadius: 8,
  } as any,
  forgotPasswordButton: {
    marginTop: 10,
  } as any,
  footer: {
    marginTop: 20,
    alignItems: 'center',
  } as any,
  footerText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.7,
  } as any,
});

export default LoginScreen; 