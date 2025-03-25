import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Platform } from 'react-native';
import { Text, Button, Surface, Searchbar, IconButton, Divider, Badge, Chip, Modal, Portal, TextInput as PaperTextInput } from 'react-native-paper';
import { Link } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useAuth } from '../../src/context/AuthContext';
import { getLotti, Lotto, invalidateCache, LottoFiltri } from '../../src/services/lottiService';
import LottoCard from '../../src/components/LottoCard';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import StyledFilterModal from '../../src/components/StyledFilterModal';
import { RUOLI, PRIMARY_COLOR, STATUS_COLORS } from '../../src/config/constants';
import { router } from 'expo-router';
import { it } from 'date-fns/locale';
import { addDays, format } from 'date-fns';
import { prenotaLotto } from '../../src/services/prenotazioniService';

// Costanti locali per gli stati dei lotti disponibili
const STATI_LOTTI = {
  VERDE: 'Verde',
  ARANCIONE: 'Arancione',
  ROSSO: 'Rosso'
};

export default function LottiScreen() {
  // Stati per gestire i dati e le interazioni dell'utente
  const [lotti, setLotti] = useState<Lotto[]>([]);
  const [lottiNonFiltrati, setLottiNonFiltrati] = useState<Lotto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [selectedStato, setSelectedStato] = useState<string | null>(null);
  const [selectedCategorie, setSelectedCategorie] = useState<string[]>([]);
  
  // Stati per gestire la prenotazione
  const [selectedLotto, setSelectedLotto] = useState<Lotto | null>(null);
  const [showModalPrenotazione, setShowModalPrenotazione] = useState(false);
  const [dataRitiroPrevista, setDataRitiroPrevista] = useState<Date | undefined>(addDays(new Date(), 1));
  const [notePrenotazione, setNotePrenotazione] = useState('');
  const [isPrenotazioneLoading, setIsPrenotazioneLoading] = useState(false);
  const [manualCentroId, setManualCentroId] = useState<string>('');
  const [showCentroIdInput, setShowCentroIdInput] = useState(false);
  
  // Ottieni l'utente autenticato
  const { user } = useAuth();
  
  // Costruisce i filtri da applicare alla richiesta
  const buildFiltri = (): LottoFiltri => {
    const filtri: LottoFiltri = {};
    
    // Aggiungi il filtro per stato se selezionato
    if (selectedStato) {
      filtri.stato = selectedStato;
    }
    
    return filtri;
  };
  
  // Funzione per filtrare localmente i lotti in base al testo di ricerca
  const filtroLocale = (testo: string, lottiDaFiltrare: Lotto[]): Lotto[] => {
    if (!testo.trim()) return lottiDaFiltrare;
    
    const testoNormalizzato = testo.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // rimuove accenti
    
    return lottiDaFiltrare.filter(lotto => {
      const nome = (lotto.nome || "").toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      // Cerca solo nel nome del lotto
      return nome.includes(testoNormalizzato);
    });
  };
  
  // Carica i lotti dal servizio API
  const loadLotti = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Costruisci i filtri (senza includere il testo di ricerca)
      const filtri = buildFiltri();
      
      // Chiamata al servizio
      const response = await getLotti(filtri, forceRefresh);
      
      // Salva tutti i lotti non filtrati
      setLottiNonFiltrati(response.lotti || []);
      
      // Applica il filtro di ricerca locale se necessario
      if (searchText.trim()) {
        const lottiFiltrati = filtroLocale(searchText, response.lotti || []);
        setLotti(lottiFiltrati);
        
        if (lottiFiltrati.length === 0) {
          setError('Nessun lotto corrisponde alla tua ricerca');
        }
      } else {
        setLotti(response.lotti || []);
        
        if ((response.lotti || []).length === 0) {
          if (Object.keys(filtri).length > 0) {
            setError('Nessun lotto trovato con i filtri selezionati');
          } else {
            setError('Nessun lotto disponibile al momento');
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Si è verificato un errore durante il caricamento dei lotti');
      console.error('Errore nel caricamento dei lotti:', err);
      
      // Mostra un messaggio all'utente
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: err.message || 'Impossibile caricare i lotti',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setIsSearching(false);
    }
  };
  
  // Ricarica i dati quando la schermata riceve il focus
  useFocusEffect(
    useCallback(() => {
      // Invalida la cache quando la schermata riceve il focus
      invalidateCache();
      loadLotti(true);
      
      return () => {
        // Cleanup
      };
    }, [])
  );
  
  // Aggiorna i lotti quando i filtri vengono modificati
  useEffect(() => {
    if (!isLoading && !refreshing) {
      loadLotti();
    }
  }, [selectedStato]);
  
  // Gestione della ricerca con debounce
  useEffect(() => {
    const debounceFn = setTimeout(() => {
      if (!isLoading && !refreshing) {
        if (lottiNonFiltrati.length > 0) {
          // Se abbiamo già caricato i lotti, filtriamo localmente
          setIsSearching(true);
          const lottiFiltrati = filtroLocale(searchText, lottiNonFiltrati);
          setLotti(lottiFiltrati);
          
          if (lottiFiltrati.length === 0 && searchText.trim()) {
            setError('Nessun lotto corrisponde alla tua ricerca');
          } else if (lottiFiltrati.length === 0) {
            setError('Nessun lotto disponibile al momento');
          } else {
            setError(null);
          }
          
          setIsSearching(false);
        } else {
          // Altrimenti, carichiamo i dati dal server
          loadLotti();
        }
      }
    }, 300);
    
    return () => clearTimeout(debounceFn);
  }, [searchText]);
  
  // Gestisce l'azione di pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    invalidateCache();
    loadLotti(true);
  };
  
  // Gestione della cancellazione della ricerca
  const handleClearSearch = () => {
    setSearchText('');
    // Ripristina i lotti non filtrati
    setLotti(lottiNonFiltrati);
    if (lottiNonFiltrati.length === 0) {
      setError('Nessun lotto disponibile al momento');
    } else {
      setError(null);
    }
  };
  
  // Resetta tutti i filtri
  const resetFiltri = () => {
    setSelectedStato(null);
    setFiltersApplied(false);
    
    // Ricarica i dati
    loadLotti(true);
  };
  
  // Applica i filtri dalla modal
  const applyFilters = () => {
    // Determina se ci sono filtri applicati
    const hasFilters = selectedStato !== null;
    
    setFiltersApplied(hasFilters);
    setFilterModalVisible(false);
    
    // Ricarica i dati
    loadLotti(true);
  };
  
  // Naviga al dettaglio del lotto
  const navigateToLottoDetail = (lotto: Lotto) => {
    router.push({
      pathname: '/lotti/dettaglio/[id]',
      params: { id: lotto.id.toString() }
    });
  };
  
  // Naviga alla schermata di creazione lotto
  const navigateToCreateLotto = () => {
    router.push('/lotti/nuovo');
  };
  
  // Ottiene la descrizione dei filtri applicati
  const getFilterDescription = () => {
    const filters = [];
    
    if (selectedStato) {
      filters.push(`Stato: ${selectedStato}`);
    }
    
    if (searchText.trim()) {
      filters.push(`Ricerca: "${searchText.trim()}"`);
    }
    
    return filters.join(' • ');
  };
  
  // Gestisce la prenotazione di un lotto
  const handlePrenotazioneLotto = (lotto: Lotto) => {
    // Verifica se l'utente ha i permessi necessari
    if (user?.ruolo !== RUOLI.CENTRO_SOCIALE && user?.ruolo !== RUOLI.CENTRO_RICICLAGGIO) {
      Toast.show({
        type: 'error',
        text1: 'Permessi insufficienti',
        text2: 'Non hai i permessi per prenotare questo lotto',
      });
      return;
    }
    
    setSelectedLotto(lotto);
    setDataRitiroPrevista(addDays(new Date(), 1));
    setNotePrenotazione('');
    setShowCentroIdInput(false); // Resetta lo stato del campo centro_id
    setManualCentroId(''); // Resetta il valore del campo centro_id
    setShowModalPrenotazione(true);
  };
  
  // Conferma la prenotazione del lotto
  const confermaPrenotazione = async () => {
    if (!selectedLotto) {
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
      setIsPrenotazioneLoading(true);
      
      // Prepara la data di ritiro nel formato corretto
      const dataRitiro = dataRitiroPrevista 
        ? format(dataRitiroPrevista, 'yyyy-MM-dd')
        : format(addDays(new Date(), 1), 'yyyy-MM-dd');
      
      // Converte manualCentroId in numero se necessario
      const overrideCentroId = showCentroIdInput && manualCentroId ? 
        parseInt(manualCentroId, 10) : undefined;
      
      // Chiama il servizio di prenotazione
      const result = await prenotaLotto(
        selectedLotto.id,
        dataRitiro,
        notePrenotazione || null,
        overrideCentroId
      );
      
      if (result.success) {
        // Chiudi il modale e mostra conferma
        setShowModalPrenotazione(false);
        Toast.show({
          type: 'success',
          text1: 'Prenotazione completata',
          text2: result.message || 'Lotto prenotato con successo',
          visibilityTime: 4000,
        });
        
        // Aggiorna la lista dei lotti
        invalidateCache();
        loadLotti(true);
        
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
      setIsPrenotazioneLoading(false);
    }
  };
  
  // Gestisce il cambio della data nel datepicker
  const handleDateChange = (date: Date | undefined) => {
    setDataRitiroPrevista(date);
  };
  
  // Funzioni di utilità per il modale
  const getStatusName = (stato: string) => {
    switch (stato) {
      case 'Verde':
        return 'Verde';
      case 'Arancione':
        return 'Arancione';
      case 'Rosso':
        return 'Rosso';
      default:
        return stato;
    }
  };

  const getStatusColor = (stato: string) => {
    return getStateColor(stato);
  };

  const getStatusColorLight = (stato: string) => {
    switch (stato) {
      case STATI_LOTTI.VERDE:
        return 'rgba(76, 175, 80, 0.2)';
      case STATI_LOTTI.ARANCIONE:
        return 'rgba(255, 152, 0, 0.2)';
      case STATI_LOTTI.ROSSO:
        return 'rgba(244, 67, 54, 0.2)';
      default:
        return 'rgba(33, 150, 243, 0.2)';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header con barra di ricerca e filtri */}
      <Surface style={styles.header}>
        <Searchbar
          placeholder="Cerca lotti..."
          onChangeText={setSearchText}
          value={searchText}
          style={styles.searchBar}
          onSubmitEditing={() => loadLotti(true)}
          loading={isSearching}
          onClearIconPress={handleClearSearch}
        />
        <View style={styles.filterContainer}>
          <Button 
            icon="filter-variant" 
            mode={filtersApplied ? "contained" : "outlined"}
            onPress={() => setFilterModalVisible(true)}
            style={[styles.filterButton, filtersApplied && styles.activeFilterButton]}
          >
            Filtri
          </Button>
          {(user?.ruolo === RUOLI.OPERATORE || user?.ruolo === RUOLI.AMMINISTRATORE) && (
            <Button 
              icon="plus" 
              mode="contained" 
              onPress={navigateToCreateLotto}
              style={styles.addButton}
            >
              Nuovo
            </Button>
          )}
        </View>
        
        {(filtersApplied || searchText.trim()) && (
          <View style={styles.appliedFiltersContainer}>
            <Text style={styles.appliedFiltersText} numberOfLines={1}>
              {getFilterDescription()}
            </Text>
            <IconButton
              icon="close-circle"
              size={16}
              onPress={() => {
                resetFiltri();
                handleClearSearch();
              }}
              style={styles.clearFiltersButton}
            />
          </View>
        )}
      </Surface>
      
      {/* Modal per filtrare i lotti */}
      <StyledFilterModal
        visible={filterModalVisible}
        onDismiss={() => setFilterModalVisible(false)}
        onApply={applyFilters}
        onReset={resetFiltri}
        selectedStato={selectedStato}
        setSelectedStato={setSelectedStato}
      >
        <View style={styles.filterModalContent}>
          <Text style={styles.filterSectionTitle}>Filtra per stato</Text>
          <View style={styles.stateFilterContainer}>
            <Chip
              selected={selectedStato === STATI_LOTTI.VERDE}
              onPress={() => setSelectedStato(selectedStato === STATI_LOTTI.VERDE ? null : STATI_LOTTI.VERDE)}
              style={[
                styles.stateChip, 
                { 
                  backgroundColor: selectedStato === STATI_LOTTI.VERDE 
                    ? 'rgba(76, 175, 80, 0.2)' 
                    : 'transparent',
                  borderColor: selectedStato === STATI_LOTTI.VERDE 
                    ? '#4CAF50' 
                    : '#ddd'
                }
              ]}
              textStyle={{ 
                color: getStateColor(STATI_LOTTI.VERDE),
                fontWeight: selectedStato === STATI_LOTTI.VERDE ? 'bold' : 'normal'  
              }}
            >
              Verde
            </Chip>
            
            <Chip
              selected={selectedStato === STATI_LOTTI.ARANCIONE}
              onPress={() => setSelectedStato(selectedStato === STATI_LOTTI.ARANCIONE ? null : STATI_LOTTI.ARANCIONE)}
              style={[
                styles.stateChip, 
                { 
                  backgroundColor: selectedStato === STATI_LOTTI.ARANCIONE 
                    ? 'rgba(255, 152, 0, 0.2)' 
                    : 'transparent',
                  borderColor: selectedStato === STATI_LOTTI.ARANCIONE 
                    ? '#FFA000' 
                    : '#ddd'
                }
              ]}
              textStyle={{ 
                color: getStateColor(STATI_LOTTI.ARANCIONE),
                fontWeight: selectedStato === STATI_LOTTI.ARANCIONE ? 'bold' : 'normal'  
              }}
            >
              Arancione
            </Chip>
            
            <Chip
              selected={selectedStato === STATI_LOTTI.ROSSO}
              onPress={() => setSelectedStato(selectedStato === STATI_LOTTI.ROSSO ? null : STATI_LOTTI.ROSSO)}
              style={[
                styles.stateChip, 
                { 
                  backgroundColor: selectedStato === STATI_LOTTI.ROSSO 
                    ? 'rgba(244, 67, 54, 0.2)' 
                    : 'transparent',
                  borderColor: selectedStato === STATI_LOTTI.ROSSO 
                    ? '#F44336' 
                    : '#ddd'
                }
              ]}
              textStyle={{ 
                color: getStateColor(STATI_LOTTI.ROSSO),
                fontWeight: selectedStato === STATI_LOTTI.ROSSO ? 'bold' : 'normal'  
              }}
            >
              Rosso
            </Chip>
          </View>
        </View>
      </StyledFilterModal>

      {/* Contenuto principale - Lista dei lotti */}
      <FlatList
        data={lotti}
        renderItem={({ item }) => (
          <LottoCard
            lotto={item}
            onPress={navigateToLottoDetail}
            onPrenota={handlePrenotazioneLotto}
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY_COLOR]}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {error || (isLoading ? 'Caricamento...' : 'Nessun lotto disponibile')}
            </Text>
            {!isLoading && (
              <Button mode="outlined" onPress={onRefresh} style={styles.retryButton}>
                Riprova
              </Button>
            )}
          </View>
        )}
      />
      
      {/* Modal per la prenotazione */}
      <Portal>
        <Modal visible={showModalPrenotazione} onDismiss={() => setShowModalPrenotazione(false)} contentContainerStyle={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <IconButton
                    icon="calendar-check"
                    size={24}
                    iconColor="#fff"
                    style={styles.modalIcon}
                  />
                  <Text style={styles.modalTitle}>Prenota Lotto</Text>
                </View>
              </View>
            </View>

            {selectedLotto && (
              <View style={styles.modalBodyContainer}>
                <Text style={styles.sectionTitle}>Informazioni sul lotto</Text>
                <View style={styles.lottoInfoContainer}>
                  <View style={styles.lottoTitleSection}>
                    <Text style={styles.lottoTitle}>
                      {selectedLotto.nome}
                    </Text>
                    <Chip 
                      style={[styles.statusChip, { backgroundColor: getStatusColorLight(selectedLotto.stato) }]} 
                      textStyle={{ color: getStatusColor(selectedLotto.stato) }}
                    >
                      {getStatusName(selectedLotto.stato)}
                    </Chip>
                  </View>

                  <View style={styles.detailsGrid}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Quantità</Text>
                      <Text style={styles.detailValue}>{selectedLotto.quantita} {selectedLotto.unita_misura}</Text>
                    </View>
                    
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Scadenza</Text>
                      <Text style={styles.detailValue}>{new Date(selectedLotto.data_scadenza).toLocaleDateString('it-IT')}</Text>
                    </View>
                    
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Centro di origine</Text>
                      <Text style={styles.detailValue}>{selectedLotto.centro_nome || `Centro #${selectedLotto.centro_id}`}</Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Ritiro entro</Text>
                      <Text style={styles.detailValue}>{selectedLotto.data_scadenza ? new Date(selectedLotto.data_scadenza).toLocaleDateString('it-IT') : 'Non specificato'}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.viewDetailsButtonContainer}>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      setShowModalPrenotazione(false);
                      navigateToLottoDetail(selectedLotto);
                    }}
                    style={styles.viewDetailsButton}
                    labelStyle={styles.viewDetailsButtonLabel}
                    icon="information"
                  >
                    Visualizza scheda completa
                  </Button>
                </View>
                
                <Text style={styles.sectionTitle}>Data di ritiro prevista</Text>
                <View style={styles.datePickerContainer}>
                  {/* DatePickerInput is removed as per the instructions */}
                </View>
                
                <Text style={styles.notesSectionTitle}>Note (opzionale)</Text>
                <PaperTextInput
                  mode="outlined"
                  multiline
                  numberOfLines={Platform.OS === 'ios' || Platform.OS === 'android' ? 2 : 3}
                  value={notePrenotazione}
                  onChangeText={setNotePrenotazione}
                  placeholder="Aggiungi eventuali note per la prenotazione..."
                  style={styles.notesInput}
                  dense={Platform.OS === 'ios' || Platform.OS === 'android'}
                />
                
                {showCentroIdInput && (
                  <View style={styles.centroIdContainer}>
                    <Text style={[styles.sectionTitle, {color: '#F44336'}]}>Centro (richiesto)</Text>
                    <Text style={styles.centroIdHelp}>
                      Il sistema non è riuscito a determinare automaticamente il tuo centro. 
                      Inserisci l'ID del tuo centro per completare la prenotazione.
                      Questo valore verrà salvato per future prenotazioni, così non dovrai reinserirlo.
                    </Text>
                    <PaperTextInput
                      mode="outlined"
                      value={manualCentroId}
                      onChangeText={setManualCentroId}
                      placeholder="ID del centro (numero)"
                      keyboardType="number-pad"
                      style={styles.centroIdInput}
                      right={<PaperTextInput.Icon icon="office-building" />}
                      outlineStyle={{borderColor: '#F44336', borderWidth: 2}}
                      error={manualCentroId !== '' && isNaN(parseInt(manualCentroId, 10))}
                    />
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowModalPrenotazione(false)}
                style={styles.cancelButton}
                labelStyle={styles.cancelButtonLabel}
              >
                Annulla
              </Button>
              <Button
                mode="contained"
                onPress={confermaPrenotazione}
                loading={isPrenotazioneLoading}
                disabled={isPrenotazioneLoading || !dataRitiroPrevista}
                style={styles.confirmButton}
                labelStyle={styles.confirmButtonLabel}
                icon="check-circle"
              >
                Conferma
              </Button>
            </View>

            <View style={styles.modalFooterNote}>
              <Text style={styles.footerText}>
                La prenotazione ti impegna a ritirare il lotto nella data selezionata
              </Text>
            </View>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

// Funzione di utilità per determinare il colore in base allo stato
const getStateColor = (stato: string) => {
  switch (stato) {
    case STATI_LOTTI.VERDE:
      return STATUS_COLORS.SUCCESS;
    case STATI_LOTTI.ARANCIONE:
      return STATUS_COLORS.WARNING;
    case STATI_LOTTI.ROSSO:
      return STATUS_COLORS.ERROR;
    default:
      return STATUS_COLORS.INFO;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    paddingTop: 8,
    elevation: 4,
    backgroundColor: '#fff',
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  filterButton: {
    flex: 1,
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  addButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  appliedFiltersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
  },
  appliedFiltersText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
  },
  clearFiltersButton: {
    margin: 0,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 80,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
  },
  filterModalContent: {
    padding: 24,
  },
  filterSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  stateFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 12,
  },
  stateChip: {
    marginRight: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    height: 42,
    paddingHorizontal: 16,
  },
  modalContainer: {
    padding: Platform.OS === 'web' ? 20 : 10,
    margin: Platform.OS === 'web' ? 20 : 10,
    maxWidth: '100%',
  },
  modalContent: {
    padding: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    maxWidth: 550,
    alignSelf: 'center',
    width: '100%',
    elevation: 4,
    overflow: 'hidden',
  },
  modalHeaderContainer: {
    backgroundColor: PRIMARY_COLOR,
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    elevation: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalIcon: {
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  lottoInfoContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY_COLOR,
  },
  lottoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  lottoTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  lottoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  lottoDetailsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  detailItem: {
    width: '50%',
    marginBottom: 12,
    paddingRight: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  detailsButton: {
    marginRight: 8,
    borderColor: PRIMARY_COLOR,
  },
  detailsButtonLabel: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  modalFormContainer: {
    marginVertical: 12,
    padding: 16,
    backgroundColor: '#fafafa',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 12,
    color: '#333',
  },
  formField: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 12,
    color: '#444',
  },
  notesInput: {
    marginBottom: 16,
    backgroundColor: '#fff',
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 12, 
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 6,
  },
  cancelButtonLabel: {
    color: '#666',
    fontWeight: '600',
    fontSize: 15,
  },
  confirmButton: {
    borderRadius: 8,
    backgroundColor: PRIMARY_COLOR,
    flex: 1,
    paddingVertical: 6,
    elevation: 2,
  },
  confirmButtonLabel: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  modalFooterNote: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  statusChip: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
  },
  statusIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'white',
  },
  modalBodyContainer: {
    padding: Platform.OS === 'web' ? 20 : 16,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 120,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  infoIcon: {
    marginRight: 8, 
    opacity: 0.7,
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  viewDetailsButtonContainer: {
    marginTop: 8,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  viewDetailsButton: {
    borderColor: PRIMARY_COLOR,
    borderRadius: 8,
  },
  viewDetailsButtonLabel: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  notesSectionTitle: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 12,
    marginTop: 12,
    color: '#555',
  },
  centroIdContainer: {
    marginBottom: 16,
    backgroundColor: '#FFF4F2',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  centroIdHelp: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  centroIdInput: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
}); 