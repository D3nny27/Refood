import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Searchbar, Button, Chip, Text, IconButton, FAB, Card, Divider } from 'react-native-paper';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Lotto, getLotti, LottoFiltri, invalidateCache } from '../../src/services/lottiService';
import LottoCard from '../../src/components/LottoCard';
import StyledFilterModal from '../../src/components/StyledFilterModal';
import { RUOLI, PRIMARY_COLOR, STATUS_COLORS } from '../../src/config/constants';
import { router } from 'expo-router';

// Costanti locali per gli stati dei lotti disponibili
const STATI_LOTTI = ['Verde', 'Arancione', 'Rosso'];

export default function LottiScreen() {
  const { user } = useAuth();
  const [lotti, setLotti] = useState<Lotto[]>([]);
  const [filteredLotti, setFilteredLotti] = useState<Lotto[]>([]);
  const [filtri, setFiltri] = useState<LottoFiltri>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  
  // Stati selezionati nei filtri
  const [selectedStato, setSelectedStato] = useState<string | null>(null);
  
  // Determina se l'utente può creare nuovi lotti (solo operatori/admin)
  const canCreateLotto = user?.ruolo === RUOLI.OPERATORE || user?.ruolo === RUOLI.AMMINISTRATORE;

  // Carica i lotti al primo rendering e quando cambiano i filtri
  useEffect(() => {
    loadLotti();
  }, [filtri]);

  // Filtra e ordina i lotti in base alla ricerca
  useEffect(() => {
    if (lotti.length === 0) {
      setFilteredLotti([]);
      return;
    }

    // Filtra i lotti in base alla ricerca locale
    let result = [...lotti];
    
    // Filtra in base al testo di ricerca (instantaneo)
    if (searchQuery.trim() !== '') {
      const searchLower = searchQuery.toLowerCase().trim();
      result = result.filter(lotto => 
        lotto.nome.toLowerCase().includes(searchLower)
      );
    }

    // Ordina i lotti in ordine alfabetico per nome
    result.sort((a, b) => a.nome.localeCompare(b.nome));
    
    setFilteredLotti(result);
  }, [lotti, searchQuery]);

  // Funzione per caricare i lotti
  const loadLotti = async (forceRefresh = false) => {
    setLoading(true);
    try {
      console.log('Caricamento lotti in corso con filtri:', JSON.stringify(filtri));
      const response = await getLotti(filtri, forceRefresh);
      
      // Verifica che response.lotti esista
      if (response && Array.isArray(response.lotti)) {
        // Salva i lotti ordinati per nome
        const lottiOrdinati = [...response.lotti].sort((a, b) => 
          a.nome.localeCompare(b.nome)
        );
        setLotti(lottiOrdinati);
        console.log(`Caricati ${response.lotti.length} lotti con successo`);
      } else {
        console.warn('La risposta non contiene un array di lotti valido:', response);
        setLotti([]);
      }
    } catch (error: any) {
      console.error('Errore nel caricamento dei lotti:', error);
      
      // Gestione specifica degli errori
      let errorMessage = 'Impossibile caricare i lotti. Riprova più tardi.';
      
      if (error.message && typeof error.message === 'string') {
        if (error.message.includes('Timeout')) {
          errorMessage = 'Il server ha impiegato troppo tempo a rispondere. Verifica la connessione e riprova.';
        } else if (error.message.includes('Sessione scaduta')) {
          errorMessage = 'La tua sessione è scaduta. Effettua nuovamente il login.';
        } else {
          errorMessage = error.message;
        }
      }
      
      // In caso di errore, imposta un array vuoto e mostra un alert
      setLotti([]);
      Alert.alert('Errore', errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Gestisce l'aggiornamento tramite pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    // Forza l'aggiornamento dalla rete ignorando la cache
    invalidateCache();
    loadLotti(true);
  };

  // Applica la ricerca ai filtri (per la ricerca server-side)
  const onSearch = () => {
    setFiltri({ ...filtri, cerca: searchQuery });
  };

  // Resetta tutti i filtri
  const resetFiltri = () => {
    setFiltri({});
    setSelectedStato(null);
    setSearchQuery('');
    setFiltersVisible(false);
  };

  // Applica i filtri e chiude il modale
  const applyFilters = () => {
    const newFiltri: LottoFiltri = {};
    
    if (selectedStato) {
      newFiltri.stato = selectedStato;
    }
    
    if (searchQuery) {
      newFiltri.cerca = searchQuery;
    }
    
    setFiltri(newFiltri);
    setFiltersVisible(false);
  };

  // Naviga al dettaglio del lotto selezionato
  const navigateToLottoDetail = (lotto: Lotto) => {
    // Per ora solo mostriamo un messaggio, implementeremo la navigazione in seguito
    alert(`Dettaglio del lotto: ${lotto.nome}`);
    // router.push(`/lotti/${lotto.id}`);
  };

  // Naviga alla schermata di creazione lotto
  const navigateToCreateLotto = () => {
    router.push('/lotti/nuovo');
  };

  // Ottiene la descrizione dei filtri attualmente applicati
  const getFilterDescription = () => {
    const filterParts = [];
    
    if (filtri.stato) {
      filterParts.push(`stato: ${filtri.stato}`);
    }
    
    if (filtri.cerca) {
      filterParts.push(`ricerca: "${filtri.cerca}"`);
    }
    
    return filterParts.length > 0 
      ? `Filtri attivi: ${filterParts.join(', ')}`
      : 'Tutti i lotti disponibili';
  };

  return (
    <View style={styles.container}>
      {/* Header con barra di ricerca e filtri */}
      <Card style={styles.headerCard} elevation={4}>
        <Card.Content style={styles.searchContainer}>
          <Searchbar
            placeholder="Cerca lotti per nome"
            onChangeText={setSearchQuery}
            value={searchQuery}
            onSubmitEditing={onSearch}
            style={styles.searchbar}
          />
          <IconButton
            icon="filter-variant"
            mode="contained"
            onPress={() => setFiltersVisible(true)}
            iconColor="white"
            containerColor={PRIMARY_COLOR}
            style={styles.filterButton}
          />
        </Card.Content>
        
        {/* Indicatori di filtri attivi */}
        <Card.Content style={styles.filterChips}>
          {filtri.stato && (
            <Chip 
              style={[
                styles.chip, 
                { backgroundColor: filtri.stato === 'Verde' 
                  ? STATUS_COLORS.SUCCESS 
                  : filtri.stato === 'Arancione' 
                    ? STATUS_COLORS.WARNING 
                    : STATUS_COLORS.ERROR 
                }
              ]}
              textStyle={styles.whiteChipText}
              onClose={() => setFiltri({ ...filtri, stato: undefined })}
            >
              {filtri.stato}
            </Chip>
          )}
          
          {filtri.cerca && (
            <Chip 
              style={styles.chip}
              onClose={() => setFiltri({ ...filtri, cerca: undefined })}
              icon="magnify"
            >
              "{filtri.cerca}"
            </Chip>
          )}
          
          {(filtri.stato || filtri.cerca) && (
            <Button 
              mode="text"
              onPress={resetFiltri}
              style={styles.resetButton}
            >
              Resetta
            </Button>
          )}
        </Card.Content>
      </Card>
      
      {/* Descrizione dei filtri */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {searchQuery ? 
            `Ricerca: "${searchQuery}" - ${filteredLotti.length} risultati` : 
            getFilterDescription()
          }
        </Text>
      </View>
      
      {/* Lista dei lotti */}
      <FlatList
        data={searchQuery ? filteredLotti : lotti}
        renderItem={({ item }) => (
          <LottoCard lotto={item} onPress={() => navigateToLottoDetail(item)} />
        )}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={PRIMARY_COLOR} />
              <Text style={styles.loadingText}>Caricamento lotti in corso...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="package-variant-closed" size={64} color="#888" />
              <Text style={styles.emptyText}>Nessun lotto trovato</Text>
              <Text style={styles.emptySubText}>
                {searchQuery ? 
                  'Nessun risultato trovato per questa ricerca' :
                  filtri.stato || filtri.cerca 
                    ? 'Prova a modificare i filtri di ricerca' 
                    : 'I lotti saranno visualizzati qui quando disponibili'
                }
              </Text>
              {(filtri.stato || filtri.cerca || searchQuery) && (
                <Button 
                  mode="outlined"
                  onPress={resetFiltri}
                  style={styles.emptyResetButton}
                >
                  Resetta filtri
                </Button>
              )}
            </View>
          )
        }
      />
      
      {/* FAB per aggiungere nuovo lotto (solo per operatori/admin) */}
      {canCreateLotto && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={navigateToCreateLotto}
          label="Nuovo lotto"
        />
      )}
      
      {/* Modale per i filtri */}
      <StyledFilterModal
        visible={filtersVisible}
        onDismiss={() => setFiltersVisible(false)}
        onApply={applyFilters}
        onReset={resetFiltri}
        title="Filtra Lotti"
        selectedStato={selectedStato}
        setSelectedStato={setSelectedStato}
      />
    </View>
  );
}

// Funzione per ottenere il colore in base allo stato
const getStateColor = (stato: string) => {
  switch (stato) {
    case 'Verde':
      return STATUS_COLORS.SUCCESS;
    case 'Arancione':
      return STATUS_COLORS.WARNING;
    case 'Rosso':
      return STATUS_COLORS.ERROR;
    default:
      return '#DDDDDD';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  } as any,
  headerCard: {
    margin: 0,
    borderRadius: 0,
    elevation: 4,
  } as any,
  searchContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  } as any,
  searchbar: {
    flex: 1,
    elevation: 0,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  } as any,
  filterButton: {
    marginLeft: 8,
  } as any,
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 8,
    paddingBottom: 8,
  } as any,
  chip: {
    margin: 4,
  } as any,
  whiteChipText: {
    color: '#fff'
  } as any,
  resetButton: {
    alignSelf: 'flex-end',
    marginTop: 4,
  } as any,
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  } as any,
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  } as any,
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  } as any,
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
    color: '#666',
  } as any,
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  } as any,
  emptyResetButton: {
    marginTop: 8,
  } as any,
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  } as any,
  listHeaderText: {
    fontSize: 14,
    color: '#666',
  } as any,
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: PRIMARY_COLOR,
  } as any,
}); 