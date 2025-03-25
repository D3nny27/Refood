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
  stato?: string;
}

export default function LottiDisponibiliScreen() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [lotti, setLotti] = useState<Lotto[]>([]);
  const [lottiNonFiltrati, setLottiNonFiltrati] = useState<Lotto[]>([]);
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

  // IMPLEMENTAZIONE FILTRO LOCALE PER LA RICERCA CON DEBOUNCE
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  // Funzione sicura per convertire stringhe di date in oggetti Date
  const safeParseDate = (dateString: string | undefined | null): Date | null => {
    if (!dateString) return null;
    
    try {
      // Verifica se la data è in formato ISO (contiene T) o solo data (YYYY-MM-DD)
      const dateParts = dateString.split('T')[0].split('-');
      if (dateParts.length === 3) {
        // Crea la data usando anno-mese-giorno (con mese indicizzato da 0)
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // Mese è 0-based in JavaScript
        const day = parseInt(dateParts[2], 10);
        
        // Verifica validità dei componenti
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const date = new Date(year, month, day);
          
          // Verifica ulteriormente che la data sia valida
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      console.warn('Impossibile parsare la data in modo sicuro:', dateString);
      return null;
    } catch (error) {
      console.error('Errore nel parsing della data:', error, dateString);
      return null;
    }
  };

  // Modifichiamo la funzione per caricare i lotti disponibili
  const loadLottiDisponibili = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Caricamento lotti disponibili con filtri:', JSON.stringify(filtri));
      
      // Crea una copia dei filtri senza la ricerca per l'API
      const apiFiltri = { ...filtri };
      delete apiFiltri.cerca; // Rimuovi il filtro 'cerca' perché lo applicheremo localmente
      
      try {
        const result = await getLottiDisponibili(apiFiltri, forceRefresh);
        
        // Ordina i lotti per data di scadenza (i più vicini alla scadenza prima)
        const lottiOrdinati = result.lotti.sort((a: Lotto, b: Lotto) => {
          return new Date(a.data_scadenza).getTime() - new Date(b.data_scadenza).getTime();
        });
        
        // Salva tutti i lotti non filtrati
        setLottiNonFiltrati(lottiOrdinati);
        
        // Applica il filtro di ricerca locale se necessario
        if (searchQuery.trim()) {
          console.log('Applicazione filtro locale per:', searchQuery.trim());
          
          // Normalizza il testo di ricerca (rimuovi caratteri speciali)
          const testoDaCercare = searchQuery.trim().toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // rimuove accenti
          
          // Filtra i lotti localmente con la stessa logica di handleSearchChange
          const lottiFiltrati = lottiOrdinati.filter(lotto => {
            // Normalizza i testi per la ricerca
            const nome = (lotto.nome || "").toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const descrizione = (lotto.descrizione || "").toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const centroNome = (lotto.centro_nome || "").toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            // Verifica se il testo di ricerca è contenuto in uno dei campi
            return nome.includes(testoDaCercare) || 
                   descrizione.includes(testoDaCercare) || 
                   centroNome.includes(testoDaCercare);
          });
          
          console.log(`Filtrati ${lottiFiltrati.length} lotti su ${lottiOrdinati.length}`);
          setLotti(lottiFiltrati);
        } else {
          // Se non c'è testo di ricerca, mostra tutti i lotti
          setLotti(lottiOrdinati);
        }
        
        console.log(`Caricati ${lottiOrdinati.length} lotti disponibili`);
      } catch (err: any) {
        console.error('Errore nel caricamento dei lotti disponibili:', err);
        
        // Gestiamo con grace l'errore 500 per evitare di mandare in crash l'app
        if (axios.isAxiosError(err) && err.response?.status === 500) {
          setError("Il server non risponde correttamente. Verranno mostrati i lotti disponibili in cache se presenti.");
          
          // Attendiamo un breve periodo e riproviamo silenziosamente
          setTimeout(() => {
            // Tentativo silenzioso di recupero
            getLottiDisponibili(apiFiltri, true)
              .then((result) => {
                if (result.lotti.length > 0) {
                  const lottiOrdinati = result.lotti.sort((a, b) => {
                    return new Date(a.data_scadenza).getTime() - new Date(b.data_scadenza).getTime();
                  });
                  setLottiNonFiltrati(lottiOrdinati);
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
  
  // Effetto per ricaricare i lotti quando i filtri cambiano (escluso il filtro cerca)
  useEffect(() => {
    // Estrai i filtri senza il filtro 'cerca'
    const { cerca, ...altriFiltri } = filtri;
    
    // Se ci sono filtri diversi da 'cerca', ricarica i lotti
    if (Object.keys(altriFiltri).length > 0) {
      loadLottiDisponibili(true);
    }
  }, [filtri.stato, filtri.categoria, filtri.centro_id, filtri.scadenza_min, filtri.scadenza_max]);
  
  // Modifico useFocusEffect per considerare anche i filtri
  useFocusEffect(
    useCallback(() => {
      console.log("useFocusEffect attivato con filtri:", JSON.stringify(filtri));
      
      // Carica i dati con force refresh
      loadLottiDisponibili(true);
      
      return () => {
        // Cleanup
      };
    }, [filtri.stato, filtri.categoria, filtri.centro_id, filtri.scadenza_min, filtri.scadenza_max])  // Aggiungo filtri pertinenti come dipendenze, escludo cerca
  );
  
  // Funzione per gestire il pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadLottiDisponibili(true);
  };
  
  // IMPLEMENTAZIONE FILTRO LOCALE PER LA RICERCA CON DEBOUNCE
  const handleSearchChange = (text: string) => {
    // Aggiorna subito il testo visualizzato
    setSearchQuery(text);
    
    // Cancella eventuali timer precedenti
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    
    // Esegui la ricerca dopo un breve ritardo (200ms)
    const timeoutId = setTimeout(() => {
      console.log('Ricerca locale per:', text);
      
      if (text.trim()) {
        // Normalizza il testo di ricerca (rimuovi caratteri speciali)
        const testoDaCercare = text.trim().toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // rimuove accenti
        
        // Filtra i lotti localmente
        const lottiFiltrati = lottiNonFiltrati.filter(lotto => {
          // Normalizza i testi per la ricerca
          const nome = (lotto.nome || "").toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const descrizione = (lotto.descrizione || "").toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const centroNome = (lotto.centro_nome || "").toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          
          // Verifica se il testo di ricerca è contenuto in uno dei campi
          return nome.includes(testoDaCercare) || 
                 descrizione.includes(testoDaCercare) || 
                 centroNome.includes(testoDaCercare);
        });
        
        console.log(`Filtrati ${lottiFiltrati.length} lotti su ${lottiNonFiltrati.length}`);
        setLotti(lottiFiltrati);
      } else {
        // Se non c'è testo di ricerca, mostra tutti i lotti
        setLotti(lottiNonFiltrati);
        console.log('Rimosso filtro di ricerca locale');
      }
    }, 200); // 200ms di debounce
    
    // Salva il riferimento al timeout
    setDebounceTimeout(timeoutId);
  };
  
  // Funzione per cercare
  const onSearch = () => {
    handleSearchChange(searchQuery);
    
    if (searchQuery.trim()) {
      // Mostra un toast per confermare la ricerca
      Toast.show({
        type: 'info',
        text1: 'Ricerca attiva',
        text2: `Ricerca locale per: "${searchQuery.trim()}"`,
        visibilityTime: 2000,
      });
    }
  };

  // Funzione per applicare il filtro di stato (colore)
  const applyStatoFilter = (stato: string | null) => {
    const nuoviFiltri = { ...filtri };
    
    // Se è lo stesso stato, lo togliamo (toggle)
    if (stato && filtri.stato === stato) {
      delete nuoviFiltri.stato;
      Toast.show({
        type: 'info',
        text1: 'Filtro rimosso',
        text2: `Il filtro per stato "${stato}" è stato rimosso`
      });
    } else if (stato) {
      // Altrimenti impostiamo il nuovo stato
      nuoviFiltri.stato = stato;
      Toast.show({
        type: 'success',
        text1: 'Filtro applicato',
        text2: `Verranno mostrati solo i lotti in stato "${stato}"`
      });
    } else {
      // Se è null, rimuoviamo il filtro di stato
      delete nuoviFiltri.stato;
      Toast.show({
        type: 'info',
        text1: 'Filtro rimosso',
        text2: 'Il filtro per stato è stato rimosso'
      });
    }
    
    // Aggiorna i filtri
    setFiltri(nuoviFiltri);
  };

  // Funzione per resettare i filtri
  const resetFiltri = () => {
    console.log("Resetting all filters");
    
    // Resetta tutti i filtri API
    setFiltri({});
    
    // Resetta la ricerca locale
    setSearchQuery('');
    
    // Se abbiamo già i lotti non filtrati, li usiamo
    if (lottiNonFiltrati.length > 0) {
      // Resetta la lista dei lotti al valore originale non filtrato
      setLotti(lottiNonFiltrati);
      
      Toast.show({
        type: 'success',
        text1: 'Filtri reimpostati',
        text2: 'Tutti i filtri sono stati rimossi'
      });
    } else {
      // Se non abbiamo lotti in cache, ricarica i dati dal server
      loadLottiDisponibili(true);
      
      Toast.show({
        type: 'success',
        text1: 'Filtri reimpostati',
        text2: 'Ricaricamento dati in corso...'
      });
    }
  };
  
  // Funzione per applicare i filtri
  const applyFilters = () => {
    setFiltriVisibili(false);
    // Il filtro è già stato applicato quando è stato selezionato
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
      const date = safeParseDate(dateString);
      if (date && !isNaN(date.getTime())) {
        return format(date, 'dd/MM/yyyy', { locale: it });
      } else {
        return 'Data non valida';
      }
    } catch (err) {
      console.error('Errore nella formattazione della data:', err);
      return 'Errore formato data';
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
      const scadenza = safeParseDate(dataScadenza);
      
      if (!scadenza || isNaN(scadenza.getTime())) {
        console.warn('Data di scadenza non valida per il calcolo dei giorni rimanenti:', dataScadenza);
        return 0;
      }
      
      const diffTime = scadenza.getTime() - oggi.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (err) {
      console.error('Errore nel calcolo dei giorni rimanenti:', err);
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

  // Aggiungiamo il modale di filtri
  const renderFiltriModal = () => (
    <Portal>
      <Dialog
        visible={filtriVisibili}
        onDismiss={() => setFiltriVisibili(false)}
        style={styles.filtriDialog}
      >
        <Dialog.Title>Filtri</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.filterSectionTitle}>Stato Lotti</Text>
          <View style={styles.colorFiltersContainer}>
            <Chip
              selected={filtri.stato === 'verde'}
              onPress={() => applyStatoFilter('verde')}
              style={[styles.colorFilterChip, styles.greenChip]}
              textStyle={{ color: filtri.stato === 'verde' ? '#fff' : '#000' }}
              selectedColor="#4CAF50"
            >
              Verde
            </Chip>
            <Chip
              selected={filtri.stato === 'arancione'}
              onPress={() => applyStatoFilter('arancione')}
              style={[styles.colorFilterChip, styles.orangeChip]}
              textStyle={{ color: filtri.stato === 'arancione' ? '#fff' : '#000' }}
              selectedColor="#FFA000"
            >
              Arancione
            </Chip>
            <Chip
              selected={filtri.stato === 'rosso'}
              onPress={() => applyStatoFilter('rosso')}
              style={[styles.colorFilterChip, styles.redChip]}
              textStyle={{ color: filtri.stato === 'rosso' ? '#fff' : '#000' }}
              selectedColor="#F44336"
            >
              Rosso
            </Chip>
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={resetFiltri}>Reimposta</Button>
          <Button 
            mode="contained" 
            onPress={() => setFiltriVisibili(false)}
          >
            Applica
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
          onChangeText={handleSearchChange}
          value={searchQuery}
          style={styles.searchbar}
          icon="magnify"
          onSubmitEditing={onSearch}
        />
        <IconButton
          icon="magnify"
          size={24}
          onPress={onSearch}
          style={styles.searchButton}
          iconColor="#FFFFFF"
        />
        <IconButton
          icon="filter"
          size={24}
          onPress={() => setFiltriVisibili(true)}
          style={[
            styles.filterButton,
            Object.keys(filtri).length > 0 && styles.activeFilterButton
          ]}
          iconColor={Object.keys(filtri).length > 0 ? PRIMARY_COLOR : '#555'}
        />
      </View>

      {/* Mostra se ci sono filtri attivi */}
      {(Object.keys(filtri).length > 0 || searchQuery.trim()) && (
        <View style={styles.activeFiltersContainer}>
          <Text style={styles.activeFiltersText}>Filtri attivi:</Text>
          
          {/* Chip per la ricerca (filtro locale) */}
          {searchQuery.trim() && (
            <Chip 
              style={styles.filterChip} 
              onClose={() => {
                // Reset solo della ricerca locale
                setSearchQuery('');
                // Riapplica i filtri senza ricerca
                setLotti(lottiNonFiltrati);
                console.log('Rimosso filtro di ricerca locale');
              }}
            >
              Ricerca: {searchQuery.trim()}
            </Chip>
          )}
          
          {/* Chip per lo stato (filtro API) */}
          {filtri.stato && (
            <Chip 
              style={[
                styles.filterChip, 
                filtri.stato === 'verde' ? styles.greenChip : 
                filtri.stato === 'arancione' ? styles.orangeChip : 
                filtri.stato === 'rosso' ? styles.redChip : null
              ]} 
              onClose={() => applyStatoFilter(null)}
            >
              Stato: {filtri.stato}
            </Chip>
          )}
          
          {/* Button per resettare tutti i filtri */}
          <Button 
            mode="text" 
            onPress={resetFiltri}
            style={styles.resetButton}
            icon="filter-remove"
          >
            Resetta tutto
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
      
      {/* Modale di prenotazione */}
      {renderDialog()}
      
      {/* Modale dei filtri */}
      {renderFiltriModal()}
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
  searchButton: {
    margin: 0,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 4,
    marginRight: 8,
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
  activeFilterButton: {
    backgroundColor: 'rgba(0, 152, 74, 0.1)',
  },
  filtriDialog: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingBottom: 8,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  colorFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 16,
  },
  colorFilterChip: {
    margin: 4,
    minWidth: 80,
    justifyContent: 'center',
  },
  greenChip: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  orangeChip: {
    backgroundColor: 'rgba(255, 160, 0, 0.2)',
    borderColor: '#FFA000',
    borderWidth: 1,
  },
  redChip: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderColor: '#F44336',
    borderWidth: 1,
  },
}); 