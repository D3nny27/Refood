import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Card, Divider, FAB, Button, ActivityIndicator, Searchbar, Chip, IconButton, Title, Paragraph, Badge } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PRIMARY_COLOR } from '../../../src/config/constants';
import { useAuth } from '../../../src/context/AuthContext';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import utentiService from '../../../src/services/utentiService';
import { Utente } from '../../../src/types/user';

export default function GestioneCentriScreen() {
  const { user } = useAuth();
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUtenti, setFilteredUtenti] = useState<Utente[]>([]);

  // Carica gli utenti all'avvio
  useEffect(() => {
    loadUtenti();
  }, []);

  // Filtra gli utenti quando cambia la query di ricerca
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUtenti(utenti);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = utenti.filter(utente => 
        utente.nome?.toLowerCase().includes(query) || 
        utente.indirizzo?.toLowerCase().includes(query) ||
        utente.tipo?.toLowerCase().includes(query)
      );
      setFilteredUtenti(filtered);
    }
  }, [searchQuery, utenti]);

  // Funzione per caricare gli utenti dal server
  const loadUtenti = async () => {
    setLoading(true);
    try {
      console.log('Richiesta utenti in corso tramite utentiService...');
      
      // Usando il nuovo servizio utenti
      const response = await utentiService.getUtenti({}, true);
      
      console.log(`Trovati ${response.data.length} utenti`);
      setUtenti(response.data);
      setFilteredUtenti(response.data);
    } catch (error) {
      console.error('Errore nel caricamento degli utenti:', error);
      Alert.alert('Errore', 'Impossibile caricare gli utenti. Verifica la connessione e riprova.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Gestisce il refresh tramite pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadUtenti();
  };

  // Naviga alla schermata di modifica dell'utente
  const editUtente = (utente: Utente) => {
    router.push({
      pathname: '/admin/centri/modifica',
      params: { id: utente.id.toString() }
    });
  };

  // Naviga alla schermata di associazione operatori
  const manageOperatori = (utente: Utente) => {
    router.push({
      pathname: '/admin/centri/operatori',
      params: { id: utente.id.toString() }
    });
  };

  // Funzione per associare l'amministratore corrente all'utente
  const associaAmministratore = async (utente: Utente) => {
    try {
      if (!user?.id) {
        throw new Error('ID utente non disponibile');
      }
      
      console.log(`Associazione dell'attore ${user.id} all'utente ${utente.id}...`);
      
      // Utilizzo del nuovo servizio
      await utentiService.associaAttore(utente.id, user.id);
      
      Toast.show({
        type: 'success',
        text1: 'Associazione completata',
        text2: `Sei stato associato all'utente ${utente.nome}`,
        visibilityTime: 3000,
      });
      
      // Ricarica la lista
      onRefresh();
    } catch (error: any) {
      console.error('Errore nell\'associazione dell\'attore:', error);
      
      // Verifica se è un errore di conflitto (già associato)
      if (error.response && error.response.status === 409) {
        Toast.show({
          type: 'info',
          text1: 'Informazione',
          text2: 'Sei già associato a questo utente',
          visibilityTime: 3000,
        });
        return;
      }
      
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: error.message || 'Si è verificato un errore durante l\'associazione',
        visibilityTime: 4000,
      });
    }
  };

  // Renderizza un item della lista degli utenti
  const renderUtenteItem = ({ item }: { item: Utente }) => {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Title>{item.nome}</Title>
              <Paragraph>{item.indirizzo || 'Indirizzo non specificato'}</Paragraph>
              <Chip style={styles.tipoChip}>{item.tipo_descrizione || item.tipo}</Chip>
            </View>
            {item.operatori_assegnati && (
              <Badge style={styles.badge} size={24}>
                {item.operatori_assegnati}
              </Badge>
            )}
          </View>
        </Card.Content>
        <Card.Actions style={styles.cardActions}>
          <Button 
            icon="account-group" 
            mode="text" 
            onPress={() => manageOperatori(item)}
          >
            <Text>Operatori</Text>
          </Button>
          <Button 
            icon="pencil" 
            mode="text" 
            onPress={() => editUtente(item)}
          >
            <Text>Modifica</Text>
          </Button>
          <Button 
            icon="link-variant" 
            mode="text" 
            onPress={() => associaAmministratore(item)}
          >
            <Text>Associa</Text>
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Cerca utenti..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
        <Button 
          mode="text" 
          onPress={onRefresh}
          icon="refresh"
          style={{ marginTop: 8 }}
        >
          <Text>Ricarica</Text>
        </Button>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento utenti...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUtenti}
          renderItem={renderUtenteItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
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
                {searchQuery ? 'Nessun utente corrisponde alla ricerca' : 'Nessun utente disponibile'}
              </Text>
              {searchQuery && (
                <Button 
                  mode="text"
                  onPress={() => setSearchQuery('')}
                  style={styles.resetButton}
                >
                  <Text>Resetta ricerca</Text>
                </Button>
              )}
            </View>
          }
        />
      )}
      
      <FAB
        style={styles.fab}
        icon="plus"
        label="Nuovo Utente"
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
  titleContainer: {
    flexDirection: 'column',
  },
  tipoChip: {
    backgroundColor: '#e8f5e9',
  },
  divider: {
    marginVertical: 8,
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
  badge: {
    backgroundColor: '#4caf50',
    marginLeft: 8,
  },
}); 