import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform, TouchableOpacity } from 'react-native';
import { Text, FAB, useTheme, Button, Divider, Searchbar, Card, IconButton, Surface, Portal, Modal } from 'react-native-paper';
import { ScrollView } from 'react-native-gesture-handler';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import utentiService from '../../../src/services/utentiService';
import notificheService from '../../../src/services/notificheService';
import { useAuth } from '../../../src/context/AuthContext';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, STORAGE_KEYS } from '../../../src/config/constants';

// Componenti
import StyledFilterModal from '../../../src/components/StyledFilterModal';
import { Utente } from '../../../src/types/user';

// Definizione del tipo di navigazione
type RootStackParamList = {
  ModificaUtente: { utenteId: number };
  OperatoriUtente: { utenteId: number };
  NuovoUtente: undefined;
};

// Funzione helper per gestire errori
const getErrorMessage = (error: any, defaultMessage: string = 'Si è verificato un errore') => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return defaultMessage;
};

const UtentiScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>(); // Uso any per semplificare, ma idealmente dovremmo usare NavigationProp<RootStackParamList>
  const { user } = useAuth();
  
  // Stati
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUtenti, setFilteredUtenti] = useState<Utente[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterAtivo, setFilterAtivo] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUtenteId, setSelectedUtenteId] = useState<number | null>(null);

  // Funzione per renderizzare il dialog di conferma
  const renderConfirmDialog = () => (
    showDeleteDialog && (
      <Portal>
        <Modal visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Surface style={{ margin: 20, borderRadius: 8, padding: 16 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>Conferma eliminazione</Text>
            <Text style={{ marginBottom: 24 }}>Sei sicuro di voler eliminare questo utente?</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Button onPress={() => setShowDeleteDialog(false)} style={{ marginRight: 8 }}>Annulla</Button>
              <Button mode="contained" onPress={handleDeleteUtente}>Elimina</Button>
            </View>
          </Surface>
        </Modal>
      </Portal>
    )
  );
  
  // Caricamento dei dati
  const loadUtenti = useCallback(async (showFullLoading = true) => {
    try {
      if (showFullLoading) setIsLoading(true);
      
      // Chiamata al servizio utenti
      const response = await utentiService.getUtenti();
      
      if (response.data) {
        console.log(`Ricevuti ${response.data.length} utenti dal server`);
        setUtenti(response.data);
        setFilteredUtenti(response.data);
      } else {
        console.error('Errore nel caricamento degli utenti');
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: 'Impossibile caricare gli utenti'
        });
      }
    } catch (error) {
      console.error('Errore nel caricamento degli utenti:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: getErrorMessage(error, 'Impossibile caricare gli utenti')
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  
  // Gestione delle notifiche
  useEffect(() => {
    // Configurazione listener notifiche
    const unsubscribe = () => {}; // Placeholder per ora, da implementare correttamente
    
    // Pulizia listener
    return () => {
      unsubscribe();
    };
  }, [loadUtenti]);
  
  // Carica i dati quando la schermata diventa attiva
  useFocusEffect(
    useCallback(() => {
      loadUtenti();
    }, [loadUtenti])
  );
  
  // Gestione ricerca
  useEffect(() => {
    if (!searchQuery.trim() && !filterAtivo) {
      setFilteredUtenti(utenti);
      return;
    }
    
    let result = [...utenti];
    
    // Applica filtro per stato
    if (filterAtivo) {
      result = result.filter(utente => utente.tipo === filterAtivo);
    }
    
    // Applica filtro di ricerca testuale
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase().trim();
      result = result.filter(utente => 
        utente.nome?.toLowerCase().includes(searchLower) ||
        utente.indirizzo?.toLowerCase().includes(searchLower) ||
        utente.email?.toLowerCase().includes(searchLower) ||
        utente.telefono?.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredUtenti(result);
  }, [searchQuery, utenti, filterAtivo]);
  
  // Gestione refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadUtenti(false);
  };
  
  // Gestione filtri
  const handleFilters = (filter: string) => {
    setModalVisible(false);
    setFilterAtivo(filter);
  };
  
  // Gestione eliminazione utente
  const handleDeleteUtente = async () => {
    if (!selectedUtenteId) return;
    
    try {
      setIsLoading(true);
      
      // Otteniamo il token di autenticazione
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      
      // Effettuiamo una chiamata DELETE diretta all'API
      const response = await axios.delete(`${API_URL}/utenti/${selectedUtenteId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      Toast.show({
        type: 'success',
        text1: 'Utente eliminato',
        text2: 'L\'utente è stato eliminato con successo'
      });
        
      // Ricarica la lista degli utenti
      loadUtenti(false);
    } catch (error) {
      console.error('Errore nell\'eliminazione dell\'utente:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: getErrorMessage(error, 'Impossibile eliminare l\'utente')
      });
    } finally {
      setShowDeleteDialog(false);
      setSelectedUtenteId(null);
      setIsLoading(false);
    }
  };
  
  // Conferma eliminazione
  const confirmDelete = (utenteId: number) => {
    setSelectedUtenteId(utenteId);
    setShowDeleteDialog(true);
  };
  
  // Renderizzo UI
  return (
    <View style={styles.container}>
      {/* Barra di ricerca */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Cerca utente..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        <IconButton
          icon="filter"
          size={24}
          iconColor={filterAtivo ? colors.primary : colors.onSurface}
          style={styles.filterButton}
          onPress={() => setModalVisible(true)}
        />
      </View>
      
      {/* Filtri attivi */}
      {filterAtivo && (
        <View style={styles.activeFilterContainer}>
          <Text style={styles.activeFilterText}>
            Filtro attivo: {filterAtivo}
          </Text>
          <IconButton
            icon="close"
            size={16}
            onPress={() => setFilterAtivo('')}
          />
        </View>
      )}
      
      {/* Lista utenti */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
        >
          {filteredUtenti.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nessun utente trovato</Text>
            </View>
          ) : (
            filteredUtenti.map(utente => (
              <Card
                key={utente.id}
                style={styles.card}
                onPress={() => navigation.navigate('ModificaUtente', { utenteId: utente.id })}
              >
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{utente.nome}</Text>
                    <Text style={styles.cardType}>{utente.tipo}</Text>
                  </View>
                  {utente.indirizzo && (
                    <Text style={styles.cardDetail}>Indirizzo: {utente.indirizzo}</Text>
                  )}
                  {utente.email && (
                    <Text style={styles.cardDetail}>Email: {utente.email}</Text>
                  )}
                  {utente.telefono && (
                    <Text style={styles.cardDetail}>Telefono: {utente.telefono}</Text>
                  )}
                </Card.Content>
                <Card.Actions style={styles.cardActions}>
                  <Button
                    icon="pencil"
                    mode="text"
                    onPress={() => navigation.navigate('ModificaUtente', { utenteId: utente.id })}
                  >
                    Modifica
                  </Button>
                  <Button
                    icon="account-multiple"
                    mode="text"
                    onPress={() => navigation.navigate('OperatoriUtente', { utenteId: utente.id })}
                  >
                    Operatori
                  </Button>
                  <Button
                    icon="delete"
                    mode="text"
                    textColor={colors.error}
                    onPress={() => confirmDelete(utente.id)}
                  >
                    Elimina
                  </Button>
                </Card.Actions>
              </Card>
            ))
          )}
        </ScrollView>
      )}
      
      {/* FAB per aggiungere nuovo utente */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('NuovoUtente')}
        color="#fff"
      />
      
      {/* Modale per i filtri */}
      <StyledFilterModal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        onApply={() => setModalVisible(false)}
        onReset={() => {
          setFilterAtivo('');
          setModalVisible(false);
        }}
        title="Filtri Utenti"
      >
        <View style={styles.filterContainer}>
          <Text style={styles.filterTitle}>Tipo di utente</Text>
          <View style={styles.filterOptions}>
            {['Canale sociale', 'Centro riciclo', 'Privato'].map(tipo => (
              <Button
                key={tipo}
                mode={filterAtivo === tipo ? 'contained' : 'outlined'}
                onPress={() => setFilterAtivo(filterAtivo === tipo ? '' : tipo)}
                style={styles.filterButton}
              >
                {tipo}
              </Button>
            ))}
          </View>
        </View>
      </StyledFilterModal>
      
      {/* Dialog di conferma eliminazione */}
      {renderConfirmDialog()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
  },
  searchbar: {
    flex: 1,
    elevation: 0,
    backgroundColor: '#f0f0f0',
  },
  filterButton: {
    margin: 5,
  },
  activeFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    padding: 5,
    paddingLeft: 10,
  },
  activeFilterText: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  card: {
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardType: {
    fontSize: 14,
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 3,
  },
  cardActions: {
    justifyContent: 'flex-end',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
  filterContainer: {
    padding: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    marginRight: 10,
    marginBottom: 10,
  },
});

export default UtentiScreen; 