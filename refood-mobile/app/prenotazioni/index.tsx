import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Button, Card, Title, Paragraph, Badge, Chip, Searchbar, IconButton, ActivityIndicator, Portal, Dialog, TextInput, Divider } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  getPrenotazioni, 
  annullaPrenotazione, 
  accettaPrenotazione,
  rifiutaPrenotazione,
  eliminaPrenotazione,
  Prenotazione,
  invalidateCache
} from '../../src/services/prenotazioniService';
import { PRIMARY_COLOR, USER_ROLES } from '../../src/config/constants';
import { useAuth } from '../../src/context/AuthContext';
import Toast from 'react-native-toast-message';

interface Filtri {
  stato?: string;
  data_inizio?: string;
  data_fine?: string;
  centro_id?: number;
  stato_multiple?: string[];
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
  
  // Stati per l'accettazione e il rifiuto
  const [accettazioneModalVisible, setAccettazioneModalVisible] = useState(false);
  const [dataRitiroPrevista, setDataRitiroPrevista] = useState<Date | null>(null);
  const [accettazioneInCorso, setAccettazioneInCorso] = useState(false);
  
  const [rifiutoModalVisible, setRifiutoModalVisible] = useState(false);
  const [motivoRifiuto, setMotivoRifiuto] = useState('');
  const [rifiutoInCorso, setRifiutoInCorso] = useState(false);
  
  const [eliminazioneModalVisible, setEliminazioneModalVisible] = useState(false);
  const [eliminazioneInCorso, setEliminazioneInCorso] = useState(false);

  // Funzione per caricare le prenotazioni
  const loadPrenotazioni = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Caricamento prenotazioni con filtri:', JSON.stringify(filtri));
      
      // Aggiungi il filtro per centro in base al ruolo dell'utente
      let filtriRuolo = { ...filtri };
      
      if (user) {        
        // Per i centri sociali, mostra solo le proprie prenotazioni
        if (user.ruolo === USER_ROLES.ADMIN || user.ruolo === USER_ROLES.OPERATOR) {
          // Usa il centro_id dell'utente se disponibile
          if (user.centro_id) {
            filtriRuolo.centro_id = user.centro_id;
          }
        }
        // Per operatori e amministratori, il backend filtrerà in base ai centri associati
      }
      
      console.log('Recupero prenotazioni dal server con filtri:', JSON.stringify(filtriRuolo));
      const result = await getPrenotazioni(filtriRuolo, forceRefresh);
      
      console.log('Risultato della chiamata getPrenotazioni:', JSON.stringify(result, null, 2));
      
      if (!result.prenotazioni || result.prenotazioni.length === 0) {
        console.log('Nessuna prenotazione restituita dal server');
        setPrenotazioni([]);
      } else {
        console.log(`Ricevute ${result.prenotazioni.length} prenotazioni dal server`);
        
        // Ordina le prenotazioni (le più recenti prima)
        const prenotazioniOrdinate = result.prenotazioni.sort((a: Prenotazione, b: Prenotazione) => {
          return new Date(b.data_prenotazione).getTime() - new Date(a.data_prenotazione).getTime();
        });
        
        // Log dettagliato delle prenotazioni ricevute
        prenotazioniOrdinate.forEach((p: Prenotazione, index: number) => {
          console.log(`Prenotazione ${index+1}: ID=${p.id}, Stato=${p.stato}, Lotto=${p.lotto?.nome || 'N/A'}`);
        });
        
        setPrenotazioni(prenotazioniOrdinate);
        console.log('Prenotazioni caricate con successo');
      }
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
      // Quando cambiano i filtri, svuota prima l'elenco delle prenotazioni
      // per evitare di mostrare dati vecchi mentre si caricano quelli nuovi
      setPrenotazioni([]);
      setLoading(true);
      
      // Invalida la cache prima di ricaricare i dati
      invalidateCache();
      
      // Ricarica le prenotazioni con i nuovi filtri
      loadPrenotazioni(true);
    }
  }, [filtri]);
  
  // Effetto per ricaricare le prenotazioni quando la schermata ottiene il focus
  useFocusEffect(
    useCallback(() => {
      console.log("useFocusEffect: ricarico le prenotazioni");
      loadPrenotazioni(true); // Forza il ricaricamento quando la schermata ottiene il focus
      return () => {
        // Cleanup
      };
    }, [filtri]) // Aggiungiamo filtri come dipendenza per reagire ai cambiamenti
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
    console.log('Filtri resettati, ricarico tutte le prenotazioni');
    // Prima di ricaricare i dati, invalidare la cache
    invalidateCache();
    setLoading(true);
    loadPrenotazioni(true);
  };
  
  // Funzione per applicare i filtri per stato
  const applyStatusFilter = (stato: string) => {
    // Se stiamo cliccando sullo stesso filtro già attivo, non fare nulla
    if (filtri.stato === stato) {
      console.log(`Filtro ${stato} già attivo, ricarico comunque i dati`);
      // Forziamo comunque un refresh dei dati
      setLoading(true);
      invalidateCache();
      loadPrenotazioni(true);
      return;
    }
    
    console.log(`Applicazione filtro stato: ${stato}`);
    // Mostra lo stato di caricamento prima di cambiare il filtro
    setLoading(true);
    
    // Invalida la cache prima di cambiare filtro
    invalidateCache();
    
    // Imposta il nuovo filtro
    setFiltri({ stato });
  };
  
  // Funzione per navigare ai dettagli della prenotazione
  const navigateToPrenotazioneDetail = (prenotazione: Prenotazione) => {
    // @ts-ignore - Il formato è corretto ma TypeScript non lo riconosce
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
      if (isNaN(date.getTime())) {
        console.warn('Data non valida:', dateString);
        return 'Data non valida';
      }
      return format(date, 'dd/MM/yyyy', { locale: it });
    } catch (err) {
      console.error('Errore nella formattazione della data:', err);
      return dateString;
    }
  };
  
  // Funzione per ottenere il colore dello stato
  const getStatoColor = (stato: string) => {
    const statoLower = stato.toLowerCase();
    if (statoLower === 'richiesta' || statoLower === 'prenotato' || statoLower === 'inattesa') {
      return '#FFA000'; // arancione
    } else if (statoLower === 'confermata' || statoLower === 'confermato') {
      return '#4CAF50'; // verde
    } else if (statoLower === 'intransito') {
      return '#2196F3'; // blu
    } else if (statoLower === 'completata' || statoLower === 'consegnato') {
      return '#673AB7'; // viola
    } else if (statoLower === 'annullata' || statoLower === 'annullato') {
      return '#F44336'; // rosso
    } else if (statoLower === 'rifiutato') {
      return '#F44336'; // rosso (stesso del annullato per coerenza visiva)
    } else if (statoLower === 'eliminato') {
      return '#9E9E9E'; // grigio
    } else {
      return '#9E9E9E'; // grigio default
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
    const statoLower = stato.toLowerCase();
    if (statoLower === 'richiesta' || statoLower === 'prenotato' || statoLower === 'inattesa') {
      return 'In attesa di conferma';
    } else if (statoLower === 'confermata' || statoLower === 'confermato') {
      return 'Prenotazione confermata';
    } else if (statoLower === 'intransito') {
      return 'In transito verso la destinazione';
    } else if (statoLower === 'completata' || statoLower === 'consegnato') {
      return 'Consegna completata';
    } else if (statoLower === 'annullata' || statoLower === 'annullato') {
      return 'Prenotazione annullata';
    } else if (statoLower === 'rifiutato') {
      return 'Prenotazione rifiutata';
    } else if (statoLower === 'eliminato') {
      return 'Prenotazione eliminata';
    } else {
      return stato;
    }
  };
  
  // Funzione helper per verificare lo stato in modo sicuro
  const isStato = (stato: string, valori: string[]): boolean => {
    const statoLower = stato.toLowerCase();
    return valori.some(v => {
      const vLower = v.toLowerCase();
      // Gestisci gli stati equivalenti
      if ((statoLower === 'prenotato' && vLower === 'richiesta') || 
          (statoLower === 'richiesta' && vLower === 'prenotato') ||
          (statoLower === 'inattesa' && vLower === 'richiesta') ||
          (statoLower === 'richiesta' && vLower === 'inattesa') ||
          (statoLower === 'prenotato' && vLower === 'inattesa') ||
          (statoLower === 'inattesa' && vLower === 'prenotato') ||
          (statoLower === 'confermato' && vLower === 'confermata') ||
          (statoLower === 'confermata' && vLower === 'confermato') ||
          (statoLower === 'intransito' && vLower === 'confermata') ||
          (statoLower === 'confermata' && vLower === 'intransito') ||
          (statoLower === 'consegnato' && vLower === 'completata') ||
          (statoLower === 'completata' && vLower === 'consegnato') ||
          (statoLower === 'annullato' && vLower === 'annullata') ||
          (statoLower === 'annullata' && vLower === 'annullato') ||
          (statoLower === 'eliminato' && vLower === 'eliminata') ||
          (statoLower === 'eliminata' && vLower === 'eliminato') ||
          (statoLower === 'rifiutato' && vLower === 'rifiutata') ||
          (statoLower === 'rifiutata' && vLower === 'rifiutato')) {
        return true;
      }
      return statoLower === vLower;
    });
  };
  
  // Funzione per renderizzare un item della lista
  const renderPrenotazioneItem = ({ item }: { item: Prenotazione }) => {
    const statoColor = getStatoColor(item.stato);
    
    // Utilizziamo i campi presenti direttamente nell'oggetto item, non dentro lotto
    // poiché l'API restituisce i dati del lotto già "appiattiti" nella prenotazione
    
    // Verifica se l'utente può gestire la prenotazione (operatore o amministratore)
    const canManagePrenotazione = user && 
      (user.ruolo === USER_ROLES.OPERATOR || user.ruolo === USER_ROLES.ADMIN) && 
      isStato(item.stato, ['Richiesta', 'Prenotato', 'InAttesa']);
    
    // Verifica se l'utente può eliminare la prenotazione (solo amministratore)
    const canDeletePrenotazione = user && 
      user.ruolo === USER_ROLES.ADMIN && 
      isStato(item.stato, ['Richiesta', 'Confermata', 'Prenotato', 'InAttesa', 'Confermato', 'InTransito']);
    
    // Mostra i pulsanti di gestione
    const isOperatoreOrAdmin = user && 
      (user.ruolo === USER_ROLES.OPERATOR || user.ruolo === USER_ROLES.ADMIN);
    const isAdmin = user && user.ruolo === USER_ROLES.ADMIN;
    
    return (
      <Card 
        style={[styles.prenotazioneCard, { borderLeftColor: statoColor }]} 
        onPress={() => navigateToPrenotazioneDetail(item)}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Title numberOfLines={1} style={styles.cardTitle}>{item.prodotto || 'Lotto non disponibile'}</Title>
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
                {item.quantita || '?'} {item.unita_misura || 'pz'}
              </Text>
            </View>
            
            <View style={styles.dettaglioItem}>
              <Ionicons name="home-outline" size={16} color="#555" />
              <Text style={styles.dettaglioText} numberOfLines={1}>
                Da: {item.centro_origine_nome || 'Centro origine sconosciuto'}
              </Text>
            </View>
            
            <View style={styles.dettaglioItem}>
              <Ionicons name="location-outline" size={16} color="#555" />
              <Text style={styles.dettaglioText} numberOfLines={1}>
                A: {item.centro_ricevente_nome || 'Centro destinazione sconosciuto'}
              </Text>
            </View>
            
            <View style={styles.dettaglioItem}>
              <Ionicons name="calendar-outline" size={16} color="#555" />
              <Text style={styles.dettaglioText}>
                Prenotato il: {formatDate(item.data_prenotazione)}
              </Text>
            </View>
            
            {item.data_ritiro && (
              <View style={styles.dettaglioItem}>
                <Ionicons name="time-outline" size={16} color="#555" />
                <Text style={styles.dettaglioText}>
                  Ritiro previsto: {formatDate(item.data_ritiro)}
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
            labelStyle={styles.buttonLabel}
            compact
          >
            Dettagli
          </Button>
          
          {/* Centro sociale può annullare le proprie prenotazioni in stato Richiesta */}
          {(user?.ruolo === USER_ROLES.ADMIN || user?.ruolo === USER_ROLES.OPERATOR) && 
           isStato(item.stato, ['Richiesta']) && (
            <Button 
              mode="contained" 
              onPress={() => handleAnnullamento(item)}
              style={styles.annullaButton}
              icon="close-circle-outline"
              labelStyle={styles.buttonLabel}
              compact
            >
              Annulla
            </Button>
          )}
          
          {/* Operatore e amministratore possono confermare o rifiutare */}
          {isOperatoreOrAdmin && isStato(item.stato, ['Richiesta']) && (
            <View style={styles.manageButtonsContainer}>
              <Button 
                mode="contained" 
                onPress={() => handleAccettaPrenotazione(item)}
                style={styles.accettaButton}
                icon="check-circle-outline"
                labelStyle={styles.buttonLabel}
                compact
              >
                Accetta
              </Button>
              <Button 
                mode="contained" 
                onPress={() => handleRifiutaPrenotazione(item)}
                style={styles.rifiutaButton}
                icon="close-circle-outline"
                labelStyle={styles.buttonLabel}
                compact
              >
                Rifiuta
              </Button>
            </View>
          )}
          
          {/* Solo amministratore può eliminare */}
          {isAdmin && isStato(item.stato, ['Richiesta', 'Confermata']) && (
            <Button 
              mode="contained" 
              onPress={() => handleEliminaPrenotazione(item)}
              style={styles.eliminaButton}
              icon="delete-outline"
              labelStyle={styles.buttonLabel}
              compact
            >
              Elimina
            </Button>
          )}
        </Card.Actions>
      </Card>
    );
  };

  // Aggiungiamo le funzioni per gestire l'accettazione, il rifiuto e l'eliminazione
  const handleAccettaPrenotazione = (prenotazione: Prenotazione) => {
    setPrenotazioneSelezionata(prenotazione);
    // Imposta la data di domani come default per il ritiro
    setDataRitiroPrevista(addDays(new Date(), 1));
    setAccettazioneModalVisible(true);
  };

  const handleRifiutaPrenotazione = (prenotazione: Prenotazione) => {
    setPrenotazioneSelezionata(prenotazione);
    setMotivoRifiuto('');
    setRifiutoModalVisible(true);
  };

  const handleEliminaPrenotazione = (prenotazione: Prenotazione) => {
    setPrenotazioneSelezionata(prenotazione);
    setEliminazioneModalVisible(true);
  };

  // Funzione per confermare l'accettazione
  const confermaAccettazione = async () => {
    if (!prenotazioneSelezionata || !dataRitiroPrevista) return;
    
    try {
      setAccettazioneInCorso(true);
      
      // Formatta la data nel formato YYYY-MM-DD
      const dataRitiroFormatted = format(dataRitiroPrevista, 'yyyy-MM-dd');
      
      // Chiamata API per accettare la prenotazione
      const result = await accettaPrenotazione(
        prenotazioneSelezionata.id,
        dataRitiroFormatted
      );
      
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Prenotazione accettata',
          text2: result.message,
          visibilityTime: 4000,
        });
        
        // Chiudi il modale e ricarica le prenotazioni
        setAccettazioneModalVisible(false);
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
      console.error('Errore nell\'accettazione della prenotazione:', err);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: err.message || 'Impossibile accettare la prenotazione',
        visibilityTime: 4000,
      });
    } finally {
      setAccettazioneInCorso(false);
    }
  };

  // Funzione per confermare il rifiuto
  const confermaRifiuto = async () => {
    if (!prenotazioneSelezionata) return;
    
    try {
      setRifiutoInCorso(true);
      console.log(`Invio richiesta rifiuto per prenotazione ${prenotazioneSelezionata.id} con motivo: ${motivoRifiuto}`);
      
      // Chiamata API per rifiutare la prenotazione
      const result = await rifiutaPrenotazione(
        prenotazioneSelezionata.id,
        motivoRifiuto
      );
      
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Prenotazione rifiutata',
          text2: result.message,
          visibilityTime: 4000,
        });
        
        // Chiudi il modale e ricarica le prenotazioni
        setRifiutoModalVisible(false);
        
        // Carica normalmente
        console.log('Ricaricamento normale dopo rifiuto');
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
      console.error('Errore nel rifiuto della prenotazione:', err);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: err.message || 'Impossibile rifiutare la prenotazione',
        visibilityTime: 4000,
      });
    } finally {
      setRifiutoInCorso(false);
    }
  };

  // Funzione per confermare l'eliminazione
  const confermaEliminazione = async () => {
    if (!prenotazioneSelezionata) return;
    
    try {
      setEliminazioneInCorso(true);
      
      // Chiamata API per eliminare la prenotazione
      const result = await eliminaPrenotazione(
        prenotazioneSelezionata.id
      );
      
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Prenotazione eliminata',
          text2: result.message,
          visibilityTime: 4000,
        });
        
        // Chiudi il modale e ricarica le prenotazioni
        setEliminazioneModalVisible(false);
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
      console.error('Errore nell\'eliminazione della prenotazione:', err);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: err.message || 'Impossibile eliminare la prenotazione',
        visibilityTime: 4000,
      });
    } finally {
      setEliminazioneInCorso(false);
    }
  };

  // Controllo se l'utente può effettuare prenotazioni
  const canBook = user && [USER_ROLES.ADMIN, USER_ROLES.OPERATOR].includes(user.ruolo);

  useEffect(() => {
    // Effetto che si attiva quando l'utente è operatore o amministratore
    // per impostare automaticamente il filtro su "Richiesta" alla prima apertura
    if (user && (user.ruolo === USER_ROLES.OPERATOR || user.ruolo === USER_ROLES.ADMIN) && 
        !Object.keys(filtri).length && prenotazioni.length === 0) {
      console.log('Imposto filtro iniziale su "Prenotato" per operatore/admin');
      setFiltri({ stato: 'Prenotato' });
    }
  }, [user, prenotazioni.length]);

  return (
    <View style={styles.container}>
      {/* Header con filtri */}
      <View style={styles.headerContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 2 }}
        >
          <Chip
            selected={!filtri.stato}
            onPress={() => resetFiltri()}
            style={styles.filterChip}
            textStyle={{ color: !filtri.stato ? '#fff' : '#000' }}
            selectedColor="#4CAF50"
          >
            Tutte
          </Chip>
          <Chip
            selected={filtri.stato === 'Prenotato'}
            onPress={() => applyStatusFilter('Prenotato')}
            style={styles.filterChip}
            textStyle={{ color: filtri.stato === 'Prenotato' ? '#fff' : '#000' }}
            selectedColor="#FFA000"
          >
            In attesa
          </Chip>
          <Chip
            selected={filtri.stato === 'Confermato'}
            onPress={() => applyStatusFilter('Confermato')}
            style={styles.filterChip}
            textStyle={{ color: filtri.stato === 'Confermato' ? '#fff' : '#000' }}
            selectedColor="#4CAF50"
          >
            Confermate
          </Chip>
          <Chip
            selected={filtri.stato === 'InTransito'}
            onPress={() => applyStatusFilter('InTransito')}
            style={styles.filterChip}
            textStyle={{ color: filtri.stato === 'InTransito' ? '#fff' : '#000' }}
            selectedColor="#2196F3"
          >
            In transito
          </Chip>
          <Chip
            selected={filtri.stato === 'Consegnato'}
            onPress={() => applyStatusFilter('Consegnato')}
            style={styles.filterChip}
            textStyle={{ color: filtri.stato === 'Consegnato' ? '#fff' : '#000' }}
            selectedColor="#673AB7"
          >
            Consegnate
          </Chip>
          <Chip
            selected={filtri.stato === 'Annullato'}
            onPress={() => applyStatusFilter('Annullato')}
            style={styles.filterChip}
            textStyle={{ color: filtri.stato === 'Annullato' ? '#fff' : '#000' }}
            selectedColor="#F44336"
          >
            Annullate
          </Chip>
          <Chip
            selected={filtri.stato === 'Rifiutato'}
            onPress={() => applyStatusFilter('Rifiutato')}
            style={styles.filterChip}
            textStyle={{ color: filtri.stato === 'Rifiutato' ? '#fff' : '#000' }}
            selectedColor="#E91E63"
          >
            Rifiutate
          </Chip>
        </ScrollView>
      </View>

      {/* Contenuto principale */}
      <View style={styles.contentContainer}>
        {loading ? (
          <View style={styles.centeredContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
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
              color="#4CAF50"
            >
              Riprova
            </Button>
          </View>
        ) : prenotazioni.length === 0 ? (
          <View style={styles.centeredContainer}>
            <Ionicons name="cart-outline" size={48} color="#9E9E9E" />
            <Text style={styles.emptyText}>Nessuna prenotazione trovata</Text>
            <Text style={styles.emptySubtext}>
              Non ci sono prenotazioni da visualizzare{filtri.stato ? ` con stato "${filtri.stato}"` : ''}.
              {filtri.stato && (
                <Text>
                  {'\n'}
                  <Text 
                    style={styles.resetFilterLink}
                    onPress={resetFiltri}
                  >
                    Rimuovi filtro
                  </Text>
                </Text>
              )}
            </Text>
            {canBook && (
              <Button 
                mode="contained" 
                onPress={navigateToLottiDisponibili}
                style={styles.exploreButton}
                icon="search"
                color="#4CAF50"
              >
                Esplora lotti disponibili
              </Button>
            )}
          </View>
        ) : (
          <FlatList
            data={prenotazioni}
            renderItem={renderPrenotazioneItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            numColumns={1}
            showsVerticalScrollIndicator={false}
            initialNumToRender={5}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#4CAF50"]}
              />
            }
          />
        )}
      </View>
      
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
      
      {/* Modale di accettazione */}
      <Portal>
        <Dialog
          visible={accettazioneModalVisible}
          onDismiss={() => !accettazioneInCorso && setAccettazioneModalVisible(false)}
          dismissable={!accettazioneInCorso}
        >
          <Dialog.Title>Conferma accettazione</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Stai per accettare la prenotazione del lotto{' '}
              <Text style={styles.boldText}>
                {prenotazioneSelezionata?.lotto?.nome}
              </Text>.
            </Text>
            
            <Text style={styles.dialogLabel}>Data di ritiro prevista:</Text>
            <TouchableOpacity 
              onPress={() => {
                // Qui in futuro potremmo aprire un date picker
              }}
              style={styles.dateInputContainer}
            >
              <Text style={styles.dateInputText}>
                {dataRitiroPrevista ? format(dataRitiroPrevista, 'dd/MM/yyyy', { locale: it }) : 'Seleziona data'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#555" />
            </TouchableOpacity>
            
            <Text style={styles.dialogSubText}>
              Accettando la prenotazione, il centro che ha fatto la richiesta riceverà una notifica.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button 
              onPress={() => !accettazioneInCorso && setAccettazioneModalVisible(false)}
              disabled={accettazioneInCorso}
            >
              Annulla
            </Button>
            <Button 
              mode="contained" 
              onPress={confermaAccettazione}
              loading={accettazioneInCorso}
              disabled={accettazioneInCorso || !dataRitiroPrevista}
            >
              Conferma
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Modale di rifiuto */}
      <Portal>
        <Dialog
          visible={rifiutoModalVisible}
          onDismiss={() => !rifiutoInCorso && setRifiutoModalVisible(false)}
          dismissable={!rifiutoInCorso}
        >
          <Dialog.Title>Conferma rifiuto</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Stai per rifiutare la prenotazione del lotto{' '}
              <Text style={styles.boldText}>
                {prenotazioneSelezionata?.lotto?.nome}
              </Text>.
            </Text>
            
            <Text style={styles.dialogLabel}>Motivo del rifiuto (opzionale):</Text>
            <TextInput
              value={motivoRifiuto}
              onChangeText={setMotivoRifiuto}
              placeholder="Inserisci il motivo del rifiuto"
              multiline
              style={styles.dialogInput}
            />
            
            <Text style={styles.dialogSubText}>
              Rifiutando la prenotazione, il centro che ha fatto la richiesta riceverà una notifica.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button 
              onPress={() => !rifiutoInCorso && setRifiutoModalVisible(false)}
              disabled={rifiutoInCorso}
            >
              Annulla
            </Button>
            <Button 
              mode="contained" 
              onPress={confermaRifiuto}
              loading={rifiutoInCorso}
              disabled={rifiutoInCorso}
            >
              Conferma
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Modale di eliminazione */}
      <Portal>
        <Dialog
          visible={eliminazioneModalVisible}
          onDismiss={() => !eliminazioneInCorso && setEliminazioneModalVisible(false)}
          dismissable={!eliminazioneInCorso}
        >
          <Dialog.Title>Conferma eliminazione</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Stai per eliminare definitivamente la prenotazione del lotto{' '}
              <Text style={styles.boldText}>
                {prenotazioneSelezionata?.lotto?.nome}
              </Text>.
            </Text>
            
            <Text style={styles.dialogWarningText}>
              Questa operazione non può essere annullata.
            </Text>
            
            <Text style={styles.dialogSubText}>
              I centri associati a questa prenotazione riceveranno una notifica dell'eliminazione.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button 
              onPress={() => !eliminazioneInCorso && setEliminazioneModalVisible(false)}
              disabled={eliminazioneInCorso}
            >
              Annulla
            </Button>
            <Button 
              mode="contained" 
              onPress={confermaEliminazione}
              loading={eliminazioneInCorso}
              disabled={eliminazioneInCorso}
              style={styles.deleteDialogButton}
            >
              Elimina
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
  headerContainer: {
    backgroundColor: '#fff',
    paddingVertical: 6,
    elevation: 2,
    zIndex: 10,
    height: 48,
  },
  contentContainer: {
    flex: 1,
  },
  filterTabsContainer: {
    backgroundColor: '#fff',
    elevation: 2,
    paddingVertical: 0,
    maxHeight: 44,
    height: 44,
    zIndex: 10,
  },
  resetButton: {
    marginBottom: 10,
  },
  debugText: {
    fontSize: 14,
    color: '#555',
    marginTop: 0,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 30,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
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
    textAlign: 'center',
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
    padding: 0,
    paddingTop: 0,
    paddingBottom: 80, // Aggiungi spazio in fondo per il FAB
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  prenotazioneCard: {
    marginVertical: 4,
    marginHorizontal: 6,
    elevation: 2,
    borderRadius: 8,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    backgroundColor: '#fff',
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
  cardTitle: {
    fontSize: 18,
    flex: 1,
    marginRight: 8,
  },
  statoBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
  },
  statoLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 8,
    backgroundColor: '#E0E0E0',
    height: 1,
  },
  dettagliContainer: {
    marginVertical: 8,
  },
  dettaglioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dettaglioText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  cardActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    marginRight: 8,
    minWidth: 80,
    height: 36,
    borderColor: '#4CAF50',
  },
  annullaButton: {
    flex: 1,
    backgroundColor: '#F44336',
    height: 36,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    zIndex: 100,
  },
  annullamentoModal: {
    backgroundColor: 'white',
    borderRadius: 8,
  },
  motivoInput: {
    backgroundColor: 'transparent',
    marginTop: 16,
  },
  manageButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flex: 2,
  },
  accettaButton: {
    marginRight: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    height: 36,
    minWidth: 80,
  },
  rifiutaButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    height: 36,
    minWidth: 80,
  },
  eliminaButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    height: 36,
    minWidth: 80,
  },
  buttonLabel: {
    fontSize: 12,
    margin: 0,
    padding: 0,
  },
  dialogText: {
    fontSize: 16,
    marginBottom: 16,
    color: '#333',
  },
  dialogLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: '#555',
    fontWeight: 'bold',
  },
  dialogInput: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
  },
  dialogSubText: {
    fontSize: 14,
    marginTop: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  dialogWarningText: {
    fontSize: 16,
    marginVertical: 8,
    color: '#F44336',
    fontWeight: 'bold',
  },
  filterChip: {
    marginRight: 8,
    marginVertical: 4,
    height: 32,
    borderRadius: 16,
    elevation: 1,
  },
  resetFilterLink: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  boldText: {
    fontWeight: 'bold',
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  dateInputText: {
    fontSize: 16,
    color: '#333',
  },
  debugBar: {
    backgroundColor: '#f0f9f0',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  deleteDialogButton: {
    backgroundColor: '#F44336',
  },
}); 