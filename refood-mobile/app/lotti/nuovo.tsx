import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Pressable, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, HelperText, Appbar, Card, Divider, Portal, Modal, Surface, List, useTheme, Title } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { createLotto, invalidateCache } from '../../src/services/lottiService';
import { PRIMARY_COLOR, RUOLI, STORAGE_KEYS, API_URL } from '../../src/config/constants';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DatePickerModal } from 'react-native-paper-dates';
import SelectDialog from '../../src/components/SelectDialog';
import Toast from 'react-native-toast-message';
import { it } from 'date-fns/locale';

// Definizione delle unità di misura disponibili, raggruppate per tipo
const UNITA_MISURA_GROUPS = {
  'Peso': ['kg', 'g'],
  'Volume': ['l', 'ml'],
  'Quantità': ['pz'],
};

// Lista semplice per il selettore
const UNITA_MISURA = ['kg', 'g', 'l', 'ml', 'pz'];

// Definizione delle unità di misura disponibili
const UNITA_MISURA_OPTIONS = [
  { label: 'Chilogrammi (kg)', value: 'kg' },
  { label: 'Grammi (g)', value: 'g' },
  { label: 'Litri (l)', value: 'l' },
  { label: 'Millilitri (ml)', value: 'ml' },
  { label: 'Pezzi (pz)', value: 'pz' },
];

export default function NuovoLottoScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Stato del form
  const [nome, setNome] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [quantita, setQuantita] = useState('');
  const [unitaMisura, setUnitaMisura] = useState('kg');
  const [dataScadenza, setDataScadenza] = useState<Date | null>(new Date());
  const [centri, setCentri] = useState<any[]>([]);
  const [centroSelezionato, setCentroSelezionato] = useState<any>(null);
  const [loadingCentri, setLoadingCentri] = useState(false);
  
  // Stati dei modali
  const [showUnitaPicker, setShowUnitaPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCentriPicker, setShowCentriPicker] = useState(false);
  
  // Validazione
  const [errors, setErrors] = useState({
    nome: false,
    quantita: false,
    dataScadenza: false,
    centro: false,
  });

  // Carica i centri disponibili all'avvio
  useEffect(() => {
    const caricaCentri = async () => {
      try {
        setLoadingCentri(true);
        const response = await fetch(`${API_URL}/lotti/centri`, {
          headers: {
            'Authorization': `Bearer ${await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN)}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Errore nel caricamento dei centri (${response.status})`);
        }
        
        const data = await response.json();
        if (data && data.centri) {
          setCentri(data.centri);
          if (data.centri.length === 1) {
            // Se c'è un solo centro, selezionalo automaticamente
            setCentroSelezionato(data.centri[0]);
          }
        }
      } catch (error) {
        console.error("Errore nel caricamento dei centri:", error);
        Alert.alert("Errore", "Impossibile caricare i centri disponibili");
      } finally {
        setLoadingCentri(false);
      }
    };
    
    caricaCentri();
  }, []);

  // Verifica se l'utente ha i permessi necessari
  useEffect(() => {
    if (user?.ruolo !== RUOLI.OPERATORE && user?.ruolo !== RUOLI.AMMINISTRATORE) {
      Alert.alert(
        'Accesso non autorizzato',
        'Non hai i permessi per creare nuovi lotti',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [user]);

  // Gestisce il cambio della data di scadenza
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDataScadenza(selectedDate);
      validateField('dataScadenza', selectedDate);
    }
  };

  // Valida un campo specifico
  const validateField = (field: string, value: any) => {
    let isValid = true;

    switch (field) {
      case 'nome':
        isValid = value.trim().length > 0;
        break;
      case 'quantita':
        isValid = !isNaN(parseFloat(value)) && parseFloat(value) > 0;
        break;
      case 'dataScadenza':
        // Non blocchiamo più date nel passato per permettere
        // l'inserimento di lotti già scaduti
        isValid = value instanceof Date && !isNaN(value.getTime());
        
        // Se la data è nel passato, mostriamo un'avvertenza ma permettiamo l'invio
        if (isValid && value < new Date()) {
          // Mostriamo un Toast di avviso
          Toast.show({
            type: 'info',
            text1: 'Data nel passato',
            text2: 'Stai inserendo un lotto con data di scadenza già passata. Sarà etichettato come scaduto (rosso).',
            visibilityTime: 5000,
          });
        }
        break;
      case 'centro':
        isValid = value !== null;
        break;
    }

    setErrors(prev => ({ ...prev, [field]: !isValid }));
    return isValid;
  };

  // Valida l'intero form
  const validateForm = () => {
    const nomeValid = validateField('nome', nome);
    const quantitaValid = validateField('quantita', quantita);
    const dataValid = validateField('dataScadenza', dataScadenza);
    const centroValid = validateField('centro', centroSelezionato);
    
    return nomeValid && quantitaValid && dataValid && centroValid;
  };

  // Invia il form per creare un nuovo lotto
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Errore', 'Alcuni campi non sono validi. Controlla e riprova.');
      return;
    }

    setLoading(true);
    console.log('Inizio processo di creazione lotto...');
    
    try {
      // Prepara i dati del lotto
      const lottoData = {
        nome,
        descrizione,
        quantita: parseFloat(quantita),
        unita_misura: unitaMisura,
        data_scadenza: dataScadenza?.toISOString().split('T')[0] as string,
        centro_id: centroSelezionato?.id || 1, // Usa l'ID del centro selezionato
      };
      
      console.log('Dati lotto preparati:', JSON.stringify(lottoData, null, 2));
      
      // Utilizziamo la funzione del servizio
      const result = await createLotto(lottoData);
      
      console.log('Risultato creazione lotto:', JSON.stringify(result));
      
      // Importante: invalida la cache prima di navigare
      invalidateCache();
      
      // Feedback immediato con Toast
      Toast.show({
        type: 'success',
        text1: 'Lotto creato con successo',
        text2: 'Stai per essere reindirizzato alla lista dei lotti',
        visibilityTime: 2000,
      });
      
      // Reindirizzamento diretto e immediato - senza alert
      setTimeout(() => {
        // Riduciamo il loading qui prima di navigare
        setLoading(false);
        
        console.log('Reindirizzamento alla lista lotti...');
        
        // Naviga alla schermata dei lotti. 
        // Il percorso deve corrispondere esattamente al file nella struttura
        router.navigate('/(tabs)');
        
        // Piccola pausa e poi vai specificamente alla tab lotti
        setTimeout(() => {
          router.navigate('/(tabs)/lotti');
        }, 100);
      }, 500);
      
    } catch (error: any) {
      console.error('Errore completo nella creazione del lotto:', error);
      setLoading(false);
      
      // Gestione errori come prima
      let errorMessage = 'Si è verificato un errore durante la creazione del lotto';
      let isAuthError = false;
      
      // Resto del codice di gestione errori...
      if (error.message === 'Sessione scaduta. Effettua nuovamente il login.') {
        errorMessage = error.message;
        isAuthError = true;
      } else if (error.message && error.message.includes('Non sei autorizzato')) {
        errorMessage = error.message;
        isAuthError = true;
      } else if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
        errorMessage = 'La richiesta è scaduta. Verificare che il server sia raggiungibile.';
      } else if (error.response) {
        // Errore con risposta dal server
        console.error('Risposta errore server:', error.response.status, error.response.data);
        
        if (error.response.status === 401) {
          errorMessage = 'Non sei autorizzato. Effettua nuovamente il login.';
          isAuthError = true;
        } else if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
          if (errorMessage.includes('Autenticazione richiesta')) {
            isAuthError = true;
          }
        } else if (error.response.status === 400) {
          errorMessage = 'Dati non validi. Verifica i campi inseriti.';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Mostra l'errore con Toast invece di Alert per maggiore visibilità
      Toast.show({
        type: 'error',
        text1: 'Errore nella creazione',
        text2: errorMessage,
        visibilityTime: 3000,
      });
      
      if (isAuthError) {
        // Piccola pausa prima di reindirizzare per problemi di auth
        setTimeout(async () => {
          await AsyncStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
          router.replace("/");
        }, 2000);
      }
    }
  };

  // Formatta la data per la visualizzazione
  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Nuovo Lotto" />
      </Appbar.Header>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.infoCard}>
          <MaterialCommunityIcons name="information" size={24} color={theme.colors.primary} style={styles.infoIcon} />
          <Text style={styles.infoCardText}>
            Lo stato del lotto (Verde, Arancione, Rosso) verrà calcolato automaticamente in base alla data di scadenza. 
            Non è necessario specificarlo.
          </Text>
        </Surface>
        
        <Card style={styles.formCard}>
          <Card.Title title="Informazioni Lotto" />
          <Card.Content>
            <TextInput
              label="Nome del lotto"
              value={nome}
              onChangeText={(text) => {
                setNome(text);
                validateField('nome', text);
              }}
              style={styles.input}
              error={errors.nome}
              mode="outlined"
              left={<TextInput.Icon icon="package-variant" />}
            />
            {errors.nome && <HelperText type="error">Il nome è obbligatorio</HelperText>}
            
            <TextInput
              label="Descrizione"
              value={descrizione}
              onChangeText={setDescrizione}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={3}
              left={<TextInput.Icon icon="text" />}
            />
            
            <View style={styles.row}>
              <TextInput
                label="Quantità"
                value={quantita}
                onChangeText={(text) => {
                  setQuantita(text);
                  validateField('quantita', text);
                }}
                keyboardType="numeric"
                style={[styles.input, styles.flex1]}
                error={errors.quantita}
                mode="outlined"
                left={<TextInput.Icon icon="scale" />}
              />
              
              <Pressable 
                style={styles.unitSelector}
                onPress={() => setShowUnitaPicker(true)}
              >
                <Surface style={[styles.unitDisplay, {borderColor: theme.colors.outline}]}>
                  <Text style={styles.unitText}>{unitaMisura}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={theme.colors.primary} />
                </Surface>
              </Pressable>
            </View>
            {errors.quantita && <HelperText type="error">Inserisci una quantità valida</HelperText>}
            
            {/* Selezione del centro */}
            <Pressable 
              style={styles.selectField}
              onPress={() => setShowCentriPicker(true)}
            >
              <Text style={styles.selectLabel}>Centro di origine</Text>
              <View style={[styles.selectValue, errors.centro && styles.errorBorder]}>
                {loadingCentri ? (
                  <Text>Caricamento centri...</Text>
                ) : centroSelezionato ? (
                  <Text>{centroSelezionato.nome}</Text>
                ) : (
                  <Text style={styles.selectPlaceholder}>Seleziona un centro</Text>
                )}
                <Ionicons name="chevron-down" size={20} color="#666" />
              </View>
              {errors.centro && <HelperText type="error">Seleziona un centro di origine</HelperText>}
            </Pressable>
          </Card.Content>
        </Card>
        
        <Card style={styles.formCard}>
          <Card.Title title="Data di Scadenza" />
          <Card.Content>
            <Pressable 
              onPress={() => setShowDatePicker(true)}
              style={({ pressed }) => [
                styles.dateSelector,
                { opacity: pressed ? 0.9 : 1 }
              ]}
            >
              <Surface style={[styles.dateSurface, errors.dataScadenza && styles.dateError]}>
                <Ionicons name="calendar" size={24} color={theme.colors.primary} style={styles.dateIcon} />
                <View style={styles.dateTextContainer}>
                  <Text style={styles.dateLabel}>Data di scadenza</Text>
                  <Text style={styles.dateValue}>{formatDate(dataScadenza)}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} />
              </Surface>
            </Pressable>
            {errors.dataScadenza && <HelperText type="error">La data di scadenza deve essere futura</HelperText>}
            <Text style={styles.infoText}>
              È possibile inserire anche date passate per i prodotti già scaduti.
              I lotti con data di scadenza nel passato saranno automaticamente etichettati come scaduti (rosso).
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
      
      <View style={styles.footer}>
        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={styles.button}
          contentStyle={styles.buttonContent}
          icon="close"
        >
          Annulla
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={[styles.button, styles.primaryButton]}
          contentStyle={styles.buttonContent}
          loading={loading}
          disabled={loading}
          icon="check"
        >
          Salva
        </Button>
      </View>

      {/* Modal per selezionare l'unità di misura */}
      <Portal>
        <Modal
          visible={showUnitaPicker}
          onDismiss={() => setShowUnitaPicker(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Surface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleziona unità di misura</Text>
            </View>
            <Divider />
            <ScrollView style={styles.modalScroll}>
              {Object.entries(UNITA_MISURA_GROUPS).map(([group, units]) => (
                <View key={group}>
                  <Text style={styles.modalGroup}>{group}</Text>
                  {units.map(unit => (
                    <List.Item
                      key={unit}
                      title={unit}
                      onPress={() => {
                        setUnitaMisura(unit);
                        setShowUnitaPicker(false);
                      }}
                      left={props => <List.Icon {...props} icon={
                        unit === unitaMisura ? "check-circle" : "circle-outline"
                      } />}
                      style={unit === unitaMisura ? styles.selectedItem : undefined}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
            <Divider />
            <View style={styles.modalFooter}>
              <Button 
                mode="text" 
                onPress={() => setShowUnitaPicker(false)}
              >
                Chiudi
              </Button>
            </View>
          </Surface>
        </Modal>
      </Portal>

      {/* Modale per il selettore di data */}
      <Portal>
        <Modal
          visible={showDatePicker}
          onDismiss={() => setShowDatePicker(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Surface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleziona data di scadenza</Text>
            </View>
            <Divider />
            <View style={styles.datePickerContainer}>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  style={styles.webDatePicker}
                  min={new Date().toISOString().split('T')[0]}
                  value={dataScadenza?.toISOString().split('T')[0]}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setDataScadenza(date);
                    validateField('dataScadenza', date);
                  }}
                />
              ) : (
                <DateTimePicker
                  value={dataScadenza || new Date()}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                  style={styles.datePicker}
                />
              )}
            </View>
            <Divider />
            <View style={styles.modalFooter}>
              <Button 
                mode="text" 
                onPress={() => setShowDatePicker(false)}
              >
                Chiudi
              </Button>
              <Button 
                mode="contained" 
                onPress={() => setShowDatePicker(false)}
              >
                Conferma
              </Button>
            </View>
          </Surface>
        </Modal>
      </Portal>

      {/* Modal per selezionare il centro */}
      <Portal>
        <Modal 
          visible={showCentriPicker} 
          onDismiss={() => setShowCentriPicker(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Title style={styles.modalTitle}>Seleziona centro</Title>
          <Divider style={styles.divider} />
          
          {centri.length === 0 ? (
            <Text style={styles.noCentriText}>
              Nessun centro disponibile.
            </Text>
          ) : (
            centri.map((centro) => (
              <List.Item
                key={centro.id}
                title={centro.nome}
                description={centro.indirizzo}
                onPress={() => {
                  setCentroSelezionato(centro);
                  setShowCentriPicker(false);
                  validateField('centro', centro);
                }}
                left={props => <List.Icon {...props} icon="domain" />}
                right={props => 
                  centroSelezionato?.id === centro.id ? 
                  <List.Icon {...props} icon="check" color={theme.colors.primary} /> : 
                  null
                }
                style={styles.listItem}
              />
            ))
          )}
          
          <Button 
            mode="outlined" 
            onPress={() => setShowCentriPicker(false)}
            style={styles.closeButton}
          >
            Chiudi
          </Button>
        </Modal>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  } as any,
  scrollView: {
    flex: 1,
  } as any,
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  } as any,
  formCard: {
    marginBottom: 16,
    elevation: 2,
  } as any,
  infoCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  } as any,
  infoIcon: {
    marginRight: 12,
  } as any,
  infoCardText: {
    flex: 1,
    fontSize: 14,
    color: '#0d47a1',
  } as any,
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  } as any,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  } as any,
  flex1: {
    flex: 1,
    marginRight: 8,
  } as any,
  unitSelector: {
    width: 90,
    height: 56,
    justifyContent: 'center',
  } as any,
  unitDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 4,
    height: 56,
    backgroundColor: '#fff',
  } as any,
  unitText: {
    fontSize: 16,
  } as any,
  dateSelector: {
    marginBottom: 16,
  } as any,
  dateSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    elevation: 1,
  } as any,
  dateError: {
    borderWidth: 1,
    borderColor: '#B00020',
  } as any,
  dateIcon: {
    marginRight: 16,
  } as any,
  dateTextContainer: {
    flex: 1,
  } as any,
  dateLabel: {
    fontSize: 12,
    color: '#666',
  } as any,
  dateValue: {
    fontSize: 16,
    marginTop: 4,
  } as any,
  infoText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
    elevation: 4,
  } as any,
  button: {
    flex: 1,
    marginHorizontal: 4,
  } as any,
  buttonContent: {
    paddingVertical: 8,
  } as any,
  primaryButton: {
    backgroundColor: PRIMARY_COLOR,
  } as any,
  modalContainer: {
    margin: 20,
    borderRadius: 8,
    overflow: 'hidden',
  } as any,
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    maxHeight: '80%',
  } as any,
  modalHeader: {
    padding: 16,
  } as any,
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  } as any,
  modalScroll: {
    maxHeight: 350,
  } as any,
  modalGroup: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#f5f5f5',
  } as any,
  selectedItem: {
    backgroundColor: '#e8f5e9',
  } as any,
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
  } as any,
  datePickerContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  datePicker: {
    width: '100%',
  } as any,
  webDatePicker: {
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: 12,
    fontSize: 16,
    width: '100%',
  } as any,
  selectField: {
    marginVertical: 8,
  },
  selectLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  selectValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  selectPlaceholder: {
    color: '#999',
  },
  errorBorder: {
    borderColor: 'red',
  },
  divider: {
    marginBottom: 10,
  },
  listItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    marginTop: 20,
  },
  noCentriText: {
    textAlign: 'center',
    marginVertical: 20,
    color: '#666',
  },
}); 