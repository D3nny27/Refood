import React, { useState, useEffect, useMemo } from 'react';
import {
  View, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  Pressable,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  HelperText,
  Appbar,
  Card,
  Divider,
  Portal,
  Modal,
  Surface,
  List,
  useTheme,
  Title,
  FAB,
  Chip
} from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../../src/context/AuthContext';
import { getLottoById, updateLotto, invalidateCache } from '../../../src/services/lottiService';
import { prenotaLotto } from '../../../src/services/prenotazioniService';
import { PRIMARY_COLOR, RUOLI, STORAGE_KEYS, API_URL } from '../../../src/config/constants';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { useNotifiche } from '../../../src/context/NotificheContext';
import pushNotificationService from '../../../src/services/pushNotificationService';
import notificheService from '../../../src/services/notificheService';
import logger from '../../../src/utils/logger';
import { emitEvent, APP_EVENTS } from '../../../src/utils/events';

// Definizione delle unità di misura disponibili, raggruppate per tipo
const UNITA_MISURA_GROUPS = {
  'Peso': ['kg', 'g'],
  'Volume': ['l', 'ml'],
  'Quantità': ['pz'],
};

// Lista semplice per il selettore
const UNITA_MISURA = ['kg', 'g', 'l', 'ml', 'pz'];

// Definizione delle unità di misura disponibili
const UNITA_MISURA_OPTIONS = [
  { label: 'Chilogrammi (kg)', value: 'kg' },
  { label: 'Grammi (g)', value: 'g' },
  { label: 'Litri (l)', value: 'l' },
  { label: 'Millilitri (ml)', value: 'ml' },
  { label: 'Pezzi (pz)', value: 'pz' },
];

const formatDate = (date: Date | null) => {
  if (!date) return 'Data non impostata';
  
  try {
    // Verifico che la data sia valida
    if (isNaN(date.getTime())) {
      console.warn('Data non valida:', date);
      return 'Data non valida';
    }
    
    return format(date, 'dd/MM/yyyy', { locale: it });
  } catch (error) {
    console.error('Errore nella formattazione della data:', error);
    return 'Errore formato data';
  }
};

// Funzione per formattare le date con orario
const formatDateTime = (date: Date | null) => {
  if (!date) return 'Data non impostata';
  
  try {
    // Verifico che la data sia valida
    if (isNaN(date.getTime())) {
      console.warn('Data non valida:', date);
      return 'Data non valida';
    }
    
    return format(date, 'dd/MM/yyyy HH:mm', { locale: it });
  } catch (error) {
    console.error('Errore nella formattazione della data e ora:', error);
    return 'Errore formato data';
  }
};

const DettaglioLottoScreen = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const { refreshNotifiche } = useNotifiche();
  // @ts-ignore - Ignoro temporaneamente l'errore di tipizzazione
  const params = require('expo-router').useLocalSearchParams();
  const { id } = params;
  
  // Controlla se l'utente può modificare i lotti in base al suo ruolo
  const canEditLotto = useMemo(() => {
    return user?.ruolo === 'Operatore' || user?.ruolo === 'Amministratore';
  }, [user]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lotto, setLotto] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  
  // Stato del form
  const [nome, setNome] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [quantita, setQuantita] = useState('');
  const [unitaMisura, setUnitaMisura] = useState('kg');
  const [dataScadenza, setDataScadenza] = useState<Date | null>(new Date());
  
  // Stati dei modali
  const [showUnitaPicker, setShowUnitaPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Validazione
  const [errors, setErrors] = useState({
    nome: false,
    quantita: false,
    dataScadenza: false,
  });

  // Stati per la prenotazione
  const [prenotazioneModalVisible, setPrenotazioneModalVisible] = useState(false);
  const [dataRitiroPrevista, setDataRitiroPrevista] = useState(addDays(new Date(), 1));
  const [notePrenotazione, setNotePrenotazione] = useState('');
  const [prenotazioneInCorso, setPrenotazioneInCorso] = useState(false);
  
  // Determina se l'utente può prenotare il lotto (solo utenti del tipo centro di riciclo o canale sociale)
  const canPrenotareLotto = useMemo(() => {
    return user?.tipo_utente?.toUpperCase() === 'CANALE SOCIALE' || 
           user?.tipo_utente?.toUpperCase() === 'CENTRO RICICLO';
  }, [user]);
  
  // Verifica i permessi di modifica all'avvio
  useEffect(() => {
    if (!canEditLotto && editMode) {
      // Se l'utente non ha i permessi ma è in modalità modifica, disattiva la modalità di modifica
      setEditMode(false);
      Toast.show({
        type: 'error',
        text1: 'Permessi insufficienti',
        text2: 'Non hai i permessi per modificare questo lotto',
      });
    }
  }, [canEditLotto, editMode]);

  // Debug: verifica l'apertura del modale di prenotazione
  useEffect(() => {
    if (prenotazioneModalVisible) {
      console.log('Modale di prenotazione aperto');
    } else {
      console.log('Modale di prenotazione chiuso');
    }
  }, [prenotazioneModalVisible]);

  // Funzione di utilità per il debug delle date
  const debugDateValue = (label: string, value: any): void => {
    try {
      let debugInfo = `${label}: `;
      
      // Analisi del tipo di valore
      debugInfo += `(tipo: ${typeof value}) `;
      
      if (value === null) {
        debugInfo += 'NULL';
      } else if (value === undefined) {
        debugInfo += 'UNDEFINED';
      } else if (typeof value === 'string') {
        debugInfo += `"${value}" `;
        
        // Prova a creare una data dalla stringa per vedere se è valida
        try {
          const testDate = new Date(value);
          debugInfo += `→ Date: ${testDate} (${isNaN(testDate.getTime()) ? 'INVALIDA' : 'valida'})`;
        } catch (error) {
          const err = error as Error;
          debugInfo += `→ NON convertibile in Date: ${err.message || 'errore sconosciuto'}`;
        }
      } else if (value instanceof Date) {
        debugInfo += `Date object: ${value.toString()} `;
        debugInfo += `(getTime: ${isNaN(value.getTime()) ? 'INVALIDA' : value.getTime()})`;
        debugInfo += `(ISO: ${isNaN(value.getTime()) ? 'INVALIDA' : value.toISOString()})`;
      } else {
        debugInfo += `${JSON.stringify(value)}`;
      }
      
      // Log generale
      console.log(debugInfo);
      
      // Per date critiche, mostra un toast per debug
      if (label.includes('CRITICO')) {
        Toast.show({
          type: 'info',
          text1: 'Debug data',
          text2: debugInfo.substring(0, 100) + (debugInfo.length > 100 ? '...' : ''),
          position: 'bottom',
          visibilityTime: 4000,
        });
      }
      
    } catch (error) {
      const err = error as Error;
      console.error('Errore nella funzione debugDateValue:', err.message || String(err));
    }
  };

  // Funzione di utilità per il parsing sicuro delle date
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
      console.error('Errore nel parsing della data:', error);
      return null;
    }
  };

  // Carica i dati del lotto
  useEffect(() => {
    const fetchLotto = async () => {
      try {
        setLoading(true);
        const lottoData = await getLottoById(Number(id));
        
        // Debug della data ricevuta
        debugDateValue('LOTTO RICEVUTO - data_scadenza', lottoData.data_scadenza);
        
        setLotto(lottoData);
        
        // Popola i campi del form con i dati del lotto
        setNome(lottoData.nome);
        setDescrizione(lottoData.descrizione || '');
        setQuantita(lottoData.quantita.toString());
        setUnitaMisura(lottoData.unita_misura);
        
        // Assicurati che la data di scadenza sia valida
        try {
          // Usa il parsing sicuro
          const scadenzaDate = safeParseDate(lottoData.data_scadenza);
          if (scadenzaDate) {
            debugDateValue('Data di scadenza parsata', scadenzaDate);
            setDataScadenza(scadenzaDate);
          } else {
            // Se la data non è valida, imposta la data corrente
            console.warn('Data di scadenza non valida:', lottoData.data_scadenza);
            setDataScadenza(new Date());
          }
        } catch (dateError) {
          console.error('Errore nella conversione della data:', dateError);
          setDataScadenza(new Date()); // Fallback alla data corrente
        }
      } catch (error) {
        console.error('Errore nel caricamento del lotto:', error);
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: 'Impossibile caricare i dati del lotto',
        });
        router.back();
      } finally {
        setLoading(false);
      }
    };
    
    fetchLotto();
  }, [id]);

  // Validazione dei campi
  const validateField = (field: string, value: any) => {
    switch (field) {
      case 'nome':
        setErrors(prev => ({ ...prev, nome: !value.trim() }));
        break;
      case 'quantita':
        const qty = parseFloat(value);
        setErrors(prev => ({ ...prev, quantita: isNaN(qty) || qty <= 0 }));
        break;
      case 'dataScadenza':
        setErrors(prev => ({ ...prev, dataScadenza: !value }));
        break;
      default:
        break;
    }
  };

  const validateForm = () => {
    const newErrors = {
      nome: !nome.trim(),
      quantita: isNaN(parseFloat(quantita)) || parseFloat(quantita) <= 0,
      dataScadenza: !dataScadenza,
    };
    
    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error);
  };

  // Gestione del salvataggio
  const handleSubmit = async () => {
    // Validazione del form
    if (!validateForm()) {
      return;
    }
    
    try {
      setSaving(true);
      
      // Assicurati che dataScadenza sia una data valida
      if (!dataScadenza || isNaN(dataScadenza.getTime())) {
        throw new Error('Data di scadenza non valida');
      }
      
      // Formatta la data nel formato YYYY-MM-DD per il backend
      const formattedDate = dataScadenza.toISOString().split('T')[0];
      console.log(`Data scadenza formattata per update: ${formattedDate}`);
      
      // Prepara i dati per l'aggiornamento
      const lottoData = {
        id: lotto.id,
        nome,
        descrizione,
        quantita: parseFloat(quantita),
        unita_misura: unitaMisura,
        data_scadenza: formattedDate, // Formato YYYY-MM-DD per il backend
        notifyAdmin: true, // Notifica gli amministratori delle modifiche
      };
      
      console.log('Dati inviati per aggiornamento:', lottoData);
      
      // Invia l'aggiornamento
      const updatedLottoResponse = await updateLotto(lotto.id, lottoData, true);
      
      if (!updatedLottoResponse.success) {
        throw new Error(updatedLottoResponse.message || 'Errore nell\'aggiornamento del lotto');
      }
      
      Toast.show({
        type: 'success',
        text1: 'Lotto aggiornato',
        text2: 'Le modifiche sono state salvate con successo',
      });
      
      // Forza un refresh completo dei dati dal server
      const refreshedLotto = await getLottoById(lotto.id);
      console.log('Lotto refreshed after update:', refreshedLotto);
      
      // Aggiorna lo stato locale con i dati aggiornati
      setLotto(refreshedLotto);
      
      // Aggiorna anche i campi di form per sicurezza
      setNome(refreshedLotto.nome);
      setDescrizione(refreshedLotto.descrizione || '');
      setQuantita(refreshedLotto.quantita.toString());
      setUnitaMisura(refreshedLotto.unita_misura);
      
      // Parsing sicuro della data di scadenza
      if (refreshedLotto.data_scadenza) {
        const newDate = safeParseDate(refreshedLotto.data_scadenza);
        if (newDate) {
          console.log(`Nuova data di scadenza impostata: ${newDate.toISOString()}`);
          setDataScadenza(newDate);
        }
      }
      
      setEditMode(false);
      refreshNotifiche(); // Aggiorna le notifiche
      
    } catch (error) {
      console.error('Errore nell\'aggiornamento del lotto:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: error instanceof Error ? error.message : 'Impossibile aggiornare il lotto',
      });
    } finally {
      setSaving(false);
    }
  };

  // Annulla le modifiche
  const handleCancel = () => {
    // Debug della data originale
    debugDateValue('CRITICO - data_scadenza originale nel lotto', lotto.data_scadenza);
    
    // Resetta i campi ai valori originali
    setNome(lotto.nome);
    setDescrizione(lotto.descrizione || '');
    setQuantita(lotto.quantita.toString());
    setUnitaMisura(lotto.unita_misura);
    
    // Usa la funzione safeParseDate per il parsing sicuro
    const parsedDate = safeParseDate(lotto.data_scadenza);
    if (parsedDate) {
      debugDateValue('Data di scadenza ripristinata', parsedDate);
      setDataScadenza(parsedDate);
    } else {
      console.warn('Impossibile parsare la data di scadenza durante il reset, imposto la data corrente');
      setDataScadenza(new Date());
    }
    
    setEditMode(false);
  };

  // Calcola stato del lotto (scaduto, in scadenza, ecc.)
  const getLottoStatus = () => {
    if (!lotto) return { label: 'In caricamento', color: '#666', bgColor: '#f5f5f5' };
    
    try {
      // Usa direttamente lo stato calcolato dal backend
      console.log('Stato del lotto dal backend:', lotto.stato);
      
      // Il backend può inviare "Verde", "Arancione", "Rosso"
      switch(lotto.stato) {
        case 'Rosso':
          return { label: 'Scaduto', color: '#d32f2f', bgColor: '#ffebee' };
        case 'Arancione':
          return { label: 'In scadenza', color: '#ff9800', bgColor: '#fff3e0' };
        case 'Verde':
          return { label: 'Valido', color: '#43a047', bgColor: '#e8f5e9' };
        default:
          // Fallback al calcolo manuale solo se non c'è lo stato
          const oggi = new Date();
          const scadenza = new Date(lotto.data_scadenza);
          
          console.log('Fallback al calcolo manuale:', {
            oggi: oggi.toISOString(),
            scadenza: scadenza.toISOString(),
          });
          
          if (scadenza < oggi) {
            return { label: 'Scaduto', color: '#d32f2f', bgColor: '#ffebee' };
          }
          
          // Giorni rimanenti
          const diffTime = scadenza.getTime() - oggi.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          console.log(`Giorni rimanenti (calcolo manuale): ${diffDays}`);
          
          // Utilizzo la soglia dei 5 giorni come nel resto dell'app
          if (diffDays <= 5) {
            return { label: 'In scadenza', color: '#ff9800', bgColor: '#fff3e0' };
          }
          
          return { label: 'Valido', color: '#43a047', bgColor: '#e8f5e9' };
      }
    } catch (error) {
      console.error('Errore nel calcolo dello stato del lotto:', error);
      return { label: 'Stato sconosciuto', color: '#666', bgColor: '#f5f5f5' };
    }
  };

  // Incrementa la data in modo sicuro
  const incrementDate = (days: number) => {
    try {
      if (dataScadenza && !isNaN(dataScadenza.getTime())) {
        const newDate = new Date(dataScadenza);
        newDate.setDate(newDate.getDate() + days);
        setDataScadenza(newDate);
        validateField('dataScadenza', newDate);
      } else {
        // Se la data non è valida, usa oggi + l'incremento
        const today = new Date();
        today.setDate(today.getDate() + days);
        setDataScadenza(today);
        validateField('dataScadenza', today);
      }
    } catch (error) {
      console.error('Errore nell\'incremento della data:', error);
      const today = new Date();
      setDataScadenza(today);
      validateField('dataScadenza', today);
    }
  };

  // Funzione per gestire la prenotazione del lotto
  const handlePrenotazione = () => {
    // Verificare se l'utente può prenotare
    if (!canPrenotareLotto) {
      Toast.show({
        type: 'error',
        text1: 'Permessi insufficienti',
        text2: 'Non hai i permessi per prenotare questo lotto',
      });
      return;
    }
    
    // Mostra il modale di prenotazione
    setDataRitiroPrevista(addDays(new Date(), 1)); // Imposta la data di prelievo prevista a domani
    setNotePrenotazione('');
    setPrenotazioneModalVisible(true);
  };
  
  // Funzione per confermare la prenotazione
  const confermaPrenotazione = async () => {
    try {
      setPrenotazioneInCorso(true);
      
      // Formatta la data nel formato YYYY-MM-DD
      const dataRitiroFormatted = format(dataRitiroPrevista, 'yyyy-MM-dd');
      
      // Effettua la prenotazione
      const result = await prenotaLotto(
        lotto?.id || 0,
        dataRitiroFormatted,
        notePrenotazione || null
      );
      
      if (result.success) {
        // Aggiorna lo stato
        setPrenotazioneModalVisible(false);
        
        // Messaggio di conferma
        Toast.show({
          type: 'success',
          text1: 'Prenotazione effettuata',
          text2: 'La tua prenotazione è stata registrata con successo!',
          visibilityTime: 3000,
        });
        
        // Aggiorna le notifiche
        refreshNotifiche();
        
        // Reindirizza alla pagina delle prenotazioni
        router.push('/prenotazioni');
      } else {
        // Gestione specifica degli errori di prenotazione
        if (result.error?.message === 'Prenotazione duplicata') {
          // Caso di prenotazione duplicata dello stesso utente
          Toast.show({
            type: 'info',
            text1: 'Prenotazione già esistente',
            text2: `Hai già una prenotazione attiva per questo lotto (Stato: ${result.error.prenotazioneEsistente?.stato}).`,
            visibilityTime: 4000,
          });
        } else if (result.error?.message === 'Lotto già prenotato') {
          // Caso di lotto già prenotato da altri
          Toast.show({
            type: 'error',
            text1: 'Lotto non disponibile',
            text2: 'Questo lotto è già stato prenotato da un altro utente',
            visibilityTime: 3000,
          });
          
          // Torna alla lista dei lotti
          router.push('/lotti');
        } else if (result.missingCentroId) {
          // Caso di ID Centro richiesto ma non fornito
          Toast.show({
            type: 'info',
            text1: 'Configurazione mancante',
            text2: 'Contatta l\'amministratore per completare la configurazione',
            visibilityTime: 3000,
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Errore nella prenotazione',
            text2: result.message || 'Si è verificato un errore. Riprova più tardi.',
            visibilityTime: 3000,
          });
        }
      }
    } catch (error) {
      console.error('Errore nella prenotazione:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Si è verificato un errore durante la prenotazione. Riprova più tardi.',
        visibilityTime: 3000,
      });
    } finally {
      setPrenotazioneInCorso(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Caricamento...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={editMode ? "Modifica Lotto" : "Dettaglio Lotto"} />
        {!editMode && canEditLotto && (
          <Appbar.Action icon="pencil" onPress={() => setEditMode(true)} />
        )}
      </Appbar.Header>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!editMode ? (
          // Modalità visualizzazione
          <>
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.headerRow}>
                  <Title>{lotto.nome}</Title>
                  <Chip 
                    style={{ backgroundColor: getLottoStatus().bgColor }}
                    textStyle={{ color: getLottoStatus().color }}
                  >
                    {getLottoStatus().label}
                  </Chip>
                </View>
                
                {lotto.descrizione && (
                  <Text style={styles.description}>{lotto.descrizione}</Text>
                )}
                
                <Divider style={styles.divider} />
                
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="scale" size={20} color="#666" />
                  <Text style={styles.infoText}>
                    Quantità: <Text style={styles.infoValue}>{lotto.quantita} {lotto.unita_misura}</Text>
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Ionicons name="calendar" size={20} color="#666" />
                  <Text style={styles.infoText}>
                    Scadenza: <Text style={styles.infoValue}>{formatDate(new Date(lotto.data_scadenza))}</Text>
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Ionicons name="person" size={20} color="#666" />
                  <Text style={styles.infoText}>
                    Creato da: <Text style={styles.infoValue}>{lotto.creato_nome || "Utente"}</Text>
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Creato il:</Text>
                  <Text style={styles.infoValue}>
                    {lotto.createdAt ? formatDateTime(safeParseDate(lotto.createdAt)) : 'Data non disponibile'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Ultimo aggiornamento:</Text>
                  <Text style={styles.infoValue}>
                    {lotto.updatedAt ? formatDateTime(safeParseDate(lotto.updatedAt)) : 'Data non disponibile'}
                  </Text>
                </View>

                {/* Pulsante di prenotazione */}
                {canPrenotareLotto && (
                  <TouchableOpacity 
                    onPress={handlePrenotazione} 
                    style={styles.prenotaButtonContainer}
                    activeOpacity={0.8}
                  >
                    <Button 
                      mode="contained" 
                      icon="cart-plus"
                      onPress={handlePrenotazione}
                      style={styles.prenotaButton}
                      contentStyle={{ height: 48 }}
                      labelStyle={styles.prenotaButtonLabel}
                    >
                      Prenota questo lotto
                    </Button>
                  </TouchableOpacity>
                )}
              </Card.Content>
            </Card>
          </>
        ) : (
          // Modalità modifica
          <>
            <Card style={styles.formCard}>
              <Card.Title title="Informazioni Generali" />
              <Card.Content>
                <TextInput
                  label="Nome prodotto"
                  value={nome}
                  onChangeText={(text) => {
                    setNome(text);
                    validateField('nome', text);
                  }}
                  style={styles.input}
                  error={errors.nome}
                  mode="outlined"
                  left={<TextInput.Icon icon="package-variant" />}
                />
                {errors.nome && <HelperText type="error">Il nome è obbligatorio</HelperText>}
                
                <TextInput
                  label="Descrizione"
                  value={descrizione}
                  onChangeText={setDescrizione}
                  style={styles.input}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  left={<TextInput.Icon icon="text" />}
                />
                
                <View style={styles.row}>
                  <TextInput
                    label="Quantità"
                    value={quantita}
                    onChangeText={(text) => {
                      setQuantita(text);
                      validateField('quantita', text);
                    }}
                    keyboardType="numeric"
                    style={[styles.input, styles.flex1]}
                    error={errors.quantita}
                    mode="outlined"
                    left={<TextInput.Icon icon="scale" />}
                  />
                  
                  <Pressable 
                    style={styles.unitSelector}
                    onPress={() => setShowUnitaPicker(true)}
                  >
                    <Surface style={[styles.unitDisplay, {borderColor: theme.colors.outline}]}>
                      <Text style={styles.unitText}>{unitaMisura}</Text>
                      <MaterialCommunityIcons name="chevron-down" size={20} color={theme.colors.primary} />
                    </Surface>
                  </Pressable>
                </View>
                {errors.quantita && <HelperText type="error">Inserisci una quantità valida</HelperText>}
                
                <Pressable 
                  onPress={() => setShowDatePicker(true)}
                  style={({ pressed }) => [
                    styles.dateSelector,
                    { opacity: pressed ? 0.9 : 1 }
                  ]}
                >
                  <Surface style={[styles.dateSurface, errors.dataScadenza && styles.dateError]}>
                    <Ionicons name="calendar" size={24} color={theme.colors.primary} style={styles.dateIcon} />
                    <View style={styles.dateTextContainer}>
                      <Text style={styles.dateLabel}>Data di scadenza</Text>
                      <Text style={styles.dateValue}>{formatDate(dataScadenza)}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} />
                  </Surface>
                </Pressable>
                {errors.dataScadenza && <HelperText type="error">La data di scadenza deve essere futura</HelperText>}
                <Text style={styles.infoText}>
                  È possibile inserire anche date passate per i prodotti già scaduti.
                  I lotti con data di scadenza nel passato saranno automaticamente etichettati come scaduti (rosso).
                </Text>
              </Card.Content>
            </Card>
          </>
        )}
      </ScrollView>
      
      {editMode && (
        <View style={styles.footer}>
          <Button
            mode="outlined"
            onPress={handleCancel}
            style={styles.button}
            contentStyle={styles.buttonContent}
            icon="close"
          >
            Annulla
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={[styles.button, styles.primaryButton]}
            contentStyle={styles.buttonContent}
            icon="content-save"
            loading={saving}
            disabled={saving}
          >
            Salva
          </Button>
        </View>
      )}
      
      {/* Modal per la selezione dell'unità di misura */}
      <Portal>
        <Modal 
          visible={showUnitaPicker} 
          onDismiss={() => setShowUnitaPicker(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleziona unità di misura</Text>
            </View>
            <ScrollView style={styles.modalScroll}>
              {Object.entries(UNITA_MISURA_GROUPS).map(([group, units]) => (
                <React.Fragment key={group}>
                  <Text style={styles.modalGroup}>{group}</Text>
                  {units.map(unit => (
                    <List.Item
                      key={unit}
                      title={UNITA_MISURA_OPTIONS.find(opt => opt.value === unit)?.label || unit}
                      onPress={() => {
                        setUnitaMisura(unit);
                        setShowUnitaPicker(false);
                      }}
                      style={unitaMisura === unit ? styles.selectedItem : undefined}
                      right={() => unitaMisura === unit ? <List.Icon icon="check" /> : null}
                    />
                  ))}
                </React.Fragment>
              ))}
            </ScrollView>
            <View style={styles.modalFooter}>
              <Button onPress={() => setShowUnitaPicker(false)}>Chiudi</Button>
            </View>
          </View>
        </Modal>
      </Portal>
      
      {/* Modal per la selezione della data */}
      <Portal>
        <Modal 
          visible={showDatePicker} 
          onDismiss={() => setShowDatePicker(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleziona data di scadenza</Text>
            </View>
            <View style={styles.datePickerContainer}>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={dataScadenza ? format(dataScadenza, 'yyyy-MM-dd') : ''}
                  onChange={e => {
                    if (e.target.value) {
                      try {
                        const newDate = new Date(e.target.value);
                        if (!isNaN(newDate.getTime())) {
                          setDataScadenza(newDate);
                          validateField('dataScadenza', newDate);
                        } else {
                          console.warn('Data selezionata non valida:', e.target.value);
                        }
                      } catch (err) {
                        console.error('Errore nella conversione della data:', err);
                      }
                    }
                  }}
                  style={styles.webDatePicker}
                />
              ) : (
                <View style={styles.dateButtonsContainer}>
                  <Text style={styles.dateSelectionText}>
                    Data selezionata: {formatDate(dataScadenza || new Date())}
                  </Text>
                  <View style={styles.dateButtonsRow}>
                    <Button 
                      mode="outlined" 
                      icon="arrow-left" 
                      onPress={() => incrementDate(-1)}
                      style={styles.dateButton}
                    >
                      -1 giorno
                    </Button>
                    <Button 
                      mode="outlined" 
                      icon="calendar-today" 
                      onPress={() => {
                        const today = new Date();
                        setDataScadenza(today);
                        validateField('dataScadenza', today);
                      }}
                      style={styles.dateButton}
                    >
                      Oggi
                    </Button>
                    <Button 
                      mode="outlined" 
                      icon="arrow-right" 
                      onPress={() => incrementDate(1)}
                      style={styles.dateButton}
                    >
                      +1 giorno
                    </Button>
                  </View>
                  <View style={styles.dateButtonsRow}>
                    <Button 
                      mode="outlined"
                      onPress={() => incrementDate(7)}
                      style={styles.dateButton}
                    >
                      +1 settimana
                    </Button>
                    <Button 
                      mode="outlined"
                      onPress={() => incrementDate(30)}
                      style={styles.dateButton}
                    >
                      +1 mese
                    </Button>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.modalFooter}>
              <Button onPress={() => setShowDatePicker(false)}>Conferma</Button>
            </View>
          </View>
        </Modal>
      </Portal>
      
      {/* Modal per la prenotazione del lotto */}
      <Portal>
        <Modal 
          visible={prenotazioneModalVisible} 
          onDismiss={() => setPrenotazioneModalVisible(false)}
          contentContainerStyle={styles.prenotazioneModalContainer}
          dismissable={!prenotazioneInCorso}
        >
          <Surface style={styles.prenotazioneModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Prenota lotto</Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.prenotazioneInfo}>
                Stai per prenotare il lotto <Text style={styles.boldText}>{lotto?.nome}</Text>
              </Text>
              
              <Divider style={styles.divider} />
              
              <Text style={styles.prenotazioneLabel}>Data di prelievo prevista:</Text>
              <Pressable 
                onPress={() => setShowDatePicker(true)}
                style={({ pressed }) => [
                  styles.dateSelector,
                  { opacity: pressed ? 0.9 : 1 }
                ]}
              >
                <Surface style={styles.dateSurface}>
                  <Ionicons name="calendar" size={24} color={PRIMARY_COLOR} style={styles.dateIcon} />
                  <View style={styles.dateTextContainer}>
                    <Text style={styles.dateValue}>{formatDate(dataRitiroPrevista)}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#aaa" />
                </Surface>
              </Pressable>
              
              <Text style={styles.prenotazioneLabel}>Note (opzionale):</Text>
              <TextInput
                value={notePrenotazione}
                onChangeText={setNotePrenotazione}
                style={styles.noteInput}
                placeholder="Inserisci eventuali note per la prenotazione"
                multiline
                numberOfLines={3}
                mode="outlined"
              />
            </View>
            <Divider />
            <View style={styles.prenotazioneModalFooter}>
              <Button
                mode="outlined"
                onPress={() => setPrenotazioneModalVisible(false)}
                style={styles.footerButton}
                contentStyle={{height: 48}}
                disabled={prenotazioneInCorso}
              >
                Annulla
              </Button>
              <Button
                mode="contained"
                onPress={confermaPrenotazione}
                style={[styles.footerButton, styles.confirmButton]}
                contentStyle={{height: 48}}
                labelStyle={styles.confirmButtonLabel}
                loading={prenotazioneInCorso}
                disabled={prenotazioneInCorso}
              >
                Conferma
              </Button>
            </View>
          </Surface>
        </Modal>
      </Portal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  } as any,
  loadingContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  } as any,
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  } as any,
  scrollView: {
    flex: 1,
  } as any,
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  } as any,
  card: {
    marginBottom: 16,
    elevation: 2,
  } as any,
  formCard: {
    marginBottom: 16,
    elevation: 2,
  } as any,
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  } as any,
  description: {
    marginBottom: 16,
    fontSize: 14,
    color: '#555',
  } as any,
  divider: {
    marginVertical: 12,
  } as any,
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  } as any,
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  } as any,
  infoValue: {
    fontWeight: 'bold',
    color: '#333',
  } as any,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  } as any,
  flex1: {
    flex: 1,
  } as any,
  input: {
    marginBottom: 12,
  } as any,
  unitSelector: {
    marginLeft: 8,
    marginTop: 4,
    alignSelf: 'flex-end',
    marginBottom: 12,
  } as any,
  unitDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 15,
    borderWidth: 1,
    borderRadius: 4,
    minWidth: 80,
  } as any,
  unitText: {
    marginRight: 4,
    fontSize: 16,
  } as any,
  dateSelector: {
    marginBottom: 8,
  } as any,
  dateSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  } as any,
  dateError: {
    borderColor: '#B00020',
  } as any,
  dateIcon: {
    marginRight: 12,
  } as any,
  dateTextContainer: {
    flex: 1,
  } as any,
  dateLabel: {
    fontSize: 12,
    color: '#666',
  } as any,
  dateValue: {
    fontSize: 16,
  } as any,
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
    elevation: 4,
  } as any,
  button: {
    flex: 1,
    marginHorizontal: 4,
  } as any,
  buttonContent: {
    paddingVertical: 8,
  } as any,
  primaryButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    marginLeft: 8,
  } as any,
  confirmButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    marginLeft: 8,
    height: 50,
  },
  confirmButtonLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    margin: 20,
    borderRadius: 8,
    overflow: 'hidden',
  } as any,
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    maxHeight: '80%',
  } as any,
  modalHeader: {
    padding: 16,
  } as any,
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  } as any,
  modalScroll: {
    maxHeight: 350,
  } as any,
  modalGroup: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#f5f5f5',
  } as any,
  selectedItem: {
    backgroundColor: '#e8f5e9',
  } as any,
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
  } as any,
  datePickerContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  datePicker: {
    width: '100%',
  } as any,
  webDatePicker: {
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: 12,
    fontSize: 16,
    width: '100%',
  } as any,
  selectField: {
    marginVertical: 8,
  },
  selectLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  selectValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  selectPlaceholder: {
    color: '#999',
  },
  errorBorder: {
    borderColor: '#B00020',
  },
  emptyCentriContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  } as any,
  noCentriText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  } as any,
  dateButtonsContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  dateSelectionText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  } as any,
  dateButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as any,
  dateButton: {
    padding: 8,
  } as any,
  prenotaButton: {
    marginTop: 24,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    width: '100%',
    height: 50,
  },
  prenotaButtonContainer: {
    width: '100%',
    marginTop: 16,
  },
  prenotaButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  modalBody: {
    padding: 16,
  },
  prenotazioneInfo: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  boldText: {
    fontWeight: 'bold',
  },
  prenotazioneLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#555',
  },
  noteInput: {
    marginBottom: 16,
  },
  footerButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  prenotazioneModalContainer: {
    margin: 20,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 1000,
  },
  prenotazioneModalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  prenotazioneModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  infoLabel: {
    fontWeight: 'bold',
  },
});

export default DettaglioLottoScreen; 