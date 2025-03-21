import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { Text, Card, Title, Paragraph, Button, ActivityIndicator, Appbar, Divider, List } from 'react-native-paper';
import { PRIMARY_COLOR, STORAGE_KEYS, API_URL } from '../../src/config/constants';
import { useAuth } from '../../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

interface AssociazioneCentro {
  id: number;
  nome: string;
  tipo: string;
  tipo_descrizione?: string;
  indirizzo: string;
}

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const [centri, setCentri] = useState<AssociazioneCentro[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAssociazioni();
  }, []);

  const loadAssociazioni = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      
      // Ottieni le associazioni dell'amministratore corrente
      const response = await fetch(`${API_URL}/centri?associatiA=${user?.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Errore nel caricamento delle associazioni (${response.status})`);
      }

      const data = await response.json();
      
      if (data && data.data) {
        setCentri(data.data);
      } else {
        setCentri([]);
      }
    } catch (error) {
      console.error('Errore nel caricamento delle associazioni:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Impossibile caricare le associazioni',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAssociazioni();
  };

  const goToCentriManagement = () => {
    router.push('/admin/centri');
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Amministrazione" />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY_COLOR]}
          />
        }
      >
        <Card style={styles.welcomeCard}>
          <Card.Content>
            <Title>Benvenuto, {user?.nome} {user?.cognome}</Title>
            <Paragraph>Pannello di amministrazione</Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.section}>
          <Card.Content>
            <Title style={styles.sectionTitle}>I tuoi centri</Title>
            <Paragraph style={styles.sectionSubtitle}>
              Centri a cui sei associato
            </Paragraph>
            
            {loading && !refreshing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                <Text style={styles.loadingText}>Caricamento in corso...</Text>
              </View>
            ) : (
              <>
                {centri.length > 0 ? (
                  <List.Section>
                    {centri.map((centro) => (
                      <List.Item
                        key={centro.id}
                        title={centro.nome}
                        description={`${centro.indirizzo} • ${centro.tipo_descrizione || centro.tipo}`}
                        left={props => <List.Icon {...props} icon="domain" />}
                        right={props => <List.Icon {...props} icon="chevron-right" />}
                        onPress={() => router.push(`/admin/centri/operatori?id=${centro.id}`)}
                        style={styles.listItem}
                      />
                    ))}
                  </List.Section>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      Non sei associato a nessun centro.
                    </Text>
                    <Text style={styles.emptyStateSubtext}>
                      Vai alla gestione centri e associati a un centro.
                    </Text>
                  </View>
                )}
              </>
            )}
          </Card.Content>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            icon="domain"
            onPress={goToCentriManagement}
            style={styles.button}
          >
            Gestione Centri
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  welcomeCard: {
    marginBottom: 16,
    elevation: 4,
  },
  section: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    marginBottom: 16,
    color: '#666',
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    padding: 8,
    backgroundColor: PRIMARY_COLOR,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  listItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
}); 