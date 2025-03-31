import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity, Linking, Platform } from 'react-native';
import { Card, Title, Paragraph, Button, ActivityIndicator, Text, Badge, IconButton, Chip, Avatar, useTheme } from 'react-native-paper';
import { useAuth } from '../../src/context/AuthContext';
import { PRIMARY_COLOR, RUOLI, STORAGE_KEYS, API_URL } from '../../src/config/constants';
import { router } from 'expo-router';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import notificheService from '../../src/services/notificheService';
import { useNotifiche } from '../../src/context/NotificheContext';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabOneScreen() {
  const { user, logout } = useAuth();
  const { nonLette } = useNotifiche(); // Utilizziamo il conteggio dal contesto delle notifiche
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

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
      
      // Utilizza un parametro per richiedere statistiche dettagliate
      const response = await axios.get(`${API_URL}/statistiche/counters?detailed=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Statistiche ricevute:', response.data);
      
      setStats(response.data);
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
    // Vai sempre alla schermata delle notifiche, indipendentemente dal ruolo dell'utente
    console.log('Navigazione alle notifiche via campanellino');
    
    // Forza la navigazione alla schermata notifiche
    try {
      // Prima prova a navigare direttamente
      router.push('/notifiche/');
      
      // Se per qualche motivo fallisce, prova un altro percorso
      setTimeout(() => {
        router.navigate('/(tabs)/notifiche');
      }, 100);
    } catch (error) {
      console.error('Errore nella navigazione alle notifiche:', error);
      // Ultimo tentativo
      router.navigate('/(tabs)/notifiche');
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
      {/* Card di benvenuto con stile migliorato */}
      <Card style={styles.welcomeCard}>
        <View style={styles.notificationContainer}>
          <Card.Content style={styles.welcomeContent}>
            <View style={styles.welcomeHeader}>
              <Avatar.Icon 
                size={50} 
                icon="account" 
                style={styles.avatar} 
                color="#fff" 
              />
              <View style={styles.welcomeTextContainer}>
                <Title style={styles.welcomeTitle}>Benvenuto, {user.nome}!</Title>
                <Text style={styles.welcomeSubtitle}>{user.ruolo} ReFood</Text>
              </View>
            </View>
          </Card.Content>
          <View style={styles.notificationIconContainer}>
            <IconButton
              icon="bell"
              size={28}
              onPress={handleNotifichePress}
              style={styles.notificationIcon}
            />
            {nonLette > 0 && (
              <Badge
                style={styles.notificationBadge}
                size={22}
              >
                {nonLette}
              </Badge>
            )}
          </View>
        </View>
      </Card>

      {/* Aggiunta riepilogo attività con refresh icon */}
      {!loading && !error && (
        <Card style={styles.highlightCard}>
          <View style={styles.cardHeader}>
            <Card.Title 
              title="Riepilogo del giorno" 
              left={(props) => <MaterialCommunityIcons name="chart-timeline-variant" size={30} color={theme.colors.primary} />}
            />
            <IconButton
              icon="refresh"
              size={20}
              onPress={onRefresh}
              style={styles.refreshButton}
            />
          </View>
          <Card.Content>
            <View style={styles.highlightStats}>
              <View style={styles.highlightItem}>
                <MaterialCommunityIcons name="food-apple" size={24} color="#4CAF50" />
                <Text style={styles.highlightNumber}>{stats?.lotti?.attivi || 0}</Text>
                <Text style={styles.highlightLabel}>Lotti attivi</Text>
              </View>
              <View style={styles.highlightItem}>
                <MaterialCommunityIcons name="truck-delivery" size={24} color="#FF9800" />
                <Text style={styles.highlightNumber}>{stats?.prenotazioni?.attive || 0}</Text>
                <Text style={styles.highlightLabel}>Prenotazioni</Text>
              </View>
              <View style={styles.highlightItem}>
                <MaterialCommunityIcons name="alert-circle" size={24} color="#F44336" />
                <Text style={styles.highlightNumber}>{stats?.lotti?.in_scadenza || 0}</Text>
                <Text style={styles.highlightLabel}>In scadenza</Text>
              </View>
            </View>
            
            {/* Nuova sezione per le attività del giorno */}
            <View style={styles.todayActivities}>
              <Text style={styles.todayActivitiesTitle}>Attività oggi</Text>
              <View style={styles.todayActivitiesContainer}>
                <View style={styles.todayActivityItem}>
                  <View style={styles.todayActivityIconContainer}>
                    <MaterialCommunityIcons name="basket-plus" size={18} color="#fff" />
                  </View>
                  <Text style={styles.todayActivityValue}>{stats?.attivita?.lotti_inseriti_oggi || 0}</Text>
                  <Text style={styles.todayActivityLabel}>Lotti inseriti</Text>
                </View>
                <View style={styles.todayActivityItem}>
                  <View style={[styles.todayActivityIconContainer, { backgroundColor: '#2196F3' }]}>
                    <MaterialCommunityIcons name="calendar-plus" size={18} color="#fff" />
                  </View>
                  <Text style={styles.todayActivityValue}>{stats?.attivita?.prenotazioni_oggi || 0}</Text>
                  <Text style={styles.todayActivityLabel}>Prenotazioni</Text>
                </View>
                <View style={styles.todayActivityItem}>
                  <View style={[styles.todayActivityIconContainer, { backgroundColor: '#FF9800' }]}>
                    <MaterialCommunityIcons name="autorenew" size={18} color="#fff" />
                  </View>
                  <Text style={styles.todayActivityValue}>{stats?.attivita?.cambi_stato || 0}</Text>
                  <Text style={styles.todayActivityLabel}>Cambi stato</Text>
                </View>
              </View>
              <View style={styles.lastUpdateContainer}>
                <Text style={styles.lastUpdateText}>
                  Ultimo aggiornamento: {new Date().toLocaleTimeString()}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

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

          {/* Statistiche dettagliate sui lotti - visibili a tutti */}
          <Card style={styles.detailCard}>
            <Card.Title 
              title="Analisi dei Lotti" 
              left={(props) => <MaterialCommunityIcons name="chart-pie" size={30} color={theme.colors.primary} />}
            />
            <Card.Content>
              <View style={styles.lottiGraph}>
                <View style={styles.graphLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
                    <Text>Verdi: {stats?.lotti?.per_stato?.verde || 0}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
                    <Text>Arancioni: {stats?.lotti?.per_stato?.arancione || 0}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
                    <Text>Rossi: {stats?.lotti?.per_stato?.rosso || 0}</Text>
                  </View>
                </View>
                <View style={styles.graphBars}>
                  <View style={styles.graphBarContainer}>
                    <View 
                      style={[
                        styles.graphBar, 
                        styles.greenBar,
                        { 
                          height: `${Math.min(100, Math.max(10, (stats?.lotti?.per_stato?.verde || 0) * 5))}%` 
                        }
                      ]} 
                    />
                    <Text style={styles.graphLabel}>Verdi</Text>
                  </View>
                  <View style={styles.graphBarContainer}>
                    <View 
                      style={[
                        styles.graphBar, 
                        styles.orangeBar,
                        { 
                          height: `${Math.min(100, Math.max(10, (stats?.lotti?.per_stato?.arancione || 0) * 5))}%` 
                        }
                      ]} 
                    />
                    <Text style={styles.graphLabel}>Arancio</Text>
                  </View>
                  <View style={styles.graphBarContainer}>
                    <View 
                      style={[
                        styles.graphBar, 
                        styles.redBar,
                        { 
                          height: `${Math.min(100, Math.max(10, (stats?.lotti?.per_stato?.rosso || 0) * 5))}%` 
                        }
                      ]} 
                    />
                    <Text style={styles.graphLabel}>Rossi</Text>
                  </View>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Modifiche alla card delle prenotazioni per migliorare la visualizzazione */}
          <Card style={styles.detailCard}>
            <View style={styles.cardHeader}>
              <Card.Title 
                title="Stato Prenotazioni" 
                left={(props) => <MaterialCommunityIcons name="clipboard-check" size={30} color={theme.colors.primary} />}
              />
              <IconButton
                icon="refresh"
                size={20}
                onPress={onRefresh}
                style={styles.refreshButton}
              />
            </View>
            <Card.Content>
              <View style={styles.prenotazioniStats}>
                <View style={styles.prenotazioneItem}>
                  <View style={[styles.prenotazioneIcon, { backgroundColor: '#2196F3' }]}>
                    <MaterialCommunityIcons name="clock-outline" size={20} color="#fff" />
                  </View>
                  <Text style={styles.prenotazioneNumber}>{stats?.prenotazioni?.prenotate || 0}</Text>
                  <Text style={styles.prenotazioneLabel}>In attesa</Text>
                </View>
                <View style={styles.prenotazioneItem}>
                  <View style={[styles.prenotazioneIcon, { backgroundColor: '#4CAF50' }]}>
                    <MaterialCommunityIcons name="check-circle-outline" size={20} color="#fff" />
                  </View>
                  <Text style={styles.prenotazioneNumber}>{stats?.prenotazioni?.confermate || 0}</Text>
                  <Text style={styles.prenotazioneLabel}>Confermate</Text>
                </View>
                <View style={styles.prenotazioneItem}>
                  <View style={[styles.prenotazioneIcon, { backgroundColor: '#FF9800' }]}>
                    <MaterialCommunityIcons name="truck-delivery" size={20} color="#fff" />
                  </View>
                  <Text style={styles.prenotazioneNumber}>{stats?.prenotazioni?.pronte_per_ritiro || 0}</Text>
                  <Text style={styles.prenotazioneLabel}>Pronte per ritiro</Text>
                </View>
                <View style={styles.prenotazioneItem}>
                  <View style={[styles.prenotazioneIcon, { backgroundColor: '#673AB7' }]}>
                    <MaterialCommunityIcons name="package-variant-closed" size={20} color="#fff" />
                  </View>
                  <Text style={styles.prenotazioneNumber}>{stats?.prenotazioni?.consegnate || 0}</Text>
                  <Text style={styles.prenotazioneLabel}>Consegnate</Text>
                </View>
              </View>
              
              {/* Aggiunta grafico delle prenotazioni per stato */}
              <View style={styles.prenotazioniProgress}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressSegment, 
                      { 
                        backgroundColor: '#2196F3',
                        flex: Math.max(0.1, (stats?.prenotazioni?.prenotate || 0) / (stats?.prenotazioni?.totale || 1))
                      }
                    ]} 
                  />
                  <View 
                    style={[
                      styles.progressSegment, 
                      { 
                        backgroundColor: '#4CAF50',
                        flex: Math.max(0.1, (stats?.prenotazioni?.confermate || 0) / (stats?.prenotazioni?.totale || 1))
                      }
                    ]} 
                  />
                  <View 
                    style={[
                      styles.progressSegment, 
                      { 
                        backgroundColor: '#FF9800',
                        flex: Math.max(0.1, (stats?.prenotazioni?.pronte_per_ritiro || 0) / (stats?.prenotazioni?.totale || 1))
                      }
                    ]} 
                  />
                  <View 
                    style={[
                      styles.progressSegment, 
                      { 
                        backgroundColor: '#673AB7',
                        flex: Math.max(0.1, (stats?.prenotazioni?.consegnate || 0) / (stats?.prenotazioni?.totale || 1))
                      }
                    ]} 
                  />
                </View>
                <View style={styles.prenotazioniSummary}>
                  <Text style={styles.prenotazioniTotal}>
                    Totale: <Text style={styles.prenotazioniTotalNumber}>{stats?.prenotazioni?.totale || 0}</Text> prenotazioni
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Impatto ambientale - solo per l'amministratore */}
          {user.ruolo === 'Amministratore' && (
            <Card style={[styles.impactCard, { marginTop: 8 }]}>
              <Card.Title 
                title="Impatto Ambientale Totale" 
                left={(props) => <MaterialCommunityIcons name="leaf" size={30} color="#4CAF50" />}
              />
              <Card.Content>
                <View style={styles.impactContainer}>
                  <View style={styles.impactItem}>
                    <MaterialCommunityIcons name="weight" size={30} color="#4CAF50" />
                    <Text style={styles.impactNumber}>{stats?.impatto?.kg_cibo_salvato || 0} kg</Text>
                    <Text style={styles.impactLabel}>Cibo salvato</Text>
                  </View>
                  <View style={styles.impactItem}>
                    <MaterialCommunityIcons name="molecule-co2" size={30} color="#4CAF50" />
                    <Text style={styles.impactNumber}>{stats?.impatto?.kg_co2_risparmiata || 0} kg</Text>
                    <Text style={styles.impactLabel}>CO₂ risparmiata</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

// Componenti specifici per ogni ruolo
const OperatoreContent = ({ stats }: { stats: any }) => (
  <Card style={styles.roleCard}>
    <Card.Title 
      title="I Tuoi Lotti" 
      left={(props) => <MaterialCommunityIcons name="basket" size={30} color="#4CAF50" />}
    />
    <Card.Content>
      <View style={styles.operatoreStats}>
        <View style={styles.operatoreIcon}>
          <MaterialCommunityIcons name="basket-plus" size={48} color="#4CAF50" />
        </View>
        <View style={styles.operatoreInfo}>
          <Text style={styles.operatoreInfoText}>
            Hai inserito <Text style={styles.operatoreHighlight}>{stats?.operatore?.lotti_inseriti || 0}</Text> lotti
          </Text>
          <Text style={styles.operatoreInfoText}>
            Di cui <Text style={styles.operatoreHighlight}>{stats?.operatore?.lotti_attivi || 0}</Text> ancora attivi
          </Text>
          <View style={styles.operatoreActions}>
            <Button 
              mode="contained" 
              icon="plus" 
              onPress={() => router.push('/lotti/nuovo')}
              style={styles.operatoreButton}
            >
              Nuovo Lotto
            </Button>
            <Button 
              mode="outlined" 
              icon="view-list" 
              onPress={() => router.push('/(tabs)/lotti')}
              style={styles.operatoreButton}
            >
              Gestisci
            </Button>
          </View>
        </View>
      </View>
      
      {/* Statistiche personali dell'operatore */}
      <View style={styles.personaleStats}>
        <Text style={styles.personaleTitle}>Il tuo contributo</Text>
        <View style={styles.personaleRow}>
          <View style={styles.personaleItem}>
            <MaterialCommunityIcons name="calendar-check" size={24} color="#4CAF50" />
            <Text style={styles.personaleValue}>{stats?.operatore?.lotti_della_settimana || 0}</Text>
            <Text style={styles.personaleLabel}>Questa settimana</Text>
          </View>
          <View style={styles.personaleItem}>
            <MaterialCommunityIcons name="weight" size={24} color="#4CAF50" />
            <Text style={styles.personaleValue}>{stats?.operatore?.kg_salvati || 0} kg</Text>
            <Text style={styles.personaleLabel}>Cibo salvato</Text>
          </View>
        </View>
      </View>
    </Card.Content>
  </Card>
);

const AmministratoreContent = ({ stats, user }: { stats: any, user: any }) => {
  // Funzione per navigare alla gestione lotti
  const navigateToLottiHistory = () => {
    router.push('/(tabs)/lotti');
  };

  // Funzione per navigare alle notifiche
  const navigateToNotifiche = () => {
    router.push('/notifiche/');
  };

  // Funzione per navigare alle prenotazioni
  const navigateToPrenotazioni = () => {
    router.push('/prenotazioni');
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
    <>
      <Card style={styles.roleCard}>
        <Card.Title 
          title="Dashboard Amministratore" 
          left={(props) => <MaterialCommunityIcons name="view-dashboard" size={30} color="#2196F3" />}
        />
        <Card.Content>
          <View style={styles.adminStatsContainer}>
            <View style={styles.adminStatsRow}>
              <View style={[styles.adminStat, styles.blueStat]}>
                <MaterialCommunityIcons name="food-apple" size={28} color="#fff" />
                <Text style={styles.adminStatNumber}>{stats?.lotti?.totale || 0}</Text>
                <Text style={styles.adminStatLabel}>Lotti</Text>
              </View>
              <View style={[styles.adminStat, styles.purpleStat]}>
                <MaterialCommunityIcons name="truck-delivery" size={28} color="#fff" />
                <Text style={styles.adminStatNumber}>{stats?.prenotazioni?.totale || 0}</Text>
                <Text style={styles.adminStatLabel}>Prenotazioni</Text>
              </View>
            </View>
            <View style={styles.adminStatsRow}>
              <View style={[styles.adminStat, styles.orangeStat]}>
                <MaterialCommunityIcons name="calendar-clock" size={28} color="#fff" />
                <Text style={styles.adminStatNumber}>{stats?.attivita?.oggi || 0}</Text>
                <Text style={styles.adminStatLabel}>Attività Oggi</Text>
              </View>
              <View style={[styles.adminStat, styles.greenStat]}>
                <MaterialCommunityIcons name="check-circle" size={28} color="#fff" />
                <Text style={styles.adminStatNumber}>{stats?.prenotazioni?.consegnate || 0}</Text>
                <Text style={styles.adminStatLabel}>Consegnati</Text>
              </View>
            </View>
          </View>
          
          {/* Sezione Azioni Rapide */}
          <View style={styles.adminActions}>
            <Text style={styles.adminActionTitle}>Azioni Rapide</Text>
            <View style={styles.adminActionButtons}>
              <TouchableOpacity
                style={styles.adminActionButton}
                onPress={navigateToLottiHistory}
              >
                <View style={[styles.adminActionIcon, { backgroundColor: '#4CAF50' }]}>
                  <MaterialCommunityIcons name="food-apple" size={24} color="#fff" />
                </View>
                <Text style={styles.adminActionLabel}>Lotti</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adminActionButton}
                onPress={navigateToPrenotazioni}
              >
                <View style={[styles.adminActionIcon, { backgroundColor: '#FF9800' }]}>
                  <MaterialCommunityIcons name="truck-delivery" size={24} color="#fff" />
                </View>
                <Text style={styles.adminActionLabel}>Prenotazioni</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adminActionButton}
                onPress={navigateToNotifiche}
              >
                <View style={[styles.adminActionIcon, { backgroundColor: '#2196F3' }]}>
                  <MaterialCommunityIcons name="bell" size={24} color="#fff" />
                </View>
                <Text style={styles.adminActionLabel}>Notifiche</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adminActionButton}
                onPress={navigateToStatistiche}
              >
                <View style={[styles.adminActionIcon, { backgroundColor: '#9C27B0' }]}>
                  <MaterialCommunityIcons name="chart-bar" size={24} color="#fff" />
                </View>
                <Text style={styles.adminActionLabel}>Statistiche</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card.Content>
      </Card>
    </>
  );
};

const CentroSocialeContent = ({ stats }: { stats: any }) => {
  // Funzione per navigare alla pagina dei lotti disponibili
  const navigateToLottiDisponibili = () => {
    router.push('/(tabs)/lotti');
  };

  // Funzione per navigare alle prenotazioni
  const navigateToPrenotazioni = () => {
    router.push('/prenotazioni');
  };

  return (
    <Card style={styles.roleCard}>
      <Card.Title 
        title="I Tuoi Lotti Disponibili" 
        left={(props) => <MaterialCommunityIcons name="hand-heart" size={30} color="#FF9800" />}
      />
      <Card.Content>
        <Text style={styles.centroSocialeText}>Lotti arancioni riservati per il tuo centro</Text>
        <View style={styles.lottiBadge}>
          <MaterialCommunityIcons name="food-apple" size={40} color="#FF9800" />
          <Text style={styles.lottiBadgeNumber}>{stats?.lotti?.per_stato?.arancione || 0}</Text>
          <Text style={styles.lottiBadgeLabel}>Lotti Arancioni</Text>
        </View>
        
        {/* Statistiche personali centro sociale */}
        <View style={styles.personaleStats}>
          <Text style={styles.personaleTitle}>La tua attività</Text>
          <View style={styles.personaleRow}>
            <View style={styles.personaleItem}>
              <MaterialCommunityIcons name="cart-outline" size={24} color="#FF9800" />
              <Text style={styles.personaleValue}>{stats?.centro?.prenotazioni_attive || 0}</Text>
              <Text style={styles.personaleLabel}>Prenotazioni attive</Text>
            </View>
            <View style={styles.personaleItem}>
              <MaterialCommunityIcons name="package-variant-closed" size={24} color="#FF9800" />
              <Text style={styles.personaleValue}>{stats?.centro?.lotti_ricevuti || 0}</Text>
              <Text style={styles.personaleLabel}>Lotti ricevuti</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.centroSocialeButtons}>
          <Button 
            mode="contained" 
            style={[styles.actionButton, { backgroundColor: '#FF9800' }]} 
            icon="shopping"
            onPress={navigateToLottiDisponibili}
          >
            Lotti Disponibili
          </Button>
          <Button 
            mode="outlined" 
            style={[styles.actionButton, { borderColor: '#FF9800' }]} 
            textColor="#FF9800"
            icon="history"
            onPress={navigateToPrenotazioni}
          >
            Le Mie Prenotazioni
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
};

const CentroRiciclaggioContent = ({ stats }: { stats: any }) => (
  <Card style={styles.roleCard}>
    <Card.Title 
      title="Lotti per Riciclaggio" 
      left={(props) => <MaterialCommunityIcons name="recycle" size={30} color="#F44336" />}
    />
    <Card.Content>
      <Text style={styles.centroRicicloText}>Lotti rossi disponibili per il tuo centro</Text>
      <View style={styles.lottiBadge}>
        <MaterialCommunityIcons name="food-apple" size={40} color="#F44336" />
        <Text style={styles.lottiBadgeNumber}>{stats?.lotti?.per_stato?.rosso || 0}</Text>
        <Text style={styles.lottiBadgeLabel}>Lotti Rossi</Text>
      </View>
      
      {/* Statistiche personali centro riciclaggio */}
      <View style={styles.personaleStats}>
        <Text style={styles.personaleTitle}>Il tuo contributo</Text>
        <View style={styles.personaleRow}>
          <View style={styles.personaleItem}>
            <MaterialCommunityIcons name="recycle" size={24} color="#F44336" />
            <Text style={styles.personaleValue}>{stats?.centro?.lotti_riciclati || 0}</Text>
            <Text style={styles.personaleLabel}>Lotti riciclati</Text>
          </View>
          <View style={styles.personaleItem}>
            <MaterialCommunityIcons name="weight" size={24} color="#F44336" />
            <Text style={styles.personaleValue}>{stats?.centro?.kg_riciclati || 0} kg</Text>
            <Text style={styles.personaleLabel}>Cibo riciclato</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.centroRicicloButtons}>
        <Button 
          mode="contained" 
          style={[styles.actionButton, { backgroundColor: '#F44336' }]} 
          icon="recycle"
          onPress={() => router.push('/(tabs)/lotti')}
        >
          Lotti per Riciclaggio
        </Button>
        <Button 
          mode="outlined" 
          style={[styles.actionButton, { borderColor: '#F44336' }]} 
          textColor="#F44336"
          icon="history"
          onPress={() => router.push('/prenotazioni')}
        >
          Storico Trasformazioni
        </Button>
      </View>
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
    marginBottom: 8,
    elevation: 4,
    borderRadius: 12,
  },
  notificationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcomeContent: {
    flex: 1,
    paddingVertical: 8,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: PRIMARY_COLOR,
    marginRight: 16,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
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
  highlightCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 4,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshButton: {
    margin: 0,
  },
  highlightStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  highlightItem: {
    alignItems: 'center',
  },
  highlightNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  highlightLabel: {
    fontSize: 14,
    color: '#666',
  },
  todayActivities: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
  },
  todayActivitiesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  todayActivitiesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  todayActivityItem: {
    alignItems: 'center',
  },
  todayActivityIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  todayActivityValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  todayActivityLabel: {
    fontSize: 12,
    color: '#666',
  },
  lastUpdateContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  lastUpdateText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  detailCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 3,
    borderRadius: 12,
  },
  lottiGraph: {
    height: 200,
    paddingVertical: 8,
  },
  graphLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  graphBars: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingBottom: 8,
  },
  graphBarContainer: {
    alignItems: 'center',
    width: 60,
  },
  graphBar: {
    width: 40,
    minHeight: 20,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  greenBar: {
    backgroundColor: '#4CAF50',
  },
  orangeBar: {
    backgroundColor: '#FF9800',
  },
  redBar: {
    backgroundColor: '#F44336',
  },
  graphLabel: {
    marginTop: 4,
    fontSize: 12,
  },
  prenotazioniStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    paddingVertical: 16,
  },
  prenotazioneItem: {
    alignItems: 'center',
    width: '25%',
    marginBottom: 16,
  },
  prenotazioneIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  prenotazioneNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  prenotazioneLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  prenotazioniProgress: {
    marginTop: 16,
  },
  progressBar: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
  },
  progressSegment: {
    height: '100%',
  },
  prenotazioniSummary: {
    marginTop: 8,
    alignItems: 'center',
  },
  prenotazioniTotal: {
    fontSize: 14,
    color: '#666',
  },
  prenotazioniTotalNumber: {
    fontWeight: 'bold',
    color: '#333',
  },
  impactCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 16,
    elevation: 3,
    borderRadius: 12,
    backgroundColor: '#F1F8E9',
  },
  impactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  impactItem: {
    alignItems: 'center',
  },
  impactNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    color: '#4CAF50',
  },
  impactLabel: {
    fontSize: 14,
    color: '#666',
  },
  roleCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 3,
    borderRadius: 12,
  },
  operatoreStats: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  operatoreIcon: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  operatoreInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  operatoreInfoText: {
    fontSize: 16,
    marginBottom: 8,
  },
  operatoreHighlight: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  operatoreActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  operatoreButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  adminStatsContainer: {
    marginVertical: 8,
  },
  adminStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  adminStat: {
    width: '48%',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  blueStat: {
    backgroundColor: '#2196F3',
  },
  purpleStat: {
    backgroundColor: '#673AB7',
  },
  orangeStat: {
    backgroundColor: '#FF9800',
  },
  greenStat: {
    backgroundColor: '#4CAF50',
  },
  adminStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 4,
  },
  adminStatLabel: {
    fontSize: 14,
    color: '#fff',
  },
  adminActions: {
    marginTop: 16,
  },
  adminActionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  adminActionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  adminActionButton: {
    width: '22%',
    alignItems: 'center',
    marginBottom: 12,
  },
  adminActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  adminActionLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  centroSocialeText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 8,
  },
  lottiBadge: {
    alignItems: 'center',
    marginVertical: 16,
  },
  lottiBadgeNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 8,
  },
  lottiBadgeLabel: {
    fontSize: 14,
    color: '#666',
  },
  centroSocialeButtons: {
    marginTop: 8,
  },
  centroRicicloText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 8,
  },
  centroRicicloButtons: {
    marginTop: 8,
  },
  actionButton: {
    marginTop: 8,
  },
  errorCard: {
    margin: 16,
    backgroundColor: '#ffebee',
    borderRadius: 12,
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
  },
  personaleStats: {
    marginTop: 16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  personaleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  personaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  personaleItem: {
    alignItems: 'center',
    padding: 8,
  },
  personaleValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 4,
    color: '#333',
  },
  personaleLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
