import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Text, Card, Title, Paragraph, Divider, Appbar, Button, Chip, Surface, Portal, Dialog, TextInput } from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { getPrenotazioneById, annullaPrenotazione, segnaComePromtaPerRitiro } from '../../../src/services/prenotazioniService';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import Toast from 'react-native-toast-message';
import { PRIMARY_COLOR, RUOLI } from '../../../src/config/constants';

const DettaglioPrenotazioneScreen = () => {
  const { user } = useAuth();
  // @ts-ignore - Ignoriamo temporaneamente l'errore di tipizzazione
  const params = require('expo-router').useLocalSearchParams();
  const { id } = params;
  
  const [loading, setLoading] = useState(true);
  const [prenotazione, setPrenotazione] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Aggiungo state per gestire i dialoghi
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogAction, setDialogAction] = useState<() => Promise<void>>(() => async () => {});
  const [notePreparazione, setNotePreparazione] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Formattazione della data
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Data non disponibile';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Data non valida';
      }
      return format(date, 'dd/MM/yyyy', { locale: it });
    } catch (err) {
      return 'Errore data';
    }
  };
  
  // Formattazione della data con l'ora
  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'Data non disponibile';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Data non valida';
      }
      return format(date, 'dd/MM/yyyy HH:mm', { locale: it });
    } catch (err) {
      return 'Errore data';
    }
  };
  
  // Ottiene il colore dello stato
  const getStatoColor = (stato: string) => {
    const statoLower = stato.toLowerCase();
    if (statoLower === 'prenotato' || statoLower === 'inattesa') {
      return '#FFA000'; // arancione
    } else if (statoLower === 'confermato') {
      return '#4CAF50'; // verde
    } else if (statoLower === 'intransito') {
      return '#2196F3'; // blu
    } else if (statoLower === 'consegnato') {
      return '#673AB7'; // viola
    } else if (statoLower === 'annullato') {
      return '#F44336'; // rosso
    } else if (statoLower === 'rifiutato') {
      return '#F44336'; // rosso (stesso del annullato per coerenza visiva)
    } else if (statoLower === 'eliminato') {
      return '#9E9E9E'; // grigio
    } else {
      return '#9E9E9E'; // grigio default
    }
  };
  
  // Recupera i dettagli della prenotazione
  useEffect(() => {
    const fetchPrenotazione = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Recupero dettagli prenotazione ${id}...`);
        const data = await getPrenotazioneById(parseInt(id as string, 10));
        
        console.log('Dati prenotazione ricevuti:', JSON.stringify(data));
        setPrenotazione(data);
      } catch (err: any) {
        console.error('Errore nel recupero dei dettagli della prenotazione:', err);
        setError(err.message || 'Errore nel recupero dei dettagli della prenotazione');
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: err.message || 'Impossibile recuperare i dettagli della prenotazione',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchPrenotazione();
  }, [id]);
  
  // Funzione per segnare come pronta per il ritiro
  const handleProntoPerRitiro = () => {
    setDialogTitle('Conferma preparazione');
    setDialogMessage('Sei sicuro di voler segnare questa prenotazione come pronta per il ritiro?');
    setDialogAction(() => async () => {
      try {
        setIsProcessing(true);
        setDialogVisible(false);
        
        const response = await segnaComePromtaPerRitiro(parseInt(id as string, 10), notePreparazione);
        
        Toast.show({
          type: 'success',
          text1: 'Pronta per il ritiro',
          text2: 'La prenotazione è stata segnata come pronta per il ritiro',
        });
        
        // Ricarica i dati della prenotazione
        const updatedData = await getPrenotazioneById(parseInt(id as string, 10));
        setPrenotazione(updatedData);
        
      } catch (error: any) {
        console.error('Errore nel segnare come pronta per il ritiro:', error);
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: error.message || 'Errore nel segnare come pronta per il ritiro',
        });
      } finally {
        setIsProcessing(false);
        setNotePreparazione('');
      }
    });
    setDialogVisible(true);
  };
  
  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Dettaglio Prenotazione" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento dettagli prenotazione...</Text>
        </View>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Errore" />
        </Appbar.Header>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <Button 
            mode="contained" 
            onPress={() => router.back()}
            style={styles.errorButton}
          >
            Torna indietro
          </Button>
        </View>
      </View>
    );
  }
  
  if (!prenotazione) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Prenotazione non trovata" />
        </Appbar.Header>
        <View style={styles.errorContainer}>
          <Ionicons name="search" size={48} color="#9E9E9E" />
          <Text style={styles.notFoundText}>Prenotazione non trovata</Text>
          <Button 
            mode="contained" 
            onPress={() => router.back()}
            style={styles.errorButton}
          >
            Torna indietro
          </Button>
        </View>
      </View>
    );
  }
  
  const statoColor = getStatoColor(prenotazione.stato);
  
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Dettaglio Prenotazione" />
      </Appbar.Header>
      
      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.headerRow}>
              <Title>{prenotazione.prodotto || 'Lotto non disponibile'}</Title>
              <Chip 
                style={{ backgroundColor: `${statoColor}20` }}
                textStyle={{ color: statoColor }}
              >
                {prenotazione.stato}
              </Chip>
            </View>
            
            <Divider style={styles.divider} />
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dettagli del Lotto</Text>
              
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="cube-outline" size={20} color="#666" />
                <Text style={styles.infoText}>
                  Quantità: <Text style={styles.infoValue}>{prenotazione.quantita} {prenotazione.unita_misura}</Text>
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="calendar" size={20} color="#666" />
                <Text style={styles.infoText}>
                  Scadenza: <Text style={styles.infoValue}>{formatDate(prenotazione.data_scadenza)}</Text>
                </Text>
              </View>
              
              {/* Visualizzazione prezzo solo se presente */}
              {prenotazione.prezzo !== undefined && prenotazione.prezzo !== null && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="currency-eur" size={20} color="#666" />
                  <Text style={styles.infoText}>
                    Prezzo: <Text style={styles.infoValue}>{parseFloat(String(prenotazione.prezzo)).toFixed(2)} €</Text>
                  </Text>
                </View>
              )}
              
              {/* Visualizzazione tipo pagamento solo se presente */}
              {prenotazione.tipo_pagamento && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="credit-card" size={20} color="#666" />
                  <Text style={styles.infoText}>
                    Metodo di Pagamento: <Text style={styles.infoValue}>
                      {prenotazione.tipo_pagamento === 'contanti' ? 'Contanti' : 'Bonifico'}
                    </Text>
                  </Text>
                </View>
              )}
            </View>
            
            <Divider style={styles.divider} />
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dettagli della Prenotazione</Text>
              
              <View style={styles.infoRow}>
                <Ionicons name="home-outline" size={20} color="#666" />
                <Text style={styles.infoText}>
                  Da: <Text style={styles.infoValue}>{prenotazione.centro_origine_nome || 'Centro origine sconosciuto'}</Text>
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={20} color="#666" />
                <Text style={styles.infoText}>
                  A: <Text style={styles.infoValue}>{prenotazione.centro_ricevente_nome || 'Centro destinazione sconosciuto'}</Text>
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.infoText}>
                  Data prenotazione: <Text style={styles.infoValue}>{formatDateTime(prenotazione.data_prenotazione)}</Text>
                </Text>
              </View>
              
              {prenotazione.data_ritiro && (
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={20} color="#666" />
                  <Text style={styles.infoText}>
                    Data ritiro prevista: <Text style={styles.infoValue}>{formatDate(prenotazione.data_ritiro)}</Text>
                  </Text>
                </View>
              )}
              
              {prenotazione.data_consegna && (
                <View style={styles.infoRow}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
                  <Text style={styles.infoText}>
                    Data consegna: <Text style={styles.infoValue}>{formatDateTime(prenotazione.data_consegna)}</Text>
                  </Text>
                </View>
              )}
              
              {prenotazione.note && (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Note:</Text>
                  <Surface style={styles.notesSurface}>
                    <Text style={styles.notesText}>{prenotazione.note}</Text>
                  </Surface>
                </View>
              )}
            </View>
            
            {/* Sezione Trasporto, se disponibile */}
            {prenotazione.trasporto && (
              <>
                <Divider style={styles.divider} />
                
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Dettagli del Trasporto</Text>
                  
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="truck-outline" size={20} color="#666" />
                    <Text style={styles.infoText}>
                      Mezzo: <Text style={styles.infoValue}>{prenotazione.trasporto.mezzo || 'Non specificato'}</Text>
                    </Text>
                  </View>
                  
                  {prenotazione.trasporto.autista && (
                    <View style={styles.infoRow}>
                      <Ionicons name="person-outline" size={20} color="#666" />
                      <Text style={styles.infoText}>
                        Autista: <Text style={styles.infoValue}>{prenotazione.trasporto.autista}</Text>
                      </Text>
                    </View>
                  )}
                  
                  {prenotazione.trasporto.telefono_autista && (
                    <View style={styles.infoRow}>
                      <Ionicons name="call-outline" size={20} color="#666" />
                      <Text style={styles.infoText}>
                        Telefono: <Text style={styles.infoValue}>{prenotazione.trasporto.telefono_autista}</Text>
                      </Text>
                    </View>
                  )}
                  
                  {prenotazione.trasporto.distanza_km && (
                    <View style={styles.infoRow}>
                      <MaterialCommunityIcons name="road-variant" size={20} color="#666" />
                      <Text style={styles.infoText}>
                        Distanza: <Text style={styles.infoValue}>{prenotazione.trasporto.distanza_km} km</Text>
                      </Text>
                    </View>
                  )}
                  
                  {prenotazione.trasporto.orario_partenza && (
                    <View style={styles.infoRow}>
                      <Ionicons name="time-outline" size={20} color="#666" />
                      <Text style={styles.infoText}>
                        Partenza: <Text style={styles.infoValue}>{formatDateTime(prenotazione.trasporto.orario_partenza)}</Text>
                      </Text>
                    </View>
                  )}
                  
                  {prenotazione.trasporto.orario_arrivo && (
                    <View style={styles.infoRow}>
                      <Ionicons name="flag-outline" size={20} color="#666" />
                      <Text style={styles.infoText}>
                        Arrivo: <Text style={styles.infoValue}>{formatDateTime(prenotazione.trasporto.orario_arrivo)}</Text>
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Aggiungo il dialog per la conferma */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>{dialogTitle}</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{dialogMessage}</Paragraph>
            {dialogTitle === 'Conferma preparazione' && (
              <TextInput
                label="Note (opzionale)"
                value={notePreparazione}
                onChangeText={setNotePreparazione}
                mode="outlined"
                style={{ marginTop: 16 }}
                placeholder="Aggiungi note sulla preparazione"
                multiline
              />
            )}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setDialogVisible(false)} style={styles.dialogButton}>
              Annulla
            </Button>
            <Button 
              onPress={() => dialogAction()} 
              loading={isProcessing}
              disabled={isProcessing}
              mode="contained" 
              style={styles.dialogButton}
            >
              Conferma
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Aggiungo due pulsanti: uno per "Pronto per ritiro" e uno per "Registra ritiro" */}
      {prenotazione.stato === 'Confermato' && (
        <Button
          mode="contained"
          icon="check-circle"
          style={[styles.actionButton, { bottom: 80 }]}
          onPress={handleProntoPerRitiro}
        >
          Pronto per Ritiro
        </Button>
      )}

      {(prenotazione.stato === 'ProntoPerRitiro' || prenotazione.stato === 'Confermato') && (
        <Button
          mode="contained"
          icon="cart-arrow-down"
          style={styles.actionButton}
          onPress={() => router.push(`/prenotazioni/ritiro/${prenotazione.id}`)}
        >
          Registra Ritiro
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  notFoundText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    marginTop: 10,
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: PRIMARY_COLOR,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#444',
  },
  infoValue: {
    fontWeight: 'bold',
  },
  notesContainer: {
    marginTop: 12,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#444',
  },
  notesSurface: {
    padding: 12,
    borderRadius: 8,
    elevation: 1,
  },
  notesText: {
    fontSize: 14,
    color: '#555',
  },
  actionButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: PRIMARY_COLOR,
    elevation: 4,
  },
  dialogActions: {
    justifyContent: 'flex-end',
    padding: 8,
  },
  dialogButton: {
    marginLeft: 8,
  },
});

export default DettaglioPrenotazioneScreen; 