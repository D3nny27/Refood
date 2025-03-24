import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, router, Redirect } from 'expo-router';
import { Button, Card, Title, Paragraph } from 'react-native-paper';
import notificheService from '../../src/services/notificheService';
import { useAuth } from '../../src/context/AuthContext';
import { PRIMARY_COLOR } from '../../src/config/constants';
import { Ionicons } from '@expo/vector-icons';
import { useNotifiche } from '../../src/context/NotificheContext';
import { Toast } from 'react-native-toast-message/lib/src/Toast';
import logger from '../../src/utils/logger';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

// Funzione per formattare la data
const formatDateTime = (date: string | Date): string => {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, "d MMMM yyyy 'alle' HH:mm", { locale: it });
};

// Prevenire rendering multipli controllando se l'ID è "index"
const preventInvalidIdRender = (id: string) => {
  if (id === 'index') {
    logger.log('ID "index" rilevato nel componente DettaglioNotifica - dovrebbe essere gestito da index.tsx');
    return true;
  }
  return false;
};

/**
 * Component to display the details of a notification
 */
export default function DettaglioNotifica() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [notifica, setNotifica] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { refreshNotifiche } = useNotifiche();

  // Gestione speciale per ID index
  if (id === 'index') {
    logger.log('DettaglioNotifica - parametro index rilevato, mostrando pagina di errore');
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#d32f2f" />
        <Text style={styles.errorText}>Parametro ID non valido: "index"</Text>
        <Button mode="contained" onPress={() => router.replace("/")} style={styles.errorButton}>
          Torna alla dashboard
        </Button>
      </View>
    );
  }

  // Prevenire rendering errato con ID "index"
  useEffect(() => {
    if (!id) {
      logger.warn('DettaglioNotifica: ID non fornito');
      return;
    }
    
    if (preventInvalidIdRender(id)) {
      // Se l'ID è "index", non facciamo nulla qui - il return null sopra gestirà il caso
      return;
    }
    
    // Caricamento sicuro della notifica
    const loadNotifica = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const notificaId = parseInt(id, 10);
        if (isNaN(notificaId)) {
          throw new Error(`ID notifica non valido: ${id}`);
        }
        
        // Carica i dettagli della notifica
        const result = await notificheService.getNotifica(notificaId);
        setNotifica(result.data);
        
        // Segna la notifica come letta se non lo è già
        if (!result.data.letta) {
          await notificheService.segnaComeLetta(notificaId);
          // Aggiorna il contesto delle notifiche
          refreshNotifiche();
        }
      } catch (err: any) {
        logger.error('Errore caricamento notifica:', err);
        setError(err.message || 'Errore durante il caricamento della notifica');
      } finally {
        setLoading(false);
      }
    };
    
    loadNotifica();
  }, [id, refreshNotifiche]);

  const handleGoBack = () => {
    router.back();
  };

  const handleDelete = async () => {
    if (!notifica) return;
    
    try {
      await notificheService.eliminaNotifica(notifica.id);
      Toast.show({
        type: 'success',
        text1: 'Notifica eliminata',
        text2: 'La notifica è stata eliminata con successo',
      });
      refreshNotifiche();
      router.back();
    } catch (err: any) {
      logger.error('Errore eliminazione notifica:', err);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: err.message || 'Errore durante l\'eliminazione della notifica',
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button 
          icon="arrow-left" 
          onPress={handleGoBack}
          labelStyle={{color: 'white'}}
        >
          Indietro
        </Button>
        <Text style={styles.headerTitle}>Dettaglio Notifica</Text>
        <View style={{width: 70}} />
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento in corso...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#d32f2f" />
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={handleGoBack} style={styles.errorButton}>
            Torna alla lista
          </Button>
        </View>
      ) : notifica ? (
        <ScrollView style={styles.scrollContainer}>
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>{notifica.titolo}</Title>
              <Paragraph style={styles.date}>
                {formatDateTime(notifica.dataCreazione)}
              </Paragraph>
              
              <View style={styles.separator} />
              
              <Paragraph style={styles.content}>
                {notifica.messaggio}
              </Paragraph>
              
              {/* Info aggiuntive se disponibili */}
              {notifica.link && (
                <View style={styles.additionalInfo}>
                  <Text style={styles.infoLabel}>Link associato:</Text>
                  <Text style={styles.infoValue}>{notifica.link}</Text>
                </View>
              )}
              
              {notifica.idRiferimento && (
                <View style={styles.additionalInfo}>
                  <Text style={styles.infoLabel}>Riferimento:</Text>
                  <Text style={styles.infoValue}>{notifica.idRiferimento}</Text>
                </View>
              )}
            </Card.Content>
            
            <Card.Actions style={styles.actions}>
              <Button 
                mode="outlined" 
                onPress={handleGoBack} 
                style={styles.backButton}
              >
                Indietro
              </Button>
              
              <Button 
                mode="contained" 
                onPress={handleDelete} 
                buttonColor="#d32f2f"
                style={styles.deleteButton}
              >
                Elimina
              </Button>
            </Card.Actions>
          </Card>
        </ScrollView>
      ) : (
        <View style={styles.errorContainer}>
          <Ionicons name="help-circle" size={48} color="#666" />
          <Text style={styles.errorText}>Nessuna notifica trovata</Text>
          <Button mode="contained" onPress={handleGoBack} style={styles.errorButton}>
            Torna alla lista
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    height: 60,
    backgroundColor: PRIMARY_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  date: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  additionalInfo: {
    marginTop: 8,
  },
  infoLabel: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#555',
  },
  infoValue: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    flex: 1,
    marginLeft: 8,
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
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  errorButton: {
    paddingHorizontal: 24,
  },
}); 