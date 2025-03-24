import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Button, Card, Title, Paragraph, Badge, Chip, Searchbar, IconButton, ActivityIndicator, Portal, Dialog, TextInput, Divider } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { getPrenotazioni, annullaPrenotazione, Prenotazione } from '../../src/services/prenotazioniService';
import { PRIMARY_COLOR, RUOLI } from '../../src/config/constants';
import { useAuth } from '../../src/context/AuthContext';
import Toast from 'react-native-toast-message';

interface Filtri {
  stato?: string;
  data_inizio?: string;
  data_fine?: string;
}

export default function PrenotazioniScreen() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<Filtri>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filtriVisibili, setFiltriVisibili] = useState(false);
  
  // Stati per l'annullamento
  const [prenotazioneSelezionata, setPrenotazioneSelezionata] = useState<Prenotazione | null>(null);
  const [annullamentoModalVisible, setAnnullamentoModalVisible] = useState(false);
  const [motivoAnnullamento, setMotivoAnnullamento] = useState('');
  const [annullamentoInCorso, setAnnullamentoInCorso] = useState(false);

  // Funzione per caricare le prenotazioni
  const loadPrenotazioni = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Caricamento prenotazioni con filtri:', filtri);
      const result = await getPrenotazioni(filtri, forceRefresh);
      
      // Ordina le prenotazioni (le più recenti prima)
      const prenotazioniOrdinate = result.prenotazioni.sort((a, b) => {
        return new Date(b.data_prenotazione).getTime() - new Date(a.data_prenotazione).getTime();
      });
      
      setPrenotazioni(prenotazioniOrdinate);
      console.log(`Caricate ${prenotazioniOrdinate.length} prenotazioni`);
    } catch (err: any) {
      console.error('Errore nel caricamento delle prenotazioni:', err);
      setError(err.message || 'Errore nel caricamento delle prenotazioni');
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: err.message || 'Impossibile caricare le prenotazioni',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Effetto per caricare le prenotazioni al montaggio del componente
  useEffect(() => {
    loadPrenotazioni();
  }, []);
  
  // Effetto per ricaricare le prenotazioni quando i filtri cambiano
  useEffect(() => {
    if (Object.keys(filtri).length > 0) {
      loadPrenotazioni(true);
    }
  }, [filtri]);
  
  // Effetto per ricaricare le prenotazioni quando la schermata ottiene il focus
  useFocusEffect(
    useCallback(() => {
      loadPrenotazioni();
      return () => {
        // Cleanup
      };
    }, [])
  );
  
  // Funzione per gestire il pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadPrenotazioni(true);
  };
  
  // Funzione per cercare
  const onSearch = () => {
    // Implementare la ricerca
    Toast.show({
      type: 'info',
      text1: 'Ricerca non implementata',
      text2: 'La funzionalità di ricerca sarà disponibile a breve',
    });
  };
  
  // Funzione per resettare i filtri
  const resetFiltri = () => {
    setFiltri({});
    setSearchQuery('');
    loadPrenotazioni(true);
  };
  
  // Funzione per applicare i filtri per stato
  const applyStatusFilter = (stato: string) => {
    setFiltri({ ...filtri, stato });
    loadPrenotazioni(true);
  };
  
  // Funzione per navigare ai dettagli della prenotazione
  const navigateToPrenotazioneDetail = (prenotazione: Prenotazione) => {
    router.push(`/prenotazioni/dettaglio/${prenotazione.id}`);
  };
  
  // Funzione per navigare alla schermata dei lotti disponibili
  const navigateToLottiDisponibili = () => {
    router.push('/lotti/disponibili');
  };
  
  // Funzione per formattare la data
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Data non disponibile';
    try {
      const date = new Date(dateString);
      return format(date, 'dd/MM/yyyy', { locale: it });
    } catch (err) {
      console.error('Errore nella formattazione della data:', err);
      return dateString;
    }
  };
  
  // Funzione per ottenere il colore dello stato
  const getStatoColor = (stato: string) => {
    switch (stato.toLowerCase()) {
      case 'richiesta':
        return '#FFA000'; // arancione
      case 'confermata':
        return '#2196F3'; // blu
      case 'completata':
        return '#4CAF50'; // verde
      case 'annullata':
        return '#F44336'; // rosso
      default:
        return '#9E9E9E'; // grigio
    }
  };
  
  // Funzione per mostrare il modale di annullamento
  const handleAnnullamento = (prenotazione: Prenotazione) => {
    setPrenotazioneSelezionata(prenotazione);
    setMotivoAnnullamento('');
    setAnnullamentoModalVisible(true);
  };
  
  // Funzione per confermare l'annullamento
  const confermaAnnullamento = async () => {
    if (!prenotazioneSelezionata) return;
    
    try {
      setAnnullamentoInCorso(true);
      
      const result = await annullaPrenotazione(
        prenotazioneSelezionata.id,
        motivoAnnullamento
      );
      
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Prenotazione annullata',
          text2: result.message,
          visibilityTime: 4000,
        });
        
        // Chiudi il modale e ricarica le prenotazioni
        setAnnullamentoModalVisible(false);
        loadPrenotazioni(true);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: result.message,
          visibilityTime: 4000,
        });
      }
    } catch (err: any) {
      console.error('Errore nell\'annullamento della prenotazione:', err);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: err.message || 'Impossibile annullare la prenotazione',
        visibilityTime: 4000,
      });
    } finally {
      setAnnullamentoInCorso(false);
    }
  };
  
  // Funzione per ottenere il messaggio relativo allo stato
  const getStatoLabel = (stato: string) => {
    switch (stato.toLowerCase()) {
      case 'richiesta':
        return 'In attesa di conferma';
      case 'confermata':
        return 'Conferma di ritiro ricevuta';
      case 'completata':
        return 'Ritiro completato';
      case 'annullata':
        return 'Prenotazione annullata';
      default:
        return stato;
    }
  };
  
  // Funzione per renderizzare un item della lista
  const renderPrenotazioneItem = ({ item }: { item: Prenotazione }) => {
    const statoColor = getStatoColor(item.stato);
    const lotto = item.lotto;
    
    return (
      <Card 
        style={styles.prenotazioneCard} 
        onPress={() => navigateToPrenotazioneDetail(item)}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Title>{lotto?.nome || 'Lotto non disponibile'}</Title>
              <Badge 
                style={[styles.statoBadge, { backgroundColor: statoColor }]}
              >
                {item.stato}
              </Badge>
            </View>
          </View>
          
          <Paragraph style={styles.statoLabel}>
            {getStatoLabel(item.stato)}
          </Paragraph>
          
          <Divider style={styles.divider} />
          
          <View style={styles.dettagliContainer}>
            <View style={styles.dettaglioItem}>
              <Ionicons name="cube-outline" size={16} color="#555" />
              <Text style={styles.dettaglioText}>
                {lotto?.quantita || '?'} {lotto?.unita_misura || 'pz'}
              </Text>
            </View>
            
            <View style={styles.dettaglioItem}>
              <Ionicons name="location-outline" size={16} color="#555" />
              <Text style={styles.dettaglioText}>
                {item.centro_nome || lotto?.centro_nome || 'Centro non specificato'}
              </Text>
            </View>
            
            <View style={styles.dettaglioItem}>
              <Ionicons name="calendar-outline" size={16} color="#555" />
              <Text style={styles.dettaglioText}>
                Prenotato il: {formatDate(item.data_prenotazione)}
              </Text>
            </View>
            
            {item.data_ritiro_prevista && (
              <View style={styles.dettaglioItem}>
                <Ionicons name="time-outline" size={16} color="#555" />
                <Text style={styles.dettaglioText}>
                  Ritiro previsto: {formatDate(item.data_ritiro_prevista)}
                </Text>
              </View>
            )}
          </View>
        </Card.Content>
        
        <Card.Actions style={styles.cardActions}>
          <Button 
            mode="outlined" 
            onPress={() => navigateToPrenotazioneDetail(item)}
            style={styles.actionButton}
            icon="information-outline"
          >
            Dettagli
          </Button>
          
          {item.stato === 'Richiesta' && (
            <Button 
              mode="contained" 
              onPress={() => handleAnnullamento(item)}
              style={styles.annullaButton}
              icon="close-circle-outline"
            >
              Annulla
            </Button>
          )}
        </Card.Actions>
      </Card>
    );
  };

  // Controllo se l'utente può effettuare prenotazioni
  const canBook = user && [RUOLI.CENTRO_SOCIALE, RUOLI.CENTRO_RICICLAGGIO].includes(user.ruolo);

  return (
    <View style={styles.container}>
      {/* Header con filtri rapidi */}
      <View style={styles.filterTabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
          <TouchableOpacity 
            style={[styles.filterTab, !filtri.stato && styles.activeFilterTab]} 
            onPress={() => resetFiltri()}
          >
            <Text style={[styles.filterTabText, !filtri.stato && styles.activeFilterTabText]}>
              Tutte
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterTab, filtri.stato === 'Richiesta' && styles.activeFilterTab]} 
            onPress={() => applyStatusFilter('Richiesta')}
          >
            <Text style={[styles.filterTabText, filtri.stato === 'Richiesta' && styles.activeFilterTabText]}>
              In Attesa
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterTab, filtri.stato === 'Confermata' && styles.activeFilterTab]} 
            onPress={() => applyStatusFilter('Confermata')}
          >
            <Text style={[styles.filterTabText, filtri.stato === 'Confermata' && styles.activeFilterTabText]}>
              Confermate
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterTab, filtri.stato === 'Completata' && styles.activeFilterTab]} 
            onPress={() => applyStatusFilter('Completata')}
          >
            <Text style={[styles.filterTabText, filtri.stato === 'Completata' && styles.activeFilterTabText]}>
              Completate
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterTab, filtri.stato === 'Annullata' && styles.activeFilterTab]} 
            onPress={() => applyStatusFilter('Annullata')}
          >
            <Text style={[styles.filterTabText, filtri.stato === 'Annullata' && styles.activeFilterTabText]}>
              Annullate
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Lista delle prenotazioni */}
      {loading && prenotazioni.length === 0 ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento prenotazioni...</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <Button 
            mode="contained" 
            onPress={() => loadPrenotazioni(true)}
            style={styles.retryButton}
          >
            Riprova
          </Button>
        </View>
      ) : prenotazioni.length === 0 ? (
        <View style={styles.centeredContainer}>
          <Ionicons name="cart-outline" size={48} color="#9E9E9E" />
          <Text style={styles.emptyText}>Nessuna prenotazione trovata</Text>
          {canBook ? (
            <>
              <Text style={styles.emptySubtext}>
                Non hai ancora effettuato nessuna prenotazione. Esplora i lotti disponibili per prenotarne uno.
              </Text>
              <Button 
                mode="contained" 
                onPress={navigateToLottiDisponibili}
                style={styles.exploreButton}
              >
                Esplora lotti disponibili
              </Button>
            </>
          ) : (
            <Text style={styles.emptySubtext}>
              Non ci sono prenotazioni da visualizzare in base ai filtri selezionati.
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={prenotazioni}
          renderItem={renderPrenotazioneItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[PRIMARY_COLOR]}
            />
          }
        />
      )}
      
      {/* Pulsante per esplorare lotti disponibili (solo per centri) */}
      {canBook && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={navigateToLottiDisponibili}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}
      
      {/* Modale di annullamento */}
      <Portal>
        <Dialog
          visible={annullamentoModalVisible}
          onDismiss={() => setAnnullamentoModalVisible(false)}
          style={styles.annullamentoModal}
        >
          <Dialog.Title>Annulla prenotazione</Dialog.Title>
          
          <Dialog.Content>
            {prenotazioneSelezionata && (
              <>
                <Paragraph>
                  Sei sicuro di voler annullare la prenotazione per il lotto "{prenotazioneSelezionata.lotto?.nome || 'sconosciuto'}"?
                </Paragraph>
                
                <TextInput
                  label="Motivo dell'annullamento (opzionale)"
                  value={motivoAnnullamento}
                  onChangeText={setMotivoAnnullamento}
                  multiline
                  numberOfLines={3}
                  style={styles.motivoInput}
                />
              </>
            )}
          </Dialog.Content>
          
          <Dialog.Actions>
            <Button 
              onPress={() => setAnnullamentoModalVisible(false)}
              disabled={annullamentoInCorso}
            >
              Annulla
            </Button>
            <Button 
              mode="contained"
              onPress={confermaAnnullamento}
              loading={annullamentoInCorso}
              disabled={annullamentoInCorso}
              color="#F44336"
            >
              Conferma annullamento
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterTabsContainer: {
    backgroundColor: '#fff',
    elevation: 2,
  },
  filterTabs: {
    paddingHorizontal: 8,
  },
  filterTab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeFilterTab: {
    borderBottomColor: PRIMARY_COLOR,
  },
  filterTabText: {
    fontSize: 14,
    color: '#757575',
  },
  activeFilterTabText: {
    color: PRIMARY_COLOR,
    fontWeight: 'bold',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
  },
  exploreButton: {
    marginTop: 24,
  },
  listContent: {
    padding: 8,
  },
  prenotazioneCard: {
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statoBadge: {
    alignSelf: 'flex-start',
  },
  statoLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 8,
  },
  dettagliContainer: {
    marginVertical: 8,
  },
  dettaglioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dettaglioText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#555',
  },
  cardActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  actionButton: {
    flex: 1,
    marginRight: 8,
  },
  annullaButton: {
    flex: 1,
    backgroundColor: '#F44336',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  annullamentoModal: {
    backgroundColor: 'white',
    borderRadius: 8,
  },
  motivoInput: {
    backgroundColor: 'transparent',
    marginTop: 16,
  },
}); 