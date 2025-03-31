import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, Card, Button, TextInput, Appbar, Divider, Surface, Portal, Dialog } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getPrenotazioneById, registraRitiro } from '../../../src/services/prenotazioniService';
import { useAuth } from '../../../src/context/AuthContext';
import { PRIMARY_COLOR } from '../../../src/config/constants';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const RegistraRitiroScreen = () => {
  const { user } = useAuth();
  // @ts-ignore - Ignoriamo temporaneamente l'errore di tipizzazione
  const params = require('expo-router').useLocalSearchParams();
  const { id } = params;
  
  // Stati per la gestione dei dati
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [prenotazione, setPrenotazione] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Stati per i campi del form
  const [ritiroDa, setRitiroDa] = useState('');
  const [documentoRitiro, setDocumentoRitiro] = useState('');
  const [noteRitiro, setNoteRitiro] = useState('');
  
  // Stati per il dialog di conferma
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  
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
  
  // Recupero i dettagli della prenotazione all'avvio
  useEffect(() => {
    const fetchPrenotazione = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Recupero dettagli prenotazione ${id} per registrazione ritiro...`);
        const data = await getPrenotazioneById(parseInt(id as string, 10));
        
        setPrenotazione(data);
        
        // Verifica che lo stato sia valido per il ritiro
        if (data.stato !== 'ProntoPerRitiro' && data.stato !== 'Confermato') {
          setError(`Questa prenotazione è in stato "${data.stato}" e non può essere ritirata. Solo prenotazioni "Pronte per il ritiro" o "Confermate" possono essere ritirate.`);
        } else {
          // Precompilazione dei campi con i dati dell'utente che ha fatto la prenotazione
          if (data.utente) {
            // Se abbiamo i dati dell'utente che ha fatto la prenotazione, li usiamo
            console.log(`Precompilazione nome con dati utente: ${data.utente.nome} ${data.utente.cognome}`);
            setRitiroDa(`${data.utente.nome} ${data.utente.cognome}`.trim());
          } else if (data.centro_ricevente_nome) {
            // Altrimenti usiamo il nome del centro ricevente
            console.log(`Precompilazione nome con centro ricevente: ${data.centro_ricevente_nome}`);
            setRitiroDa(data.centro_ricevente_nome);
          }
        }
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
  
  // Validazione del form
  const validateForm = () => {
    if (!ritiroDa.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Il nome di chi ritira è obbligatorio',
      });
      return false;
    }
    
    return true;
  };
  
  // Apertura del dialog di conferma
  const handleSubmit = () => {
    if (validateForm()) {
      setConfirmDialogVisible(true);
    }
  };
  
  // Registrazione effettiva del ritiro
  const confirmRegistraRitiro = async () => {
    if (!validateForm()) return;
    
    try {
      setSending(true);
      setConfirmDialogVisible(false);
      
      const response = await registraRitiro(
        parseInt(id as string, 10),
        ritiroDa,
        documentoRitiro,
        noteRitiro
      );
      
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Ritiro registrato',
          text2: 'Il ritiro è stato registrato con successo',
        });
        
        // Torna alla pagina dei dettagli della prenotazione
        router.push(`/prenotazioni/dettaglio/${id}`);
      } else {
        throw new Error(response.message || 'Errore durante la registrazione del ritiro');
      }
    } catch (error: any) {
      console.error('Errore durante la registrazione del ritiro:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: error.message || 'Si è verificato un errore durante la registrazione del ritiro',
      });
    } finally {
      setSending(false);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Registrazione Ritiro" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento dati della prenotazione...</Text>
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
  
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Registrazione Ritiro" />
      </Appbar.Header>
      
      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.title}>Registra il ritiro del lotto</Text>
            
            {/* Dettagli della prenotazione */}
            <Surface style={styles.prenotazioneInfo}>
              <Text style={styles.infoTitle}>Dettagli del lotto:</Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>{prenotazione?.prodotto || 'Lotto non disponibile'}</Text>
              </Text>
              <Text style={styles.infoText}>
                Quantità: <Text style={styles.infoBold}>{prenotazione?.quantita} {prenotazione?.unita_misura}</Text>
              </Text>
              {prenotazione?.data_scadenza && (
                <Text style={styles.infoText}>
                  Scadenza: <Text style={styles.infoBold}>{formatDate(prenotazione.data_scadenza)}</Text>
                </Text>
              )}
              {prenotazione?.prezzo !== undefined && prenotazione?.prezzo !== null && (
                <Text style={styles.infoText}>
                  Prezzo: <Text style={styles.infoBold}>{parseFloat(String(prenotazione.prezzo)).toFixed(2)} €</Text>
                </Text>
              )}
            </Surface>
            
            {/* Informazioni su chi ha prenotato */}
            {prenotazione?.utente && (
              <Surface style={[styles.prenotazioneInfo, { marginTop: 12 }]}>
                <Text style={styles.infoTitle}>Prenotato da:</Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>{prenotazione.utente.nome} {prenotazione.utente.cognome}</Text>
                </Text>
                {prenotazione.utente.email && (
                  <Text style={styles.infoText}>
                    Email: <Text style={styles.infoBold}>{prenotazione.utente.email}</Text>
                  </Text>
                )}
                <Text style={styles.infoNote}>
                  I dati del prenotante sono stati utilizzati per precompilare il campo "Nome e cognome di chi ritira"
                </Text>
              </Surface>
            )}
            
            <Divider style={styles.divider} />
            
            {/* Form per la registrazione del ritiro */}
            <Text style={styles.formTitle}>Dati di chi ritira</Text>
            
            <TextInput
              label="Nome e cognome di chi ritira *"
              value={ritiroDa}
              onChangeText={setRitiroDa}
              mode="outlined"
              style={styles.input}
              placeholder="Inserisci il nome completo"
              autoCapitalize="words"
              autoCorrect={false}
            />
            
            <TextInput
              label="Documento (opzionale)"
              value={documentoRitiro}
              onChangeText={setDocumentoRitiro}
              mode="outlined"
              style={styles.input}
              placeholder="Tipo e numero documento"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            
            <TextInput
              label="Note aggiuntive (opzionale)"
              value={noteRitiro}
              onChangeText={setNoteRitiro}
              mode="outlined"
              style={styles.input}
              placeholder="Eventuali note sul ritiro"
              multiline
              numberOfLines={3}
            />
            
            <Text style={styles.requiredText}>* Campo obbligatorio</Text>
            
            <Button
              mode="contained"
              onPress={handleSubmit}
              style={styles.submitButton}
              loading={sending}
              disabled={sending || !ritiroDa.trim()}
              icon="check-circle"
            >
              Conferma Ritiro
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => router.back()}
              style={styles.cancelButton}
              disabled={sending}
            >
              Annulla
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
      
      {/* Dialog di conferma */}
      <Portal>
        <Dialog visible={confirmDialogVisible} onDismiss={() => setConfirmDialogVisible(false)}>
          <Dialog.Title>Conferma ritiro</Dialog.Title>
          <Dialog.Content>
            <Text>Stai registrando il ritiro del lotto da parte di:</Text>
            <Text style={styles.dialogHighlight}>{ritiroDa}</Text>
            {documentoRitiro.trim() && (
              <>
                <Text style={styles.dialogLabel}>Documento:</Text>
                <Text style={styles.dialogText}>{documentoRitiro}</Text>
              </>
            )}
            {noteRitiro.trim() && (
              <>
                <Text style={styles.dialogLabel}>Note:</Text>
                <Text style={styles.dialogText}>{noteRitiro}</Text>
              </>
            )}
            <Text style={styles.dialogWarning}>Questa operazione non può essere annullata.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDialogVisible(false)} disabled={sending}>Annulla</Button>
            <Button 
              mode="contained" 
              onPress={confirmRegistraRitiro} 
              loading={sending}
              disabled={sending}
            >
              Conferma
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  card: {
    margin: 16,
    borderRadius: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: PRIMARY_COLOR,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  errorButton: {
    marginTop: 16,
  },
  prenotazioneInfo: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#444',
  },
  infoBold: {
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  requiredText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  submitButton: {
    marginBottom: 12,
    paddingVertical: 6,
    backgroundColor: PRIMARY_COLOR,
  },
  cancelButton: {
    marginBottom: 8,
  },
  dialogHighlight: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 8,
    color: PRIMARY_COLOR,
  },
  dialogLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    color: '#555',
  },
  dialogText: {
    fontSize: 14,
    marginVertical: 4,
  },
  dialogWarning: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 16,
    fontStyle: 'italic',
  },
  infoNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
});

export default RegistraRitiroScreen; 