import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Button, TextInput, Dialog, Portal, Divider, Searchbar, IconButton, Title, useTheme, Avatar } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Importa il servizio utenti
import utentiService from '../../../src/services/utentiService';

// Interfaccia per l'attore/operatore
interface Attore {
  id: number;
  nome?: string;
  cognome?: string;
  email?: string;
  ruolo?: string;
}

const GestioneOperatoriScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  
  // Estrai l'ID dell'utente dai parametri della route
  const { utenteId } = route.params as { utenteId: number };
  
  // Stati
  const [operatori, setOperatori] = useState<Attore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [utenteInfo, setUtenteInfo] = useState<{ nome: string, tipo: string }>({ nome: '', tipo: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOperatori, setFilteredOperatori] = useState<Attore[]>([]);
  
  // Stati per la dialog di aggiunta operatore
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newOperatorEmail, setNewOperatorEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [emailError, setEmailError] = useState('');
  
  // Carica i dati degli operatori all'avvio
  useEffect(() => {
    loadOperatori();
  }, [utenteId]);
  
  // Funzione per caricare gli operatori e le info dell'utente
  const loadOperatori = async () => {
    try {
      setIsLoading(true);
      
      // Carica le informazioni dell'utente
      const utenteResponse = await utentiService.getUtenteById(utenteId);
      setUtenteInfo({
        nome: utenteResponse.nome || 'Utente',
        tipo: utenteResponse.tipo || 'Utente',
      });
      
      // Carica gli operatori associati
      const operatoriResponse = await utentiService.getAttoriAssociati(utenteId);
      
      if (operatoriResponse.success && operatoriResponse.attori) {
        setOperatori(operatoriResponse.attori);
        setFilteredOperatori(operatoriResponse.attori);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: operatoriResponse.message || 'Impossibile caricare gli operatori',
        });
      }
    } catch (error) {
      console.error('Errore nel caricamento degli operatori:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Impossibile caricare gli operatori',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Funzione per aggiungere un nuovo operatore
  const addOperatore = async () => {
    // Validazione email
    if (!newOperatorEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newOperatorEmail)) {
      setEmailError('Inserisci un indirizzo email valido');
      return;
    }
    
    setIsAdding(true);
    setEmailError('');
    
    try {
      // Converti l'email in ID utente
      let attoreId;
      try {
        const userResponse = await utentiService.getUserByEmail(newOperatorEmail);
        if (userResponse && userResponse.id) {
          attoreId = userResponse.id;
        } else {
          throw new Error('Utente non trovato');
        }
      } catch (emailError) {
        console.error('Errore nel recupero dell\'utente:', emailError);
        throw new Error('L\'email inserita non corrisponde ad alcun utente registrato');
      }

      // Ora che abbiamo l'ID, associamo l'utente
      const response = await utentiService.associaAttore(utenteId, attoreId);
      
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Operatore aggiunto',
          text2: response.message || 'Operatore aggiunto con successo',
        });
        
        // Resetta il form e ricarica gli operatori
        setNewOperatorEmail('');
        setShowAddDialog(false);
        loadOperatori();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: response.message || 'Impossibile aggiungere l\'operatore',
        });
      }
    } catch (error) {
      console.error('Errore nell\'aggiunta dell\'operatore:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Si è verificato un errore durante l\'aggiunta dell\'operatore',
      });
    } finally {
      setIsAdding(false);
    }
  };
  
  // Funzione per rimuovere un operatore
  const removeOperatore = async (operatoreId: number, nome: string) => {
    Alert.alert(
      'Rimuovi operatore',
      `Sei sicuro di voler rimuovere "${nome}" dagli operatori di questo utente?`,
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Rimuovi', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              const response = await utentiService.rimuoviAttore(utenteId, operatoreId);
              
              if (response.success) {
      Toast.show({
        type: 'success',
                  text1: 'Operatore rimosso',
                  text2: response.message || 'Operatore rimosso con successo',
                });
                
                // Ricarica gli operatori
                loadOperatori();
              } else {
                Toast.show({
                  type: 'error',
                  text1: 'Errore',
                  text2: response.message || 'Impossibile rimuovere l\'operatore',
                });
              }
            } catch (error) {
              console.error('Errore nella rimozione dell\'operatore:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
                text2: 'Si è verificato un errore durante la rimozione dell\'operatore',
      });
    } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };
  
  // Gestione della ricerca
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredOperatori(operatori);
      return;
    }
    
    const searchLower = searchQuery.toLowerCase().trim();
    const filtered = operatori.filter(operatore => 
      operatore.nome?.toLowerCase().includes(searchLower) ||
      operatore.cognome?.toLowerCase().includes(searchLower) ||
      operatore.email?.toLowerCase().includes(searchLower) ||
      `${operatore.nome} ${operatore.cognome}`.toLowerCase().includes(searchLower)
    );
    
    setFilteredOperatori(filtered);
  }, [searchQuery, operatori]);
  
  // Renderizza un operatore nella lista
  const renderOperatore = ({ item }: { item: Attore }) => {
    const nomeCompleto = `${item.nome || ''} ${item.cognome || ''}`.trim();
    
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.operatoreInfo}>
            <Avatar.Text 
          size={40} 
              label={nomeCompleto.substring(0, 2).toUpperCase() || "OP"} 
              color="white" 
              style={{ backgroundColor: colors.primary }} 
            />
            <View style={styles.operatoreDetails}>
              <Text style={styles.operatoreName}>{nomeCompleto || 'Utente'}</Text>
              <Text style={styles.operatoreEmail}>{item.email || 'Email non disponibile'}</Text>
              <Text style={styles.operatoreRuolo}>{item.ruolo || 'Ruolo non specificato'}</Text>
            </View>
            <IconButton
              icon="delete"
              size={24}
              onPress={() => removeOperatore(item.id, nomeCompleto)}
            />
          </View>
        </Card.Content>
      </Card>
    );
  };
  
  // Mostra un caricamento durante il fetch dei dati
  if (isLoading && operatori.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Caricamento operatori...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Info dell'utente */}
      <Card style={styles.headerCard}>
          <Card.Content>
          <Title>{utenteInfo.nome}</Title>
          <Text>{utenteInfo.tipo}</Text>
          </Card.Content>
        </Card>
      
      {/* Barra di ricerca */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Cerca operatori..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        <IconButton
          icon="account-plus"
          size={30}
          mode="contained"
          containerColor={colors.primary}
          iconColor="white"
          style={styles.addButton}
          onPress={() => setShowAddDialog(true)}
        />
      </View>
      
      {/* Lista operatori */}
      <FlatList
        data={filteredOperatori}
        renderItem={renderOperatore}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="account-off" size={64} color={colors.onSurfaceDisabled} />
            <Text style={styles.emptyText}>
              {searchQuery.trim() ? 'Nessun operatore corrisponde alla ricerca' : 'Nessun operatore associato'}
            </Text>
            <Button 
              mode="contained" 
              onPress={() => setShowAddDialog(true)}
              style={styles.emptyButton}
            >
              Aggiungi Operatore
            </Button>
                </View>
              }
            />
      
      {/* Dialog per aggiungere operatore */}
      <Portal>
        <Dialog visible={showAddDialog} onDismiss={() => {
          setShowAddDialog(false);
          setNewOperatorEmail('');
          setEmailError('');
        }}>
          <Dialog.Title>Aggiungi Operatore</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogInfo}>
              Inserisci l'email dell'utente da aggiungere come operatore.
              L'utente deve essere già registrato al sistema.
                  </Text>
            <TextInput
              label="Email"
              value={newOperatorEmail}
              onChangeText={setNewOperatorEmail}
              error={!!emailError}
              mode="outlined"
              style={styles.dialogInput}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {
              setShowAddDialog(false);
              setNewOperatorEmail('');
              setEmailError('');
            }}>
              Annulla
            </Button>
          <Button
              onPress={addOperatore} 
              loading={isAdding}
              disabled={isAdding}
            >
              Aggiungi
          </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchbar: {
    flex: 1,
    elevation: 0,
    backgroundColor: '#f0f0f0',
  },
  addButton: {
    marginLeft: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 80,
  },
  card: {
    marginBottom: 12,
    elevation: 1,
  },
  operatoreInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  operatoreDetails: {
    flex: 1,
    marginLeft: 12,
  },
  operatoreName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  operatoreEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  operatoreRuolo: {
    fontSize: 12,
    marginTop: 2,
    color: '#666',
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
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  emptyButton: {
    marginTop: 16,
  },
  dialogInfo: {
    marginBottom: 16,
  },
  dialogInput: {
    marginBottom: 8,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: -4,
    marginBottom: 8,
  },
}); 

export default GestioneOperatoriScreen; 