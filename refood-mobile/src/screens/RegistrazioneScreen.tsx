import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, RadioButton, Text, Title, Subheading, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { authAPI } from '../api/api';
import { COLORI } from '../config/constants';

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

export default function RegistrazioneScreen() {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  
  // Stato del form
  const [form, setForm] = useState<FormDati>({
    email: '',
    password: '',
    confermaPassword: '',
    nome: '',
    cognome: '',
    tipologia: null,
    ruoloOrganizzazione: null,
    tipoUtente: null,
    indirizzo: '',
    telefono: '',
  });
  
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
    } else if (form.password.length < 8) {
      setErrori(prev => ({ ...prev, password: 'Password troppo corta (min 8 caratteri)' }));
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

  // Gestione form submit
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Preparazione dati per la richiesta
      const registrationData: any = {
        email: form.email,
        password: form.password,
        nome: form.nome,
        cognome: form.cognome
      };

      // Logica diversa in base alla tipologia
      if (form.tipologia === 'organizzazione') {
        // Per organizzazione settiamo direttamente il ruolo
        registrationData.ruolo = form.ruoloOrganizzazione;
      } else {
        // Per utente, settiamo ruolo = 'Utente' e aggiungiamo i dati del tipo utente
        registrationData.ruolo = 'Utente';
        registrationData.tipoUtente = {
          tipo: form.tipoUtente,
          indirizzo: form.indirizzo,
          telefono: form.telefono,
          email: form.email // Usando la stessa email dell'attore
        };
      }

      // Chiamata API per registrazione
      const response = await authAPI.register(registrationData);
      
      Alert.alert(
        'Registrazione Completata',
        'Registrazione avvenuta con successo!',
        [{ text: 'OK', onPress: () => navigation.navigate('Login' as never) }]
      );
    } catch (error: any) {
      console.error('Errore durante la registrazione:', error);
      Alert.alert(
        'Errore',
        error.response?.data?.message || 'Si è verificato un errore durante la registrazione'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Title style={styles.title}>Registrazione</Title>
        
        {/* Dati personali */}
        <Subheading style={styles.sectionTitle}>Dati Personali</Subheading>
        
        <TextInput
          label="Email"
          value={form.email}
          onChangeText={(text) => setForm(prev => ({ ...prev, email: text }))}
          onBlur={validateEmail}
          error={!!errori.email}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        {!!errori.email && <HelperText type="error">{errori.email}</HelperText>}
        
        <TextInput
          label="Password"
          value={form.password}
          onChangeText={(text) => setForm(prev => ({ ...prev, password: text }))}
          onBlur={validatePassword}
          error={!!errori.password}
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />
        {!!errori.password && <HelperText type="error">{errori.password}</HelperText>}
        
        <TextInput
          label="Conferma Password"
          value={form.confermaPassword}
          onChangeText={(text) => setForm(prev => ({ ...prev, confermaPassword: text }))}
          onBlur={validateConfermaPassword}
          error={!!errori.confermaPassword}
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />
        {!!errori.confermaPassword && <HelperText type="error">{errori.confermaPassword}</HelperText>}
        
        <TextInput
          label="Nome"
          value={form.nome}
          onChangeText={(text) => setForm(prev => ({ ...prev, nome: text }))}
          onBlur={validateNome}
          error={!!errori.nome}
          mode="outlined"
          style={styles.input}
        />
        {!!errori.nome && <HelperText type="error">{errori.nome}</HelperText>}
        
        <TextInput
          label="Cognome"
          value={form.cognome}
          onChangeText={(text) => setForm(prev => ({ ...prev, cognome: text }))}
          onBlur={validateCognome}
          error={!!errori.cognome}
          mode="outlined"
          style={styles.input}
        />
        {!!errori.cognome && <HelperText type="error">{errori.cognome}</HelperText>}
        
        {/* Selezione tipologia */}
        <Subheading style={styles.sectionTitle}>Seleziona Tipologia</Subheading>
        
        <RadioButton.Group
          onValueChange={(value) => {
            setForm(prev => ({
              ...prev,
              tipologia: value as 'organizzazione' | 'utente',
              // Reset dei campi quando cambia la tipologia
              ruoloOrganizzazione: null,
              tipoUtente: null
            }));
            validateTipologia();
          }}
          value={form.tipologia || ''}
        >
          <View style={styles.radioOption}>
            <RadioButton value="organizzazione" />
            <Text>Organizzazione</Text>
          </View>
          <View style={styles.radioOption}>
            <RadioButton value="utente" />
            <Text>Utente</Text>
          </View>
        </RadioButton.Group>
        {!!errori.tipologia && <HelperText type="error">{errori.tipologia}</HelperText>}
        
        {/* Opzioni specifiche per Organizzazione */}
        {form.tipologia === 'organizzazione' && (
          <>
            <Subheading style={styles.sectionTitle}>Seleziona Ruolo</Subheading>
            
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
                <RadioButton value="Operatore" />
                <Text>Operatore</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton value="Amministratore" />
                <Text>Amministratore</Text>
              </View>
            </RadioButton.Group>
            {!!errori.ruoloOrganizzazione && <HelperText type="error">{errori.ruoloOrganizzazione}</HelperText>}
          </>
        )}
        
        {/* Opzioni specifiche per Utente */}
        {form.tipologia === 'utente' && (
          <>
            <Subheading style={styles.sectionTitle}>Seleziona Tipo Utente</Subheading>
            
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
                <RadioButton value="Privato" />
                <Text>Privato</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton value="Canale sociale" />
                <Text>Canale sociale</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton value="centro riciclo" />
                <Text>Centro riciclo</Text>
              </View>
            </RadioButton.Group>
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
            />
            {!!errori.telefono && <HelperText type="error">{errori.telefono}</HelperText>}
          </>
        )}
        
        <Button 
          mode="contained" 
          onPress={handleSubmit} 
          loading={isLoading} 
          disabled={isLoading}
          style={styles.button}
        >
          Registrati
        </Button>
        
        <Button 
          mode="text" 
          onPress={() => navigation.navigate('Login' as never)} 
          style={styles.linkButton}
        >
          Hai già un account? Accedi
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  form: {
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORI.primario,
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontWeight: 'bold',
    color: COLORI.primario,
  },
  input: {
    marginBottom: 8,
    backgroundColor: 'white',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  button: {
    marginTop: 20,
    paddingVertical: 6,
    backgroundColor: COLORI.primario,
  },
  linkButton: {
    marginTop: 10,
  },
}); 