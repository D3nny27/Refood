import { View, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Button, ActivityIndicator, Text, Badge, IconButton } from 'react-native-paper';
import { useAuth } from '../../src/context/AuthContext';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL, STORAGE_KEYS } from '../../src/config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React from 'react';

export default function TabOneScreen() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notifiche, setNotifiche] = useState<number>(0);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Ottieni il token di autenticazione
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      if (!token) {
        setError('Sessione scaduta. Effettua nuovamente il login.');
        setLoading(false);
        return;
      }
      
      const response = await axios.get(`${API_URL}/statistiche/counters`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setStats(response.data);
      
      // Simuliamo il caricamento delle notifiche (da implementare con API reale)
      // Questo è solo un esempio, dovrà essere sostituito con la vera chiamata API
      setTimeout(() => {
        const notificheCount = Math.floor(Math.random() * 10); // Simulazione: 0-9 notifiche
        setNotifiche(notificheCount);
      }, 1000);
    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Impossibile caricare le statistiche');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };
  
  const handleNotifichePress = () => {
    if (user?.ruolo === 'Amministratore') {
      router.push("/admin/utenti");
    } else {
      Alert.alert(
        'Notifiche',
        `Hai ${notifiche} notifiche non lette`,
        [
          { text: 'Visualizza tutte', onPress: () => console.log('Visualizza tutte le notifiche') },
          { text: 'Chiudi', style: 'cancel' }
        ]
      );
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (!user) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
      }
    >
      <Card style={styles.welcomeCard}>
        <View style={styles.notificationContainer}>
          <Card.Content style={styles.welcomeContent}>
            <Title>Benvenuto, {user.nome}!</Title>
            <Paragraph>Ruolo: {user.ruolo}</Paragraph>
          </Card.Content>
          <View style={styles.notificationIconContainer}>
            <IconButton
              icon="bell"
              size={24}
              onPress={handleNotifichePress}
              style={styles.notificationIcon}
            />
            {notifiche > 0 && (
              <Badge
                style={styles.notificationBadge}
                size={20}
              >
                {notifiche}
              </Badge>
            )}
          </View>
        </View>
      </Card>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : error ? (
        <Card style={styles.errorCard}>
          <Card.Content>
            <Paragraph style={styles.errorText}>{error}</Paragraph>
            <Button mode="contained" onPress={loadStats} style={styles.retryButton}>
              Riprova
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <>
          {/* Contenuto specifico per ogni ruolo */}
          {user.ruolo === 'Operatore' && <OperatoreContent stats={stats} />}
          {user.ruolo === 'Amministratore' && <AmministratoreContent stats={stats} user={user} />}
          {user.ruolo === 'CentroSociale' && <CentroSocialeContent stats={stats} />}
          {user.ruolo === 'CentroRiciclaggio' && <CentroRiciclaggioContent stats={stats} />}

          {/* Statistiche generali */}
          <Card style={styles.statsCard}>
            <Card.Title title="Statistiche del Sistema" />
            <Card.Content>
              {stats && (
                <>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Title>{stats.lotti?.totale || 0}</Title>
                      <Paragraph>Lotti Totali</Paragraph>
                    </View>
                    <View style={styles.statItem}>
                      <Title>{stats.prenotazioni?.totale || 0}</Title>
                      <Paragraph>Prenotazioni</Paragraph>
                    </View>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Title>{stats.utenti?.totale || 0}</Title>
                      <Paragraph>Utenti</Paragraph>
                    </View>
                    <View style={styles.statItem}>
                      <Title>{stats.centri?.totale || 0}</Title>
                      <Paragraph>Centri</Paragraph>
                    </View>
                  </View>
                </>
              )}
            </Card.Content>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

// Componenti specifici per ogni ruolo
const OperatoreContent = ({ stats }: { stats: any }) => (
  <Card style={styles.roleCard}>
    <Card.Title title="Dashboard Operatore" />
    <Card.Content>
      <Paragraph>Da qui puoi gestire i lotti e monitorare le prenotazioni.</Paragraph>
      <View style={styles.statBadges}>
        <View style={[styles.statBadge, styles.greenBadge]}>
          <Text style={styles.statBadgeText}>Verdi: {stats?.lotti?.per_stato?.verde || 0}</Text>
        </View>
        <View style={[styles.statBadge, styles.orangeBadge]}>
          <Text style={styles.statBadgeText}>Arancioni: {stats?.lotti?.per_stato?.arancione || 0}</Text>
        </View>
        <View style={[styles.statBadge, styles.redBadge]}>
          <Text style={styles.statBadgeText}>Rossi: {stats?.lotti?.per_stato?.rosso || 0}</Text>
        </View>
      </View>
      <Button mode="contained" style={styles.actionButton} icon="plus">
        Nuovo Lotto
      </Button>
      <Button mode="outlined" style={styles.actionButton} icon="format-list-bulleted">
        Visualizza Lotti
      </Button>
    </Card.Content>
  </Card>
);

const AmministratoreContent = ({ stats, user }: { stats: any, user: any }) => {
  // Funzione per navigare alla gestione utenti con filtro per utenti creati dall'admin corrente
  const navigateToUserManagement = (filterByCreator: boolean = false) => {
    // Navigazione alla pagina di gestione utenti
    router.push("/admin/utenti");
  };

  // Funzione per navigare allo storico dei lotti - attualmente non implementata
  const navigateToLottiHistory = () => {
    Alert.alert(
      'Funzionalità in arrivo',
      'La visualizzazione dello storico lotti sarà disponibile a breve.',
      [{ text: 'OK', onPress: () => console.log('Funzionalità storico lotti richiesta') }]
    );
  };

  // Funzione per navigare alle notifiche ricevute - attualmente non implementata
  const navigateToNotificheRicevute = () => {
    Alert.alert(
      'Funzionalità in arrivo',
      'La visualizzazione delle notifiche ricevute sarà disponibile a breve.',
      [{ text: 'OK', onPress: () => console.log('Funzionalità notifiche ricevute richiesta') }]
    );
  };

  // Funzione per navigare alle notifiche inviate - attualmente non implementata
  const navigateToNotificheInviate = () => {
    Alert.alert(
      'Funzionalità in arrivo',
      'La visualizzazione delle notifiche inviate sarà disponibile a breve.',
      [{ text: 'OK', onPress: () => console.log('Funzionalità notifiche inviate richiesta') }]
    );
  };

  // Funzione per navigare allo stato delle spedizioni - attualmente non implementata
  const navigateToSpedizioni = () => {
    Alert.alert(
      'Funzionalità in arrivo',
      'La visualizzazione dello stato delle spedizioni sarà disponibile a breve.',
      [{ text: 'OK', onPress: () => console.log('Funzionalità spedizioni richiesta') }]
    );
  };

  // Funzione per navigare alle statistiche dettagliate - attualmente non implementata
  const navigateToStatistiche = () => {
    Alert.alert(
      'Funzionalità in arrivo',
      'La visualizzazione delle statistiche dettagliate sarà disponibile a breve.',
      [{ text: 'OK', onPress: () => console.log('Funzionalità statistiche dettagliate richiesta') }]
    );
  };

  return (
    <Card style={styles.roleCard}>
      <Card.Title title="Dashboard Amministratore" />
      <Card.Content>
        <Paragraph>Panoramica completa del sistema e gestione utenti.</Paragraph>
        
        {/* Prima riga di badge */}
        <View style={styles.statBadges}>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeText}>Operatori: {stats?.utenti?.per_ruolo?.operatori || 0}</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeText}>Centri Sociali: {stats?.utenti?.per_ruolo?.centri_sociali || 0}</Text>
          </View>
        </View>

        {/* Sezione Storico dei lotti e cambi di stato */}
        <Title style={styles.sectionTitle}>Storico Lotti</Title>
        <Button 
          mode="contained" 
          style={styles.actionButton} 
          icon="history"
          onPress={navigateToLottiHistory}
        >
          Cambi di Stato Lotti
        </Button>
        
        {/* Sezione Notifiche */}
        <Title style={styles.sectionTitle}>Notifiche</Title>
        <View style={styles.buttonRow}>
          <Button 
            mode="contained" 
            style={[styles.actionButton, styles.halfButton]} 
            icon="message-text"
            onPress={navigateToNotificheRicevute}
          >
            Ricevute
          </Button>
          <Button 
            mode="contained" 
            style={[styles.actionButton, styles.halfButton]} 
            icon="message-text-outline"
            onPress={navigateToNotificheInviate}
          >
            Inviate
          </Button>
        </View>
        
        {/* Sezione Prenotazioni */}
        <Title style={styles.sectionTitle}>Prenotazioni e Spedizioni</Title>
        <Button 
          mode="contained" 
          style={styles.actionButton} 
          icon="truck-delivery"
          onPress={navigateToSpedizioni}
        >
          Stato Spedizioni
        </Button>

        {/* Utenti creati dall'admin corrente */}
        <Title style={styles.sectionTitle}>I Miei Utenti</Title>
        <Button 
          mode="contained" 
          style={styles.actionButton} 
          icon="account-group"
          onPress={() => navigateToUserManagement(true)}
        >
          Amministratori e Operatori
        </Button>
        
        {/* Statistiche avanzate e gestione utenti */}
        <Title style={styles.sectionTitle}>Gestione Sistema</Title>
        <Button 
          mode="contained" 
          style={styles.actionButton} 
          icon="chart-bar"
          onPress={navigateToStatistiche}
        >
          Statistiche Dettagliate
        </Button>
        <Button 
          mode="outlined" 
          style={styles.actionButton} 
          icon="account-multiple"
          onPress={() => navigateToUserManagement(false)}
        >
          Gestione Utenti
        </Button>
      </Card.Content>
    </Card>
  );
};

const CentroSocialeContent = ({ stats }: { stats: any }) => (
  <Card style={styles.roleCard}>
    <Card.Title title="Centro Sociale" />
    <Card.Content>
      <Paragraph>Visualizza e prenota i lotti disponibili.</Paragraph>
      <Button mode="contained" style={styles.actionButton} icon="shopping">
        Lotti Disponibili
      </Button>
      <Button mode="outlined" style={styles.actionButton} icon="history">
        Le Mie Prenotazioni
      </Button>
    </Card.Content>
  </Card>
);

const CentroRiciclaggioContent = ({ stats }: { stats: any }) => (
  <Card style={styles.roleCard}>
    <Card.Title title="Centro Riciclaggio" />
    <Card.Content>
      <Paragraph>Visualizza i lotti in stato rosso per il riciclaggio.</Paragraph>
      <Button mode="contained" style={styles.actionButton} icon="recycle">
        Lotti Disponibili per Riciclaggio
      </Button>
      <Button mode="outlined" style={styles.actionButton} icon="history">
        Storico Trasformazioni
      </Button>
    </Card.Content>
  </Card>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcomeCard: {
    margin: 16,
    elevation: 4,
  },
  notificationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcomeContent: {
    flex: 1,
  },
  notificationIconContainer: {
    position: 'relative',
    padding: 8,
  },
  notificationIcon: {
    margin: 0,
  },
  notificationBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#F44336',
  },
  statsCard: {
    margin: 16,
    marginTop: 8,
    elevation: 2,
  },
  roleCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 3,
    backgroundColor: '#fff',
  },
  statBadges: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
    flexWrap: 'wrap',
  },
  statBadge: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
    marginBottom: 8,
  },
  greenBadge: {
    backgroundColor: '#4CAF50',
  },
  orangeBadge: {
    backgroundColor: '#FF9800',
  },
  redBadge: {
    backgroundColor: '#F44336',
  },
  statBadgeText: {
    color: 'white',
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  actionButton: {
    marginTop: 8,
  },
  logoutButton: {
    margin: 16,
    marginTop: 8,
    borderColor: '#F44336',
    borderWidth: 1,
  },
  errorCard: {
    margin: 16,
    backgroundColor: '#ffebee',
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
  },
  sectionTitle: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});
