import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Text, Card, Button, IconButton, Appbar, Badge, Divider } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import logger from '../../src/utils/logger';
import Toast from 'react-native-toast-message';
import pushNotificationService from '../../src/services/pushNotificationService';

// Definizione dei tipi
interface Notifica {
  id: number;
  titolo: string;
  messaggio: string;
  tipo: string;
  priorita: string;
  letta: boolean;
  data: string;
  dataCreazione: string;
  dataLettura?: string;
}

// Dati di esempio per le notifiche
const MOCK_NOTIFICATIONS: Notifica[] = [
  {
    id: 1,
    titolo: 'Benvenuto in ReFood',
    messaggio: 'Grazie per aver installato l\'app ReFood per la gestione efficiente delle risorse alimentari.',
    tipo: 'Alert',
    priorita: 'Alta',
    letta: false,
    data: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minuti fa
    dataCreazione: new Date(Date.now() - 1000 * 60 * 5).toISOString()
  },
  {
    id: 2,
    titolo: 'Nuovo lotto disponibile',
    messaggio: 'È disponibile un nuovo lotto di prodotti presso il Centro di Distribuzione Centrale.',
    tipo: 'CambioStato',
    priorita: 'Media',
    letta: true,
    data: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 ore fa
    dataCreazione: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    dataLettura: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  }
];

// Componente per visualizzare una singola notifica
const NotificaCard: React.FC<{notifica: Notifica; onPress: () => void}> = ({ notifica, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <Card style={[styles.card, !notifica.letta && styles.unreadCard]} mode="outlined">
        <Card.Title
          title={notifica.titolo}
          subtitle={`${notifica.tipo} • ${new Date(notifica.data).toLocaleTimeString()}`}
          left={(props) => (
            <View>
              <Ionicons 
                name={notifica.tipo === 'Alert' ? 'alert-circle' : 
                      notifica.tipo === 'CambioStato' ? 'sync' : 'cube'} 
                size={24} 
                color={notifica.priorita === 'Alta' ? '#F44336' : 
                       notifica.priorita === 'Media' ? '#FF9800' : '#2196F3'} 
              />
              {!notifica.letta && <Badge style={styles.badge} />}
            </View>
          )}
        />
        <Card.Content>
          <Text style={styles.messageText}>{notifica.messaggio}</Text>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

/**
 * Versione migliorata con mockup di notifiche statiche,
 * per evitare il ciclo di caricamento infinito in sviluppo.
 */
export default function NotificheTabRedirect() {
  logger.log('Rendering NotificheTabRedirect v3 con mockup di notifiche');
  
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [mockNotifiche, setMockNotifiche] = useState<Notifica[]>(MOCK_NOTIFICATIONS);
  
  useEffect(() => {
    // Simuliamo un breve caricamento anche per i dati statici
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleNotificaPress = (notifica: Notifica) => {
    // Segna come letta localmente
    if (!notifica.letta) {
      setMockNotifiche(prev => 
        prev.map(n => n.id === notifica.id ? {...n, letta: true} : n)
      );
    }
    
    // Mostra messaggio di successo
    Toast.show({
      type: 'success',
      text1: 'Dettaglio notifica',
      text2: `Hai visualizzato: ${notifica.titolo}`,
      visibilityTime: 2000,
    });
  };
  
  const handleMarkAllAsRead = () => {
    setMockNotifiche(prev => prev.map(n => ({...n, letta: true})));
    
    Toast.show({
      type: 'success',
      text1: 'Operazione completata',
      text2: 'Tutte le notifiche sono state segnate come lette',
      visibilityTime: 2000,
    });
  };
  
  const handleTestNotification = async () => {
    await pushNotificationService.sendLocalNotification(
      'Notifica di test',
      'Questa è una notifica di test per verificare il funzionamento del sistema',
      { type: 'test' }
    );
    
    Toast.show({
      type: 'info',
      text1: 'Notifica inviata',
      text2: 'Controlla le notifiche sul tuo dispositivo',
      visibilityTime: 2000,
    });
  };
  
  // Calcoliamo le notifiche non lette
  const nonLette = mockNotifiche.filter(n => !n.letta).length;
  
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Notifiche" />
        {nonLette > 0 && (
          <Appbar.Action 
            icon="check-all" 
            onPress={handleMarkAllAsRead} 
          />
        )}
        <Appbar.Action 
          icon="bell-ring" 
          onPress={handleTestNotification} 
          color="#4CAF50"
        />
      </Appbar.Header>
      
      {isLoading ? (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.text}>Caricamento notifiche...</Text>
        </View>
      ) : mockNotifiche.length > 0 ? (
        <FlatList
          data={mockNotifiche}
          renderItem={({ item }) => (
            <NotificaCard 
              notifica={item} 
              onPress={() => handleNotificaPress(item)}
            />
          )}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.container}>
          <Ionicons name="notifications-outline" size={60} color="#CCCCCC" />
          <Text style={styles.message}>
            Non ci sono notifiche disponibili al momento.
          </Text>
          <Button 
            mode="contained" 
            onPress={handleTestNotification}
            style={styles.testButton}
          >
            Invia notifica di test
          </Button>
          <Text style={styles.devMessage}>
            In modalità sviluppo, questa schermata utilizza dati statici.
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 20,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
  },
  message: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginVertical: 16,
  },
  devMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
  listContainer: {
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  card: {
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    backgroundColor: '#f0f8f0',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#F44336',
  },
  messageText: {
    fontSize: 14,
    color: '#555555',
    marginTop: 8
  },
  testButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
  }
}); 