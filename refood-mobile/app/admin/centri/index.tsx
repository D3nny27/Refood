import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Card, Divider, FAB, Button, ActivityIndicator, Searchbar, Chip, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PRIMARY_COLOR, STORAGE_KEYS, API_URL } from '../../../src/config/constants';
import { useAuth } from '../../../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

// Interfaccia per il tipo Centro
interface Centro {
  id: number;
  nome: string;
  indirizzo: string;
  telefono: string;
  email: string;
  tipo: string;
  operatori_assegnati?: number;
}

export default function GestioneCentriScreen() {
  const { user } = useAuth();
  const [centri, setCentri] = useState<Centro[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCentri, setFilteredCentri] = useState<Centro[]>([]);

  // Carica i centri all'avvio
  useEffect(() => {
    loadCentri();
  }, []);

  // Filtra i centri quando cambia la query di ricerca
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCentri(centri);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = centri.filter(centro => 
        centro.nome.toLowerCase().includes(query) || 
        centro.indirizzo.toLowerCase().includes(query) ||
        centro.tipo.toLowerCase().includes(query)
      );
      setFilteredCentri(filtered);
    }
  }, [searchQuery, centri]);

  // Funzione per caricare i centri dal server
  const loadCentri = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      const response = await fetch(`${API_URL}/centri`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Errore nel caricamento dei centri (${response.status})`);
      }

      const data = await response.json();
      
      if (data && Array.isArray(data.centri)) {
        setCentri(data.centri);
        setFilteredCentri(data.centri);
      } else {
        setCentri([]);
        setFilteredCentri([]);
      }
    } catch (error) {
      console.error('Errore nel caricamento dei centri:', error);
      Alert.alert('Errore', 'Impossibile caricare i centri. Verifica la connessione e riprova.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Gestisce il refresh tramite pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadCentri();
  };

  // Naviga alla schermata di modifica del centro
  const editCentro = (centro: Centro) => {
    router.push({
      pathname: '/admin/centri/modifica',
      params: { id: centro.id.toString() }
    });
  };

  // Naviga alla schermata di associazione operatori
  const manageOperatori = (centro: Centro) => {
    router.push({
      pathname: '/admin/centri/operatori',
      params: { id: centro.id.toString() }
    });
  };

  // Renderizza un item della lista dei centri
  const renderCentroItem = ({ item }: { item: Centro }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.nome}</Text>
          <Chip icon="domain" style={styles.typeChip}>{item.tipo}</Chip>
        </View>
        
        <Divider style={styles.divider} />
        
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
            <Text style={styles.infoText}>{item.indirizzo}</Text>
          </View>
          
          {item.telefono && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="phone" size={16} color="#666" />
              <Text style={styles.infoText}>{item.telefono}</Text>
            </View>
          )}
          
          {item.email && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="email" size={16} color="#666" />
              <Text style={styles.infoText}>{item.email}</Text>
            </View>
          )}
          
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="account-group" size={16} color="#666" />
            <Text style={styles.infoText}>
              {item.operatori_assegnati 
                ? `${item.operatori_assegnati} operatori assegnati` 
                : 'Nessun operatore assegnato'}
            </Text>
          </View>
        </View>
      </Card.Content>
      
      <Card.Actions style={styles.cardActions}>
        <Button 
          mode="text" 
          onPress={() => editCentro(item)}
          icon="pencil"
        >
          Modifica
        </Button>
        <Button 
          mode="outlined" 
          onPress={() => manageOperatori(item)}
          icon="account-multiple-plus"
        >
          Gestisci Operatori
        </Button>
      </Card.Actions>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Cerca centri..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento centri...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCentri}
          renderItem={renderCentroItem}
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
              <MaterialCommunityIcons name="domain-off" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Nessun centro corrisponde alla ricerca' : 'Nessun centro disponibile'}
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
      )}
      
      <FAB
        style={styles.fab}
        icon="plus"
        label="Nuovo Centro"
        onPress={() => router.push('/admin/centri/nuovo')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    elevation: 4,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f0f0f0',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80, // Extra padding per la FAB
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
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  typeChip: {
    backgroundColor: '#e8f5e9',
  },
  divider: {
    marginVertical: 8,
  },
  cardBody: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  cardActions: {
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: PRIMARY_COLOR,
  },
}); 