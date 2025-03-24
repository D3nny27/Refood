import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, Card, Title, Paragraph, ProgressBar, Badge, Chip, Searchbar, FAB, IconButton, ActivityIndicator, Modal, Portal, Dialog, TextInput } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, isAfter, isBefore, addDays, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { getLottiDisponibili } from '../../src/services/lottiService';
import { Lotto } from '../../src/services/lottiService';
import { prenotaLotto } from '../../src/services/prenotazioniService';
import { PRIMARY_COLOR, RUOLI } from '../../src/config/constants';
import { useAuth } from '../../src/context/AuthContext';
import Toast from 'react-native-toast-message';
import { MapPin, Clock, Calendar, Package, Check, X, AlertCircle, ShoppingCart } from 'react-native-feather';
import axios from 'axios';

interface Filtri {
  centro_id?: number;
  categoria?: string;
  cerca?: string;
  scadenza_min?: string;
  scadenza_max?: string;
}

export default function LottiDisponibiliScreen() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [lotti, setLotti] = useState<Lotto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<Filtri>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filtriVisibili, setFiltriVisibili] = useState(false);
  
  // Stati per la prenotazione
  const [lottoSelezionato, setLottoSelezionato] = useState<Lotto | null>(null);
  const [prenotazioneModalVisible, setPrenotazioneModalVisible] = useState(false);
  const [dataRitiroPrevista, setDataRitiroPrevista] = useState<Date>(addDays(new Date(), 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notePrenotazione, setNotePrenotazione] = useState('');
  const [prenotazioneInCorso, setPrenotazioneInCorso] = useState(false);
  const [showCentroIdInput, setShowCentroIdInput] = useState(false);
  const [manualCentroId, setManualCentroId] = useState('');

  // Funzione per caricare i lotti disponibili
  const loadLottiDisponibili = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Caricamento lotti disponibili con filtri:', filtri);
      
      try {
        const result = await getLottiDisponibili(filtri, forceRefresh);
        
        // Ordina i lotti per data di scadenza (i più vicini alla scadenza prima)
        const lottiOrdinati = result.lotti.sort((a: Lotto, b: Lotto) => {
          return new Date(a.data_scadenza).getTime() - new Date(b.data_scadenza).getTime();
        });
        
        setLotti(lottiOrdinati);
        console.log(`Caricati ${lottiOrdinati.length} lotti disponibili`);
      } catch (err: any) {
        console.error('Errore nel caricamento dei lotti disponibili:', err);
        
        // Gestiamo con grace l'errore 500 per evitare di mandare in crash l'app
        if (axios.isAxiosError(err) && err.response?.status === 500) {
          setError("Il server non risponde correttamente. Verranno mostrati i lotti disponibili in cache se presenti.");
          
          // Attendiamo un breve periodo e riproviamo silenziosamente
          setTimeout(() => {
            // Tentativo silenzioso di recupero
            getLottiDisponibili(filtri, true)
              .then((result) => {
                if (result.lotti.length > 0) {
                  const lottiOrdinati = result.lotti.sort((a, b) => {
                    return new Date(a.data_scadenza).getTime() - new Date(b.data_scadenza).getTime();
                  });
                  setLotti(lottiOrdinati);
                  setError(null);
                }
              })
              .catch(() => {
                // Ignoriamo errori silenziosi
              });
          }, 5000);
        } else {
          // Per altri errori, mostro un messaggio appropriato
          setError(err.message || 'Errore nel caricamento dei lotti disponibili');
          
          Toast.show({
            type: 'error',
            text1: 'Errore',
            text2: err.message || 'Impossibile caricare i lotti disponibili',
          });
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Effetto per caricare i lotti al montaggio del componente
  useEffect(() => {
    loadLottiDisponibili();
  }, []);
  
  // Effetto per ricaricare i lotti quando i filtri cambiano
  useEffect(() => {
    if (Object.keys(filtri).length > 0) {
      loadLottiDisponibili(true);
    }
  }, [filtri]);
  
  // Effetto per ricaricare i lotti quando la schermata ottiene il focus
  useFocusEffect(
    useCallback(() => {
      loadLottiDisponibili();
      return () => {
        // Cleanup
      };
    }, [])
  );
  
  // Funzione per gestire il pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadLottiDisponibili(true);
  };
  
  // Funzione per cercare
  const onSearch = () => {
    setFiltri({ ...filtri, cerca: searchQuery });
  };
  
  // Funzione per resettare i filtri
  const resetFiltri = () => {
    setFiltri({});
    setSearchQuery('');
    loadLottiDisponibili(true);
  };
  
  // Funzione per applicare i filtri
  const applyFilters = () => {
    setFiltriVisibili(false);
    // Qui implementare l'applicazione dei filtri avanzati
  };
  
  // Funzione per navigare ai dettagli del lotto
  const navigateToLottoDetail = (lotto: Lotto) => {
    router.push(`/lotti/dettaglio/${lotto.id}`);
  };
  
  // Funzione per ottenere il colore dello stato
  const getStateColor = (stato: string) => {
    switch (stato.toLowerCase()) {
      case 'verde':
        return '#4CAF50';
      case 'giallo':
      case 'arancione':
        return '#FFA000';
      case 'rosso':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };
  
  // Funzione per formattare la data
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd/MM/yyyy', { locale: it });
    } catch (err) {
      console.error('Errore nella formattazione della data:', err);
      return dateString;
    }
  };
  
  // Funzione per mostrare il modale di prenotazione
  const handlePrenotazione = (lotto: Lotto) => {
    setLottoSelezionato(lotto);
    setDataRitiroPrevista(addDays(new Date(), 1)); // Imposta la data di ritiro prevista a domani
    setNotePrenotazione('');
    setPrenotazioneModalVisible(true);
  };
  
  // Funzione per confermare la prenotazione
  const confermaPrenotazione = async () => {
    if (!lottoSelezionato) {
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Nessun lotto selezionato per la prenotazione',
      });
      return;
    }
    
    // Verifica se è necessario il centro_id e non è stato inserito
    if (showCentroIdInput && (!manualCentroId || isNaN(parseInt(manualCentroId, 10)))) {
      Toast.show({
        type: 'info',
        text1: 'Centro richiesto',
        text2: 'Inserisci un ID centro valido per completare la prenotazione',
        visibilityTime: 3000,
      });
      return;
    }
    
    try {
      setPrenotazioneInCorso(true);
      
      // Prepara la data di ritiro nel formato corretto
      const dataRitiro = dataRitiroPrevista 
        ? format(dataRitiroPrevista, 'yyyy-MM-dd')
        : format(addDays(new Date(), 1), 'yyyy-MM-dd');
      
      // Converte manualCentroId in numero se necessario
      const overrideCentroId = showCentroIdInput && manualCentroId ? 
        parseInt(manualCentroId, 10) : undefined;
      
      // Chiama il servizio di prenotazione
      const result = await prenotaLotto(
        lottoSelezionato.id,
        dataRitiro,
        notePrenotazione || null,
        overrideCentroId
      );
      
      if (result.success) {
        // Chiudi il modale e mostra conferma
        setPrenotazioneModalVisible(false);
        Toast.show({
          type: 'success',
          text1: 'Prenotazione completata',
          text2: result.message || 'Lotto prenotato con successo',
          visibilityTime: 4000,
        });
        
        // Aggiorna la lista dei lotti
        loadLottiDisponibili(true);
        
        // Reindirizza l'utente alla pagina delle prenotazioni dopo un breve delay
        setTimeout(() => {
          router.push('/prenotazioni');
        }, 1000);
      } else {
        // Controlla se il problema è la mancanza del centro_id
        if (result.missingCentroId) {
          setShowCentroIdInput(true);
          Toast.show({
            type: 'info',
            text1: 'Centro non trovato',
            text2: 'Inserisci manualmente l\'ID del tuo centro per completare la prenotazione',
            visibilityTime: 5000,
          });
        } else {
          // Mostra errore
          Toast.show({
            type: 'error',
            text1: 'Errore',
            text2: result.message || 'Impossibile completare la prenotazione',
            visibilityTime: 4000,
          });
        }
      }
    } catch (error: any) {
      console.error('Errore durante la prenotazione:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: error.message || 'Si è verificato un errore durante la prenotazione',
        visibilityTime: 3000,
      });
    } finally {
      setPrenotazioneInCorso(false);
    }
  };
  
  // Funzione per calcolare i giorni rimanenti alla scadenza
  const getGiorniRimanenti = (dataScadenza: string) => {
    try {
      const oggi = new Date();
      const scadenza = new Date(dataScadenza);
      const diffTime = scadenza.getTime() - oggi.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (err) {
      return 0;
    }
  };
  
  // Funzione per renderizzare un item della lista
  const renderLottoItem = ({ item }: { item: Lotto }) => {
    const giorniRimanenti = getGiorniRimanenti(item.data_scadenza);
    const statoColor = getStateColor(item.stato);
    
    return (
      <Card 
        style={styles.lottoCard} 
        onPress={() => navigateToLottoDetail(item)}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Title>{item.nome}</Title>
              <Badge 
                style={[styles.statoBadge, { backgroundColor: statoColor }]}
              >
                {giorniRimanenti > 0 ? `${giorniRimanenti} giorni` : 'Scade oggi'}
              </Badge>
            </View>
          </View>
          
          <Paragraph style={styles.descrizione}>
            {item.descrizione && item.descrizione.length > 100 
              ? `${item.descrizione.substring(0, 100)}...` 
              : item.descrizione || 'Nessuna descrizione'}
          </Paragraph>
          
          <View style={styles.dettagliContainer}>
            <View style={styles.dettaglioItem}>
              <Package width={16} height={16} color="#555" />
              <Text style={styles.dettaglioText}>
                {item.quantita} {item.unita_misura}
              </Text>
            </View>
            
            <View style={styles.dettaglioItem}>
              <MapPin width={16} height={16} color="#555" />
              <Text style={styles.dettaglioText}>{item.centro_nome}</Text>
            </View>
            
            <View style={styles.dettaglioItem}>
              <Calendar width={16} height={16} color="#555" />
              <Text style={styles.dettaglioText}>
                Scadenza: {formatDate(item.data_scadenza)}
              </Text>
            </View>
          </View>
          
          <ProgressBar 
            progress={1 - (giorniRimanenti / 7)} 
            color={statoColor} 
            style={styles.progressBar} 
          />
        </Card.Content>
        
        <Card.Actions style={styles.cardActions}>
          <Button 
            mode="outlined" 
            onPress={() => navigateToLottoDetail(item)}
            style={styles.actionButton}
            icon="information-outline"
          >
            Dettagli
          </Button>
          
          <Button 
            mode="contained" 
            onPress={() => handlePrenotazione(item)}
            style={styles.prenotaButton}
            icon="shopping"
            disabled={!user || ![RUOLI.CENTRO_SOCIALE, RUOLI.CENTRO_RICICLAGGIO].includes(user.ruolo)}
          >
            Prenota
          </Button>
        </Card.Actions>
      </Card>
    );
  };
  
  const renderDialog = () => (
    <Portal>
      <Dialog
        visible={prenotazioneModalVisible}
        onDismiss={() => setPrenotazioneModalVisible(false)}
        style={styles.prenotazioneDialog}
      >
        <Dialog.Title>Prenota Lotto</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.dialogText}>
            Stai prenotando il lotto:
          </Text>
          <Text style={styles.dialogProdotto}>
            {lottoSelezionato?.nome}
          </Text>
          <Text style={styles.dialogText}>
            Quando prevedi di ritirare questo lotto?
          </Text>
          
          <View style={styles.dateButtonsContainer}>
            <Button 
              mode="outlined"
              onPress={() => setDataRitiroPrevista(addDays(new Date(), 1))}
              style={[
                styles.dateButton,
                format(dataRitiroPrevista, 'yyyy-MM-dd') === format(addDays(new Date(), 1), 'yyyy-MM-dd') ? styles.dateButtonSelected : null
              ]}
            >
              Domani
            </Button>
            <Button 
              mode="outlined"
              onPress={() => setDataRitiroPrevista(addDays(new Date(), 2))}
              style={[
                styles.dateButton,
                format(dataRitiroPrevista, 'yyyy-MM-dd') === format(addDays(new Date(), 2), 'yyyy-MM-dd') ? styles.dateButtonSelected : null
              ]}
            >
              Dopodomani
            </Button>
            <Button 
              mode="outlined"
              onPress={() => setDataRitiroPrevista(addDays(new Date(), 3))}
              style={[
                styles.dateButton,
                format(dataRitiroPrevista, 'yyyy-MM-dd') === format(addDays(new Date(), 3), 'yyyy-MM-dd') ? styles.dateButtonSelected : null
              ]}
            >
              Tra 3 giorni
            </Button>
          </View>
          
          <Text style={styles.selectedDateText}>
            Data selezionata: {format(dataRitiroPrevista, 'dd/MM/yyyy', { locale: it })}
          </Text>
          
          <TextInput
            label="Note (opzionale)"
            value={notePrenotazione}
            onChangeText={setNotePrenotazione}
            multiline
            style={styles.noteInput}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setPrenotazioneModalVisible(false)}>Annulla</Button>
          <Button 
            mode="contained" 
            onPress={confermaPrenotazione}
            loading={prenotazioneInCorso}
            disabled={prenotazioneInCorso}
          >
            Conferma
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  return (
    <View style={styles.container}>
      {/* Header di ricerca */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Cerca lotti disponibili"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          onSubmitEditing={onSearch}
          icon="magnify"
        />
        <IconButton
          icon="filter"
          size={24}
          onPress={() => setFiltriVisibili(true)}
          style={styles.filterButton}
        />
      </View>

      {/* Mostra se ci sono filtri attivi */}
      {Object.keys(filtri).length > 0 && (
        <View style={styles.activeFiltersContainer}>
          <Text style={styles.activeFiltersText}>Filtri attivi:</Text>
          {filtri.cerca && (
            <Chip 
              style={styles.filterChip} 
              onClose={() => setFiltri({...filtri, cerca: undefined})}
            >
              Ricerca: {filtri.cerca}
            </Chip>
          )}
          <Button 
            mode="text" 
            onPress={resetFiltri}
            style={styles.resetButton}
          >
            Resetta filtri
          </Button>
        </View>
      )}

      {/* Lista dei lotti */}
      {loading && lotti.length === 0 ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento lotti disponibili...</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <Button 
            mode="contained" 
            onPress={() => loadLottiDisponibili(true)}
            style={styles.retryButton}
          >
            Riprova
          </Button>
        </View>
      ) : lotti.length === 0 ? (
        <View style={styles.centeredContainer}>
          <Ionicons name="basket-outline" size={48} color="#9E9E9E" />
          <Text style={styles.emptyText}>Nessun lotto disponibile</Text>
          <Text style={styles.emptySubtext}>
            Non ci sono lotti disponibili per la prenotazione al momento.
          </Text>
          <Button 
            mode="contained" 
            onPress={() => loadLottiDisponibili(true)}
            style={styles.retryButton}
          >
            Aggiorna
          </Button>
        </View>
      ) : (
        <FlatList
          data={lotti}
          renderItem={renderLottoItem}
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
      
      {/* Modale di prenotazione - Corretto il problema con renderDialog */}
      {renderDialog()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    elevation: 2,
  },
  searchbar: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
  },
  filterButton: {
    margin: 0,
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  activeFiltersText: {
    marginRight: 8,
    fontSize: 12,
  },
  filterChip: {
    margin: 4,
  },
  resetButton: {
    marginLeft: 'auto',
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
  listContent: {
    padding: 8,
  },
  lottoCard: {
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
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
  descrizione: {
    marginBottom: 8,
    color: '#555',
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
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  cardActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  actionButton: {
    flex: 1,
    marginRight: 8,
  },
  prenotaButton: {
    flex: 1,
    backgroundColor: PRIMARY_COLOR,
  },
  prenotazioneModal: {
    backgroundColor: 'white',
    borderRadius: 8,
  },
  lottoInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  lottoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  noteInput: {
    backgroundColor: 'transparent',
  },
  prenotazioneDialog: {
    backgroundColor: 'white',
    borderRadius: 8,
  },
  dialogText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
  },
  dialogProdotto: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
  },
  dateButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  dateButtonSelected: {
    borderColor: PRIMARY_COLOR,
    borderWidth: 2,
  },
  selectedDateText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
  },
}); 