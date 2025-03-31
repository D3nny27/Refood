import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, Card, Button, TextInput, Appbar, Divider, Surface, Portal, Dialog } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getPrenotazioneById } from '../../../src/services/prenotazioniService';
import registraRitiro from '../../../src/services/registraRitiro';
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
  const [indirizzo, setIndirizzo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  
  // Stato per tracciare se i campi del form sono stati modificati manualmente
  const [campiModificati, setCampiModificati] = useState({
    ritiroDa: false,
    indirizzo: false,
    telefono: false,
    email: false
  });
  
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
  
  // Handler per aggiornare i campi e tenere traccia delle modifiche manuali
  const handleRitiroDaChange = (value: string) => {
    setRitiroDa(value);
    setCampiModificati({...campiModificati, ritiroDa: true});
  };
  
  const handleIndirizzoChange = (value: string) => {
    setIndirizzo(value);
    setCampiModificati({...campiModificati, indirizzo: true});
  };
  
  const handleTelefonoChange = (value: string) => {
    setTelefono(value);
    setCampiModificati({...campiModificati, telefono: true});
  };
  
  const handleEmailChange = (value: string) => {
    setEmail(value);
    setCampiModificati({...campiModificati, email: true});
  };
  
  // Recupero i dettagli della prenotazione all'avvio
  useEffect(() => {
    const fetchPrenotazione = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Recupero dettagli prenotazione ${id} per registrazione ritiro...`);
        const data = await getPrenotazioneById(parseInt(id as string, 10));
        
        // Log dettagliato per debug
        console.log('--------- DATI PRENOTAZIONE COMPLETI ---------');
        console.log(JSON.stringify(data, null, 2));
        console.log('--------- STRUTTURA OGGETTO UTENTE ---------');
        console.log('utente:', data.utente);
        console.log('attore_id:', data.attore_id);
        console.log('--------- STRUTTURA OGGETTO TIPO_UTENTE DELL\'UTENTE ---------');
        console.log('utenteTipoUtente:', data.utenteTipoUtente);
        console.log('--------- STRUTTURA OGGETTO TIPO_UTENTE_ORIGINE ---------');
        console.log('tipo_utente_origine:', data.tipo_utente_origine);
        console.log('tipo_utente_origine_id:', data.tipo_utente_origine_id);
        console.log('--------- STRUTTURA OGGETTO CENTRO_RICEVENTE ---------');
        console.log('centroRicevente:', data.centroRicevente);
        console.log('---------------------------------------------');
        
        // Debug specifico per i dati dell'utente
        if (data.utente) {
          console.log('DEBUG UTENTE:', {
            id: data.utente.id,
            nome: data.utente.nome,
            cognome: data.utente.cognome,
            ruolo: data.utente.ruolo
          });
        }
        
        // Debug specifico per i dati del tipo_utente_origine
        if (data.tipo_utente_origine) {
          console.log('DEBUG TIPO UTENTE ORIGINE:', {
            tipo: data.tipo_utente_origine.tipo,
            nome: data.tipo_utente_origine.nome,
            cognome: data.tipo_utente_origine.cognome
          });
        }
        
        setPrenotazione(data);
        
        // Verifica che lo stato sia valido per il ritiro
        if (data.stato !== 'ProntoPerRitiro' && data.stato !== 'Confermato') {
          setError(`Questa prenotazione è in stato "${data.stato}" e non può essere ritirata. Solo prenotazioni "Pronte per il ritiro" o "Confermate" possono essere ritirate.`);
        } else {
          // Precompilazione dei campi con i dati dell'utente che ha fatto la prenotazione
          // Prioritizzare l'utente collegato alla prenotazione
          if (data.utente) {
            const utente = data.utente;
            console.log(`Precompilazione con dati utente: ${utente.nome} ${utente.cognome || ''}`);
            
            // Per il nome, usiamo nome + cognome per privati, solo nome per altri tipi
            setRitiroDa(utente.ruolo === 'Privato' 
              ? `${utente.nome || ''} ${utente.cognome || ''}`.trim() 
              : utente.nome || '');
            
            // Utilizziamo i dati del tipo_utente dell'utente se disponibili
            if (data.utenteTipoUtente) {
              console.log(`Utilizzando dati completi tipo_utente dell'utente: ${JSON.stringify(data.utenteTipoUtente)}`);
              setIndirizzo(data.utenteTipoUtente.indirizzo || '');
              setTelefono(data.utenteTipoUtente.telefono || '');
              // Preferiamo l'email dell'utente, fallback sull'email del tipo_utente
              setEmail(utente.email || data.utenteTipoUtente.email || '');
            } else if (data.tipo_utente_origine) {
              // Fallback ai dati del tipo_utente_origine
              setIndirizzo(data.tipo_utente_origine.indirizzo || '');
              setTelefono(data.tipo_utente_origine.telefono || '');
              setEmail(utente.email || data.tipo_utente_origine.email || '');
            } else {
              setIndirizzo('');
              setTelefono('');
              setEmail(utente.email || '');
            }
          } else if (data.tipo_utente_origine) {
            const tipoUtente = data.tipo_utente_origine;
            console.log(`Precompilazione con dati tipo_utente_origine: ${tipoUtente.tipo}`);
            // Non mostrare "Privato" ma il nome effettivo se disponibile
            setRitiroDa(tipoUtente.nome || tipoUtente.tipo || '');
            setIndirizzo(tipoUtente.indirizzo || '');
            setTelefono(tipoUtente.telefono || '');
            setEmail(tipoUtente.email || '');
          } else if (data.centroRicevente) {
            // Fallback ai dati del centro ricevente
            const nomeRicevente = data.centroRicevente.nome || '';
            console.log(`Precompilazione con dati centro ricevente: ${nomeRicevente}`);
            setRitiroDa(nomeRicevente);
            setIndirizzo(data.centroRicevente.indirizzo || '');
            setTelefono(data.centroRicevente.telefono || '');
            setEmail(data.centroRicevente.email || '');
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
    // La validazione è opzionale poiché tutti i campi sono ora opzionali
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
        noteRitiro,
        indirizzo,
        telefono,
        email
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
            
            {/* Informazioni su chi ha prenotato - verifica tipo_utente_origine */}
            <Surface style={[styles.prenotazioneInfo, { marginTop: 12 }]}>
              <Text style={styles.infoTitle}>Prenotato da:</Text>
              
              {/* Mostra le informazioni dell'utente che ha effettuato la prenotazione */}
              {prenotazione?.utente ? (
                <>
                  <Text style={styles.infoText}>
                    <Text style={styles.infoBold}>
                      {(prenotazione.utente.cognome && (prenotazione.utente.ruolo === 'Privato' || prenotazione.utente.ruolo === 'Utente'))
                        ? `${prenotazione.utente.nome || ''} ${prenotazione.utente.cognome || ''}`.trim()
                        : prenotazione.utente.nome || ''}
                    </Text>
                    {prenotazione.utente.ruolo && (
                      <Text style={styles.infoRole}> ({prenotazione.utente.ruolo})</Text>
                    )}
                  </Text>
                  {prenotazione.utente.email && (
                    <Text style={styles.infoText}>
                      Email: <Text style={styles.infoBold}>{prenotazione.utente.email}</Text>
                    </Text>
                  )}
                </>
              ) : prenotazione?.tipo_utente_origine ? (
                <>
                  <Text style={styles.infoText}>
                    <Text style={styles.infoBold}>
                      {(prenotazione.tipo_utente_origine.cognome && prenotazione.tipo_utente_origine.tipo === 'Privato')
                        ? `${prenotazione.tipo_utente_origine.nome || ''} ${prenotazione.tipo_utente_origine.cognome || ''}`.trim()
                        : (prenotazione.tipo_utente_origine.nome || prenotazione.tipo_utente_origine.tipo || '')}
                    </Text>
                  </Text>
                  {prenotazione.tipo_utente_origine.email && (
                    <Text style={styles.infoText}>
                      Email: <Text style={styles.infoBold}>{prenotazione.tipo_utente_origine.email}</Text>
                    </Text>
                  )}
                  {prenotazione.tipo_utente_origine.telefono && (
                    <Text style={styles.infoText}>
                      Telefono: <Text style={styles.infoBold}>{prenotazione.tipo_utente_origine.telefono}</Text>
                    </Text>
                  )}
                  {prenotazione.tipo_utente_origine.indirizzo && (
                    <Text style={styles.infoText}>
                      Indirizzo: <Text style={styles.infoBold}>{prenotazione.tipo_utente_origine.indirizzo}</Text>
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Informazioni non disponibili</Text>
                </Text>
              )}
            </Surface>
            
            {/* Informazioni su chi ritira il lotto */}
            <Surface style={[styles.prenotazioneInfo, { marginTop: 12 }]}>
              <Text style={styles.infoTitle}>Ritirato da:</Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>{ritiroDa || 'Da specificare'}</Text>
              </Text>
              <Text style={styles.infoText}>
                Indirizzo: <Text style={styles.infoBold}>{indirizzo || 'Non specificato'}</Text>
              </Text>
              <Text style={styles.infoText}>
                Telefono: <Text style={styles.infoBold}>{telefono || 'Non specificato'}</Text>
              </Text>
              <Text style={styles.infoText}>
                Email: <Text style={styles.infoBold}>{email || 'Non specificato'}</Text>
              </Text>
              <Text style={styles.infoNote}>
                Puoi modificare questi dati usando il form qui sotto
              </Text>
            </Surface>
            
            <Divider style={styles.divider} />
            
            {/* Form per la registrazione del ritiro */}
            <Text style={styles.formTitle}>Modifica dati di chi ritira</Text>
            
            <TextInput
              label="Nome di chi ritira"
              value={ritiroDa}
              onChangeText={handleRitiroDaChange}
              mode="outlined"
              style={styles.input}
              placeholder="Inserisci il nome completo"
              autoCapitalize="words"
              autoCorrect={false}
              disabled={false} // Questo campo può essere modificato
            />
            
            <TextInput
              label="Indirizzo"
              value={indirizzo}
              onChangeText={handleIndirizzoChange}
              mode="outlined"
              style={styles.input}
              placeholder="Inserisci l'indirizzo"
              autoCapitalize="words"
              autoCorrect={false}
              disabled={false} // Questo campo può essere modificato
            />
            
            <TextInput
              label="Telefono"
              value={telefono}
              onChangeText={handleTelefonoChange}
              mode="outlined"
              style={styles.input}
              placeholder="Inserisci il numero di telefono"
              keyboardType="phone-pad"
              autoCorrect={false}
              disabled={false} // Questo campo può essere modificato
            />
            
            <TextInput
              label="Email"
              value={email}
              onChangeText={handleEmailChange}
              mode="outlined"
              style={styles.input}
              placeholder="Inserisci l'email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              disabled={false} // Questo campo può essere modificato
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
            
            <Button
              mode="contained"
              onPress={handleSubmit}
              style={styles.submitButton}
              loading={sending}
              disabled={sending}
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
            {indirizzo && (
              <>
                <Text style={styles.dialogLabel}>Indirizzo:</Text>
                <Text style={styles.dialogText}>{indirizzo}</Text>
              </>
            )}
            {telefono && (
              <>
                <Text style={styles.dialogLabel}>Telefono:</Text>
                <Text style={styles.dialogText}>{telefono}</Text>
              </>
            )}
            {email && (
              <>
                <Text style={styles.dialogLabel}>Email:</Text>
                <Text style={styles.dialogText}>{email}</Text>
              </>
            )}
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
  infoRole: {
    fontStyle: 'italic',
    color: '#666'
  },
});

export default RegistraRitiroScreen; 