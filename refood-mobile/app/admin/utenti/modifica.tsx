import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Text, TextInput, Button, useTheme, HelperText, Divider, Title, Subheading, Card, RadioButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

// Importa il servizio utenti
import utentiService from '../../../src/services/utentiService';
import { Utente } from '../../../src/types';

// Tipi di utente disponibili
const TIPI_UTENTE = [
  { value: 'Centro Sociale', label: 'Centro Sociale', icon: 'home-heart' },
  { value: 'Centro Riciclaggio', label: 'Centro Riciclaggio', icon: 'recycle' },
  { value: 'Supermercato', label: 'Supermercato', icon: 'store' },
  { value: 'Ristorante', label: 'Ristorante', icon: 'food' },
  { value: 'Altro', label: 'Altro', icon: 'domain' },
];

const ModificaUtenteScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  
  // Estrai l'ID dell'utente dai parametri della route
  const { utenteId } = route.params as { utenteId: number };
  
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
  const [isFetching, setIsFetching] = useState(true);
  
  // Carica i dati dell'utente all'avvio
  useEffect(() => {
    const fetchUtente = async () => {
      try {
        setIsFetching(true);
        
        const response = await utentiService.getUtente(utenteId);
        
        if (response.success && response.utente) {
          const utente = response.utente;
          
          // Popoliamo i campi del form con i dati dell'utente
          setNome(utente.nome || '');
          setIndirizzo(utente.indirizzo || '');
          setEmail(utente.email || '');
          setTelefono(utente.telefono || '');
          setSitoWeb(utente.sito_web || '');
          setNote(utente.note || '');
          setTipo(utente.tipo || 'Centro Sociale');
        } else {
          Toast.show({
            type: 'error',
            text1: 'Errore',
            text2: response.message || 'Impossibile caricare i dati dell\'utente',
          });
          navigation.goBack();
        }
      } catch (error) {
        console.error('Errore nel caricamento dell\'utente:', error);
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: 'Impossibile caricare i dati dell\'utente',
        });
        navigation.goBack();
      } finally {
        setIsFetching(false);
      }
    };
    
    fetchUtente();
  }, [utenteId, navigation]);
  
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
  
  // Funzione per aggiornare un utente
  const updateUtente = async () => {
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
        email: email || null,
        telefono: telefono || null,
        sito_web: sito_web || null,
        note: note || null,
        tipo,
      };
      
      console.log('Invio dati per aggiornamento utente:', utenteData);
      
      // Chiamata all'API
      const response = await utentiService.updateUtente(utenteId, utenteData);
      
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Utente aggiornato',
          text2: 'L\'utente è stato aggiornato con successo',
        });
        
        // Torna alla lista
        navigation.goBack();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: response.message || 'Impossibile aggiornare l\'utente',
        });
      }
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dell\'utente:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Impossibile aggiornare l\'utente',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Mostra un indicatore di caricamento durante il recupero dei dati
  if (isFetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Caricamento dati utente...</Text>
      </View>
    );
  }
  
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
            <Title style={styles.title}>Modifica Utente</Title>
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
                        name={item.icon as any} 
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
            onPress={updateUtente}
            style={styles.button}
            loading={isLoading}
            disabled={isLoading}
          >
            Aggiorna
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});

export default ModificaUtenteScreen; 