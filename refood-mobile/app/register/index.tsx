import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, ScrollView, Platform, ImageBackground, Alert } from 'react-native';
import { TextInput, Button, Text, HelperText, Card, Divider, RadioButton, Dialog, Portal, Paragraph, Title, Subheading } from 'react-native-paper';
import { router, Link } from 'expo-router';
import { registerUser } from '../../src/services/authService';
import { PRIMARY_COLOR } from '../../src/config/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import logger from '../../src/utils/logger';
import { useAuth } from '../../src/context/AuthContext';

// Tipi per il form di registrazione
interface FormDati {
  email: string;
  password: string;
  confermaPassword: string;
  nome: string;
  cognome: string;
  tipologia: 'organizzazione' | 'utente' | null;
  ruoloOrganizzazione: 'Operatore' | 'Amministratore' | null;
  tipoUtente: 'Privato' | 'Canale sociale' | 'centro riciclo' | null;
  indirizzo: string;
  telefono: string;
}

// Stato errori form
interface ErroriForm {
  email: string;
  password: string;
  confermaPassword: string;
  nome: string;
  cognome: string;
  tipologia: string;
  ruoloOrganizzazione: string;
  tipoUtente: string;
  indirizzo: string;
  telefono: string;
}

const RegisterScreen = () => {
  const { login, register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Stato per i dialoghi di feedback
  const [successDialogVisible, setSuccessDialogVisible] = useState(false);
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Stato del form
  const [form, setForm] = useState<FormDati>({
    email: '',
    password: '',
    confermaPassword: '',
    nome: '',
    cognome: '',
    tipologia: null, // Modificato: inizializzato a null invece di 'organizzazione'
    ruoloOrganizzazione: null,
    tipoUtente: null,
    indirizzo: '',
    telefono: '',
  });
  
  // Traccia i cambiamenti nel form per debugging
  useEffect(() => {
    console.log('Form aggiornato:', { 
      tipologia: form.tipologia,
      ruoloOrganizzazione: form.ruoloOrganizzazione,
      tipoUtente: form.tipoUtente 
    });
  }, [form.tipologia, form.ruoloOrganizzazione, form.tipoUtente]);
  
  // Metodo per mostrare la selezione in un alert per sceglierne uno direttamente
  const mostraSelezioneTipologia = () => {
    Alert.alert(
      "Seleziona Tipologia",
      "Scegli la tipologia di utente che sei:",
      [
        {
          text: "Organizzazione",
          onPress: () => {
            setForm(prev => ({
              ...prev,
              tipologia: 'organizzazione',
              ruoloOrganizzazione: null,
              tipoUtente: null
            }));
          }
        },
        {
          text: "Utente",
          onPress: () => {
            setForm(prev => ({
              ...prev,
              tipologia: 'utente',
              ruoloOrganizzazione: null,
              tipoUtente: null
            }));
          }
        }
      ],
      { cancelable: true }
    );
  };

  // Metodo per mostrare la selezione del ruolo organizzazione
  const mostraSelezionRuoloOrg = () => {
    if (form.tipologia !== 'organizzazione') return;
    
    Alert.alert(
      "Seleziona Ruolo",
      "Scegli il tuo ruolo nell'organizzazione:",
      [
        {
          text: "Operatore",
          onPress: () => {
            setForm(prev => ({
              ...prev,
              ruoloOrganizzazione: 'Operatore'
            }));
          }
        },
        {
          text: "Amministratore",
          onPress: () => {
            setForm(prev => ({
              ...prev,
              ruoloOrganizzazione: 'Amministratore'
            }));
          }
        }
      ],
      { cancelable: true }
    );
  };

  // Metodo per mostrare la selezione del tipo utente
  const mostraSelezioneTipoUtente = () => {
    if (form.tipologia !== 'utente') return;
    
    Alert.alert(
      "Seleziona Tipo Utente",
      "Scegli la tipologia di utente:",
      [
        {
          text: "Privato",
          onPress: () => {
            setForm(prev => ({
              ...prev,
              tipoUtente: 'Privato'
            }));
          }
        },
        {
          text: "Canale sociale",
          onPress: () => {
            setForm(prev => ({
              ...prev,
              tipoUtente: 'Canale sociale'
            }));
          }
        },
        {
          text: "Centro riciclo",
          onPress: () => {
            setForm(prev => ({
              ...prev,
              tipoUtente: 'centro riciclo'
            }));
          }
        }
      ],
      { cancelable: true }
    );
  };
  
  // Stato errori
  const [errori, setErrori] = useState<ErroriForm>({
    email: '',
    password: '',
    confermaPassword: '',
    nome: '',
    cognome: '',
    tipologia: '',
    ruoloOrganizzazione: '',
    tipoUtente: '',
    indirizzo: '',
    telefono: '',
  });

  // Validazione email
  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email) {
      setErrori(prev => ({ ...prev, email: 'Email obbligatoria' }));
      return false;
    } else if (!emailRegex.test(form.email)) {
      setErrori(prev => ({ ...prev, email: 'Email non valida' }));
      return false;
    }
    setErrori(prev => ({ ...prev, email: '' }));
    return true;
  };

  // Validazione password
  const validatePassword = () => {
    if (!form.password) {
      setErrori(prev => ({ ...prev, password: 'Password obbligatoria' }));
      return false;
    } else if (form.password.length < 6) {
      setErrori(prev => ({ ...prev, password: 'Password troppo corta (min 6 caratteri)' }));
      return false;
    }
    setErrori(prev => ({ ...prev, password: '' }));
    return true;
  };

  // Validazione conferma password
  const validateConfermaPassword = () => {
    if (!form.confermaPassword) {
      setErrori(prev => ({ ...prev, confermaPassword: 'Conferma password obbligatoria' }));
      return false;
    } else if (form.password !== form.confermaPassword) {
      setErrori(prev => ({ ...prev, confermaPassword: 'Le password non coincidono' }));
      return false;
    }
    setErrori(prev => ({ ...prev, confermaPassword: '' }));
    return true;
  };

  // Validazione nome
  const validateNome = () => {
    if (!form.nome) {
      setErrori(prev => ({ ...prev, nome: 'Nome obbligatorio' }));
      return false;
    }
    setErrori(prev => ({ ...prev, nome: '' }));
    return true;
  };

  // Validazione cognome
  const validateCognome = () => {
    if (!form.cognome) {
      setErrori(prev => ({ ...prev, cognome: 'Cognome obbligatorio' }));
      return false;
    }
    setErrori(prev => ({ ...prev, cognome: '' }));
    return true;
  };

  // Validazione tipologia
  const validateTipologia = () => {
    if (!form.tipologia) {
      setErrori(prev => ({ ...prev, tipologia: 'Seleziona una tipologia' }));
      return false;
    }
    setErrori(prev => ({ ...prev, tipologia: '' }));
    return true;
  };

  // Validazione ruolo organizzazione
  const validateRuoloOrganizzazione = () => {
    if (form.tipologia === 'organizzazione' && !form.ruoloOrganizzazione) {
      setErrori(prev => ({ ...prev, ruoloOrganizzazione: 'Seleziona un ruolo' }));
      return false;
    }
    setErrori(prev => ({ ...prev, ruoloOrganizzazione: '' }));
    return true;
  };

  // Validazione tipo utente
  const validateTipoUtente = () => {
    if (form.tipologia === 'utente' && !form.tipoUtente) {
      setErrori(prev => ({ ...prev, tipoUtente: 'Seleziona un tipo utente' }));
      return false;
    }
    setErrori(prev => ({ ...prev, tipoUtente: '' }));
    return true;
  };

  // Validazione indirizzo (solo per utenti)
  const validateIndirizzo = () => {
    if (form.tipologia === 'utente' && !form.indirizzo) {
      setErrori(prev => ({ ...prev, indirizzo: 'Indirizzo obbligatorio' }));
      return false;
    }
    setErrori(prev => ({ ...prev, indirizzo: '' }));
    return true;
  };

  // Validazione telefono (solo per utenti)
  const validateTelefono = () => {
    if (form.tipologia === 'utente' && !form.telefono) {
      setErrori(prev => ({ ...prev, telefono: 'Telefono obbligatorio' }));
      return false;
    }
    setErrori(prev => ({ ...prev, telefono: '' }));
    return true;
  };

  // Validazione completa del form
  const validateForm = () => {
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    const isConfermaPasswordValid = validateConfermaPassword();
    const isNomeValid = validateNome();
    const isCognomeValid = validateCognome();
    const isTipologiaValid = validateTipologia();
    const isRuoloOrganizzazioneValid = validateRuoloOrganizzazione();
    const isTipoUtenteValid = validateTipoUtente();
    const isIndirizzoValid = validateIndirizzo();
    const isTelefonoValid = validateTelefono();

    return (
      isEmailValid &&
      isPasswordValid &&
      isConfermaPasswordValid &&
      isNomeValid &&
      isCognomeValid &&
      isTipologiaValid &&
      isRuoloOrganizzazioneValid &&
      isTipoUtenteValid &&
      isIndirizzoValid &&
      isTelefonoValid
    );
  };

  // Gestione della registrazione
  const handleRegister = async () => {
    // Controlla che tutti i campi necessari siano validi
    const isValid = validateForm();
    
    if (!isValid) {
      console.log('Form non valido, impossibile procedere');
      Alert.alert('Attenzione', 'Verifica tutti i campi e riprova.');
      return;
    }

    try {
      setIsLoading(true);
      
      // Aggiorno: passo tutti i parametri richiesti alla funzione register
      const success = await register(
        form.nome,
        form.cognome,
        form.email,
        form.password,
        form.tipologia,
        form.ruoloOrganizzazione,
        form.tipoUtente,
        form.indirizzo,
        form.telefono
      );

      console.log('Risultato registrazione:', success ? 'successo' : 'fallimento');
      
      if (success) {
        // Mostra il dialogo di successo
        setSuccessDialogVisible(true);
      }
    } catch (error) {
      console.error('Errore durante la registrazione:', error);
      
      // Mostra messaggio di errore
      setErrorMessage(typeof error === 'string' ? error : 'Si è verificato un errore durante la registrazione');
      setErrorDialogVisible(true);
    } finally {
      setIsLoading(false);
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
      
      logger.log('Tentativo di login diretto dopo registrazione per:', form.email);
      const loginSuccess = await login(form.email, form.password);
      
      if (loginSuccess) {
        logger.log('Login automatico riuscito, redirezione alla home');
        
        // Mostra conferma di successo
        Toast.show({
          type: 'success',
          text1: 'Benvenuto in Refood!',
          text2: 'Accesso effettuato con successo',
          visibilityTime: 4000,
        });
        
        // Forza la navigazione alla home con un ritardo per garantire che tutto sia pronto
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
    setSuccessDialogVisible(false);
    // Utilizziamo setTimeout per assicurarci che i dialoghi siano chiusi prima della navigazione
    setTimeout(() => {
      router.replace({
        pathname: "/",
        params: { 
          registrationSuccess: "true",
          email: form.email
        }
      });
    }, 300);
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
                <Title style={styles.registerTitle}>Registrazione</Title>
                <Divider style={styles.divider} />
                
                {/* Email */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Email"
                    value={form.email}
                    onChangeText={(text) => setForm(prev => ({ ...prev, email: text }))}
                    onBlur={validateEmail}
                    error={!!errori.email}
                    style={styles.input}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    outlineColor={PRIMARY_COLOR}
                    activeOutlineColor={PRIMARY_COLOR}
                    left={<TextInput.Icon icon="email" />}
                  />
                  {!!errori.email && <HelperText type="error">{errori.email}</HelperText>}
                </View>
                
                {/* Password */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Password"
                    value={form.password}
                    onChangeText={(text) => setForm(prev => ({ ...prev, password: text }))}
                    onBlur={validatePassword}
                    error={!!errori.password}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                    outlineColor={PRIMARY_COLOR}
                    activeOutlineColor={PRIMARY_COLOR}
                    left={<TextInput.Icon icon="lock" />}
                  />
                  {!!errori.password && <HelperText type="error">{errori.password}</HelperText>}
                </View>
                
                {/* Conferma Password */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Conferma Password"
                    value={form.confermaPassword}
                    onChangeText={(text) => setForm(prev => ({ ...prev, confermaPassword: text }))}
                    onBlur={validateConfermaPassword}
                    error={!!errori.confermaPassword}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                    outlineColor={PRIMARY_COLOR}
                    activeOutlineColor={PRIMARY_COLOR}
                    left={<TextInput.Icon icon="lock-check" />}
                  />
                  {!!errori.confermaPassword && <HelperText type="error">{errori.confermaPassword}</HelperText>}
                </View>
                
                {/* Nome */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Nome"
                    value={form.nome}
                    onChangeText={(text) => setForm(prev => ({ ...prev, nome: text }))}
                    onBlur={validateNome}
                    error={!!errori.nome}
                    mode="outlined"
                    style={styles.input}
                    outlineColor={PRIMARY_COLOR}
                    activeOutlineColor={PRIMARY_COLOR}
                    left={<TextInput.Icon icon="account" />}
                  />
                  {!!errori.nome && <HelperText type="error">{errori.nome}</HelperText>}
                </View>
                
                {/* Cognome */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Cognome"
                    value={form.cognome}
                    onChangeText={(text) => setForm(prev => ({ ...prev, cognome: text }))}
                    onBlur={validateCognome}
                    error={!!errori.cognome}
                    mode="outlined"
                    style={styles.input}
                    outlineColor={PRIMARY_COLOR}
                    activeOutlineColor={PRIMARY_COLOR}
                    left={<TextInput.Icon icon="account" />}
                  />
                  {!!errori.cognome && <HelperText type="error">{errori.cognome}</HelperText>}
                </View>
                
                {/* Selezione tipologia - Migliorata UI */}
                <Subheading style={styles.sectionTitle}>Seleziona Tipologia</Subheading>
                
                <View style={styles.radioContainer}>
                  <RadioButton.Group
                    onValueChange={(value) => {
                      setForm(prev => ({
                        ...prev,
                        tipologia: value as 'organizzazione' | 'utente',
                        // Reset dei campi quando cambia la tipologia
                        ruoloOrganizzazione: null,
                        tipoUtente: null,
                        indirizzo: '',
                        telefono: ''
                      }));
                      validateTipologia();
                    }}
                    value={form.tipologia || ''}
                  >
                    <View style={styles.radioOption}>
                      <RadioButton value="organizzazione" color={PRIMARY_COLOR} />
                      <Text style={styles.radioLabel}>Organizzazione</Text>
                    </View>
                    <View style={styles.radioOption}>
                      <RadioButton value="utente" color={PRIMARY_COLOR} />
                      <Text style={styles.radioLabel}>Utente</Text>
                    </View>
                  </RadioButton.Group>
                </View>
                {!!errori.tipologia && <HelperText type="error">{errori.tipologia}</HelperText>}
                
                {/* Opzioni specifiche per Organizzazione - Migliorata UI */}
                {form.tipologia === 'organizzazione' && (
                  <View style={styles.subSelectionContainer}>
                    <Subheading style={styles.sectionTitle}>Seleziona Ruolo nell'Organizzazione</Subheading>
                    
                    <View style={styles.radioContainer}>
                      <RadioButton.Group
                        onValueChange={(value) => {
                          setForm(prev => ({
                            ...prev,
                            ruoloOrganizzazione: value as 'Operatore' | 'Amministratore'
                          }));
                          validateRuoloOrganizzazione();
                        }}
                        value={form.ruoloOrganizzazione || ''}
                      >
                        <View style={styles.radioOption}>
                          <RadioButton value="Operatore" color={PRIMARY_COLOR} />
                          <Text style={styles.radioLabel}>Operatore</Text>
                        </View>
                        <View style={styles.radioOption}>
                          <RadioButton value="Amministratore" color={PRIMARY_COLOR} />
                          <Text style={styles.radioLabel}>Amministratore</Text>
                        </View>
                      </RadioButton.Group>
                    </View>
                    {!!errori.ruoloOrganizzazione && <HelperText type="error">{errori.ruoloOrganizzazione}</HelperText>}
                  </View>
                )}
                
                {/* Opzioni specifiche per Utente - Migliorata UI */}
                {form.tipologia === 'utente' && (
                  <View style={styles.subSelectionContainer}>
                    <Subheading style={styles.sectionTitle}>Seleziona Tipo Utente</Subheading>
                    
                    <View style={styles.radioContainer}>
                      <RadioButton.Group
                        onValueChange={(value) => {
                          setForm(prev => ({
                            ...prev,
                            tipoUtente: value as 'Privato' | 'Canale sociale' | 'centro riciclo'
                          }));
                          validateTipoUtente();
                        }}
                        value={form.tipoUtente || ''}
                      >
                        <View style={styles.radioOption}>
                          <RadioButton value="Privato" color={PRIMARY_COLOR} />
                          <Text style={styles.radioLabel}>Privato</Text>
                        </View>
                        <View style={styles.radioOption}>
                          <RadioButton value="Canale sociale" color={PRIMARY_COLOR} />
                          <Text style={styles.radioLabel}>Canale sociale</Text>
                        </View>
                        <View style={styles.radioOption}>
                          <RadioButton value="centro riciclo" color={PRIMARY_COLOR} />
                          <Text style={styles.radioLabel}>Centro riciclo</Text>
                        </View>
                      </RadioButton.Group>
                    </View>
                    {!!errori.tipoUtente && <HelperText type="error">{errori.tipoUtente}</HelperText>}
                    
                    <Subheading style={styles.sectionTitle}>Dati Aggiuntivi</Subheading>
                    
                    <TextInput
                      label="Indirizzo"
                      value={form.indirizzo}
                      onChangeText={(text) => setForm(prev => ({ ...prev, indirizzo: text }))}
                      onBlur={validateIndirizzo}
                      error={!!errori.indirizzo}
                      mode="outlined"
                      style={styles.input}
                      outlineColor={PRIMARY_COLOR}
                      activeOutlineColor={PRIMARY_COLOR}
                      left={<TextInput.Icon icon="map-marker" />}
                    />
                    {!!errori.indirizzo && <HelperText type="error">{errori.indirizzo}</HelperText>}
                    
                    <TextInput
                      label="Telefono"
                      value={form.telefono}
                      onChangeText={(text) => setForm(prev => ({ ...prev, telefono: text }))}
                      onBlur={validateTelefono}
                      error={!!errori.telefono}
                      mode="outlined"
                      keyboardType="phone-pad"
                      style={styles.input}
                      outlineColor={PRIMARY_COLOR}
                      activeOutlineColor={PRIMARY_COLOR}
                      left={<TextInput.Icon icon="phone" />}
                    />
                    {!!errori.telefono && <HelperText type="error">{errori.telefono}</HelperText>}
                  </View>
                )}
                
                <Button 
                  mode="contained" 
                  onPress={handleRegister} 
                  loading={isLoading} 
                  disabled={isLoading}
                  style={styles.button}
                >
                  Registrati
                </Button>
                
                <Link href="/" asChild>
                  <Button 
                    mode="text" 
                    style={styles.linkButton}
                  >
                    Hai già un account? Accedi
                  </Button>
                </Link>
              </Card.Content>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
      
      {/* Success Dialog */}
      <Portal>
        <Dialog visible={successDialogVisible} dismissable={false}>
          <Dialog.Title>Registrazione Completata</Dialog.Title>
          <Dialog.Content>
            <Paragraph>Il tuo account è stato creato con successo!</Paragraph>
            <Paragraph>Vuoi effettuare l'accesso automaticamente?</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={redirectToLogin}>No, vai al login</Button>
            <Button onPress={handleAutoLogin} mode="contained">Si, accedi ora</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Error Dialog */}
      <Portal>
        <Dialog visible={errorDialogVisible} dismissable={true} onDismiss={() => setErrorDialogVisible(false)}>
          <Dialog.Title>Si è verificato un errore</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{errorMessage}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={redirectToLogin}>Vai al login</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  formCard: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  formContainer: {
    padding: 10,
  },
  registerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: PRIMARY_COLOR,
  },
  divider: {
    marginBottom: 15,
    height: 1,
    backgroundColor: PRIMARY_COLOR,
  },
  inputWrapper: {
    marginBottom: 12,
  },
  input: {
    marginBottom: 4,
    backgroundColor: 'white',
  },
  button: {
    marginTop: 20,
    paddingVertical: 8,
    backgroundColor: PRIMARY_COLOR,
  },
  linkButton: {
    marginTop: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
    color: PRIMARY_COLOR,
    textAlign: 'center',
    backgroundColor: '#f0f8f0',
    paddingVertical: 8,
    borderRadius: 6,
  },
  radioContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 3,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  radioLabel: {
    marginLeft: 8,
    fontSize: 16,
    flex: 1,
  },
  subSelectionContainer: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectionButtonsContainer: {
    marginBottom: 20,
  },
  selectionButton: {
    marginBottom: 8,
    padding: 5,
  },
  selectionInstructions: {
    marginBottom: 8,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    fontSize: 16,
  },
});

export default RegisterScreen;