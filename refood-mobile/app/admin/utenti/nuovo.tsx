import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, useTheme, HelperText, Divider, Title, Subheading, Card, Chip, RadioButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

// Funzione helper per gestire errori
const getErrorMessage = (error: any, defaultMessage: string = 'Si è verificato un errore') => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return defaultMessage;
};

// Importa il servizio utenti
import utentiService from '../../../src/services/utentiService';

// Tipi di utente disponibili
const TIPI_UTENTE = [
  { value: 'Centro Sociale', label: 'Centro Sociale', icon: 'home-heart' as const },
  { value: 'Centro Riciclaggio', label: 'Centro Riciclaggio', icon: 'recycle' as const },
  { value: 'Supermercato', label: 'Supermercato', icon: 'store' as const },
  { value: 'Ristorante', label: 'Ristorante', icon: 'food' as const },
  { value: 'Altro', label: 'Altro', icon: 'domain' as const },
];

const NuovoUtenteScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  
  // Stato per i dati del form
  const [nome, setNome] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [sito_web, setSitoWeb] = useState('');
  const [note, setNote] = useState('');
  const [tipo, setTipo] = useState('Centro Sociale');
  
  // Stato per errori di validazione
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Stato per caricamento
  const [isLoading, setIsLoading] = useState(false);
  
  // Gestione della validazione del form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!nome.trim()) {
      newErrors.nome = 'Il nome è obbligatorio';
    }
    
    if (!indirizzo.trim()) {
      newErrors.indirizzo = 'L\'indirizzo è obbligatorio';
    }
    
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = 'Email non valida';
    }
    
    // Validazione telefono (opzionale)
    if (telefono && !/^[0-9+\s()-]{5,20}$/.test(telefono)) {
      newErrors.telefono = 'Numero di telefono non valido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Funzione per creare un nuovo utente
  const createUtente = async () => {
    if (!validateForm()) {
      Toast.show({
        type: 'error',
        text1: 'Errori nel form',
        text2: 'Correggi gli errori prima di procedere',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Prepara i dati da inviare
      const utenteData = {
        nome,
        indirizzo,
        email: email || undefined,
        telefono: telefono || undefined,
        sito_web: sito_web || undefined,
        note: note || undefined,
        tipo,
      };
      
      console.log('Invio dati per nuovo utente:', utenteData);
      
      // Chiamata all'API
      const response = await utentiService.createUtente(utenteData);
      
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Utente creato',
          text2: 'Il nuovo utente è stato creato con successo',
        });
        
        // Torna alla lista
        navigation.goBack();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: response.message || 'Impossibile creare l\'utente',
        });
      }
    } catch (error) {
      console.error('Errore durante la creazione dell\'utente:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: getErrorMessage(error, 'Impossibile creare l\'utente'),
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>Informazioni Utente</Title>
            <Divider style={styles.divider} />
            
            {/* Tipo utente */}
            <Subheading style={styles.sectionTitle}>Tipo Utente</Subheading>
            <View style={styles.tipiContainer}>
              <RadioButton.Group 
                onValueChange={value => setTipo(value)} 
                value={tipo}
              >
                <View style={styles.tipiGrid}>
                  {TIPI_UTENTE.map(item => (
                    <TouchableOpacity 
                      key={item.value}
                      style={[
                        styles.tipoItem, 
                        tipo === item.value && { borderColor: colors.primary }
                      ]}
                      onPress={() => setTipo(item.value)}
                    >
                      <RadioButton.Android 
                        value={item.value} 
                        color={colors.primary}
                      />
                      <MaterialCommunityIcons 
                        name={item.icon} 
                        size={20} 
                        color={tipo === item.value ? colors.primary : colors.onSurface} 
                      />
                      <Text style={styles.tipoLabel}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </RadioButton.Group>
            </View>
            
            <Divider style={styles.divider} />
            
            {/* Nome */}
            <TextInput
              label="Nome Utente *"
              value={nome}
              onChangeText={setNome}
              style={styles.input}
              error={!!errors.nome}
              mode="outlined"
            />
            {errors.nome && <HelperText type="error">{errors.nome}</HelperText>}
            
            {/* Indirizzo */}
            <TextInput
              label="Indirizzo *"
              value={indirizzo}
              onChangeText={setIndirizzo}
              style={styles.input}
              error={!!errors.indirizzo}
              mode="outlined"
            />
            {errors.indirizzo && <HelperText type="error">{errors.indirizzo}</HelperText>}
            
            {/* Email */}
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              error={!!errors.email}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && <HelperText type="error">{errors.email}</HelperText>}
            
            {/* Telefono */}
            <TextInput
              label="Telefono"
              value={telefono}
              onChangeText={setTelefono}
              style={styles.input}
              error={!!errors.telefono}
              mode="outlined"
              keyboardType="phone-pad"
            />
            {errors.telefono && <HelperText type="error">{errors.telefono}</HelperText>}
            
            {/* Sito Web */}
            <TextInput
              label="Sito Web"
              value={sito_web}
              onChangeText={setSitoWeb}
              style={styles.input}
              mode="outlined"
              keyboardType="url"
              autoCapitalize="none"
            />
            
            {/* Note */}
            <TextInput
              label="Note"
              value={note}
              onChangeText={setNote}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={3}
            />
          </Card.Content>
        </Card>
        
        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.button}
            disabled={isLoading}
          >
            Annulla
          </Button>
          <Button
            mode="contained"
            onPress={createUtente}
            style={styles.button}
            loading={isLoading}
            disabled={isLoading}
          >
            Crea Utente
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 16,
    elevation: 1,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 16,
  },
  input: {
    marginVertical: 8,
  },
  tipiContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  tipiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tipoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 4,
    width: '48%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  tipoLabel: {
    marginLeft: 8,
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
});

export default NuovoUtenteScreen; 