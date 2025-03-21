import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Appbar, Card, Divider, FAB, Button, ActivityIndicator, Searchbar, Chip, Avatar, List, Checkbox } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PRIMARY_COLOR, STORAGE_KEYS, API_URL } from '../../../src/config/constants';
import { useAuth } from '../../../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

// Interfaccia per l'operatore
interface Operatore {
  id: number;
  nome: string;
  cognome: string;
  email: string;
  assegnato: boolean;
}

// Interfaccia per il centro
interface Centro {
  id: number;
  nome: string;
  indirizzo: string;
  tipo: string;
}

export default function GestioneOperatoriScreen() {
  const params = useLocalSearchParams();
  const centroId = params.id as string;
  const { user } = useAuth();
  
  // Stati
  const [centro, setCentro] = useState<Centro | null>(null);
  const [operatori, setOperatori] = useState<Operatore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOperatori, setFilteredOperatori] = useState<Operatore[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [operatoriSelezionati, setOperatoriSelezionati] = useState<Record<number, boolean>>({});

  // Carica i dati all'avvio
  useEffect(() => {
    if (centroId) {
      loadCentro();
      loadOperatori();
    } else {
      Alert.alert('Errore', 'ID centro non valido', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }
  }, [centroId]);

  // Filtra gli operatori quando cambia la query di ricerca
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredOperatori(operatori);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = operatori.filter(operatore => 
        operatore.nome.toLowerCase().includes(query) || 
        operatore.cognome.toLowerCase().includes(query) ||
        operatore.email.toLowerCase().includes(query)
      );
      setFilteredOperatori(filtered);
    }
  }, [searchQuery, operatori]);

  // Inizializza lo stato degli operatori selezionati quando vengono caricati
  useEffect(() => {
    const selected: Record<number, boolean> = {};
    operatori.forEach(op => {
      selected[op.id] = op.assegnato;
    });
    setOperatoriSelezionati(selected);
  }, [operatori]);

  // Controlla se ci sono modifiche quando cambia la selezione
  useEffect(() => {
    if (operatori.length > 0) {
      const hasAnyChange = operatori.some(op => operatoriSelezionati[op.id] !== op.assegnato);
      setHasChanges(hasAnyChange);
    }
  }, [operatoriSelezionati, operatori]);

  // Funzione per caricare i dati del centro
  const loadCentro = async () => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      const response = await fetch(`${API_URL}/centri/${centroId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Errore nel caricamento del centro (${response.status})`);
      }

      const data = await response.json();
      
      if (data && data.centro) {
        setCentro(data.centro);
      }
    } catch (error) {
      console.error('Errore nel caricamento del centro:', error);
      Alert.alert('Errore', 'Impossibile caricare i dettagli del centro.');
    }
  };

  // Funzione per caricare gli operatori e le loro associazioni
  const loadOperatori = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      const response = await fetch(`${API_URL}/centri/${centroId}/operatori`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Errore nel caricamento degli operatori (${response.status})`);
      }

      const data = await response.json();
      
      if (data && Array.isArray(data.operatori)) {
        setOperatori(data.operatori);
        setFilteredOperatori(data.operatori);
      } else {
        setOperatori([]);
        setFilteredOperatori([]);
      }
    } catch (error) {
      console.error('Errore nel caricamento degli operatori:', error);
      Alert.alert('Errore', 'Impossibile caricare gli operatori. Verifica la connessione e riprova.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Gestisce il refresh tramite pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadOperatori();
  };

  // Gestisce la selezione/deselezione di un operatore
  const toggleOperatore = (id: number) => {
    setOperatoriSelezionati(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Salva le associazioni operatori-centro
  const salvaAssociazioni = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      // Prepara i dati da inviare
      const operatoriDaAssegnare = Object.entries(operatoriSelezionati)
        .filter(([_, isSelected]) => isSelected)
        .map(([id, _]) => parseInt(id));
      
      // Effettua la richiesta POST al server
      const response = await fetch(`${API_URL}/centri/${centroId}/operatori`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operatori_ids: operatoriDaAssegnare }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Errore nel salvataggio delle associazioni (${response.status})`);
      }

      // Associazioni salvate con successo
      Toast.show({
        type: 'success',
        text1: 'Associazioni salvate con successo',
        visibilityTime: 3000,
      });
      
      // Ricarica i dati per aggiornare la lista
      loadOperatori();
      setHasChanges(false);
    } catch (error: any) {
      console.error('Errore nel salvataggio delle associazioni:', error);
      
      Alert.alert(
        'Errore',
        error.message || 'Si è verificato un errore durante il salvataggio delle associazioni.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  // Renderizza un item della lista degli operatori
  const renderOperatoreItem = ({ item }: { item: Operatore }) => (
    <List.Item
      title={`${item.nome} ${item.cognome}`}
      description={item.email}
      left={props => (
        <Avatar.Icon 
          {...props} 
          icon="account" 
          size={40} 
          style={styles.avatar} 
          color="#fff"
        />
      )}
      right={props => (
        <Checkbox
          status={operatoriSelezionati[item.id] ? 'checked' : 'unchecked'}
          onPress={() => toggleOperatore(item.id)}
        />
      )}
      style={[
        styles.listItem, 
        operatoriSelezionati[item.id] && styles.selectedItem
      ]}
      onPress={() => toggleOperatore(item.id)}
    />
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={centro ? `Operatori: ${centro.nome}` : 'Gestione Operatori'} />
        {hasChanges && (
          <Appbar.Action 
            icon="content-save" 
            onPress={salvaAssociazioni} 
            disabled={saving}
          />
        )}
      </Appbar.Header>
      
      {centro && (
        <Card style={styles.centroCard}>
          <Card.Content>
            <Text style={styles.centroTitle}>{centro.nome}</Text>
            <View style={styles.centroInfo}>
              <Chip icon="domain" style={styles.centroChip}>{centro.tipo}</Chip>
              <Text style={styles.centroIndirizzo}>{centro.indirizzo}</Text>
            </View>
          </Card.Content>
        </Card>
      )}
      
      <View style={styles.header}>
        <Searchbar
          placeholder="Cerca operatori..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento operatori...</Text>
        </View>
      ) : (
        <>
          <View style={styles.selectionHeader}>
            <Text style={styles.selectionText}>
              {Object.values(operatoriSelezionati).filter(Boolean).length} operatori selezionati
            </Text>
            <Button 
              mode="text" 
              onPress={() => {
                const newState = {};
                operatori.forEach(op => {
                  newState[op.id] = false;
                });
                setOperatoriSelezionati(newState);
              }}
              disabled={!Object.values(operatoriSelezionati).some(Boolean)}
            >
              Deseleziona tutti
            </Button>
          </View>
          
          <FlatList
            data={filteredOperatori}
            renderItem={renderOperatoreItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[PRIMARY_COLOR]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="account-off" size={64} color="#ccc" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Nessun operatore corrisponde alla ricerca' : 'Nessun operatore disponibile'}
                </Text>
                {searchQuery && (
                  <Button 
                    mode="text"
                    onPress={() => setSearchQuery('')}
                    style={styles.resetButton}
                  >
                    Resetta ricerca
                  </Button>
                )}
              </View>
            }
          />
        </>
      )}
      
      {hasChanges && (
        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={salvaAssociazioni}
            style={styles.saveButton}
            loading={saving}
            disabled={saving}
            icon="content-save"
          >
            Salva Modifiche
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centroCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  centroTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  centroInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  centroChip: {
    backgroundColor: '#e8f5e9',
    marginRight: 8,
    marginBottom: 4,
  },
  centroIndirizzo: {
    color: '#666',
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#fff',
    elevation: 1,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f0f0f0',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
  },
  selectionText: {
    color: '#666',
  },
  listContent: {
    paddingBottom: 80, // Extra padding per il pulsante di salvataggio
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  resetButton: {
    marginTop: 8,
  },
  listItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedItem: {
    backgroundColor: '#e8f5e9',
  },
  avatar: {
    backgroundColor: PRIMARY_COLOR,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 8,
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
  },
}); 