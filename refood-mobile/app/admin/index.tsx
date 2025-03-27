import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { Text, Card, Title, Paragraph, Button, ActivityIndicator, Appbar, Divider, List } from 'react-native-paper';
import { PRIMARY_COLOR } from '../../src/config/constants';
import { useAuth } from '../../src/context/AuthContext';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import utentiService from '../../src/services/utentiService';
import { Utente } from '../../src/types/user';

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAssociazioni();
  }, []);

  const loadAssociazioni = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        throw new Error('ID utente non disponibile');
      }
      
      // Ottieni le associazioni dell'amministratore corrente usando il nuovo servizio
      const response = await utentiService.getUtenti({
        associatiA: user.id
      }, true);
      
      setUtenti(response.data || []);
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

  const goToUtentiManagement = () => {
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
            <Title style={styles.sectionTitle}>I tuoi utenti</Title>
            <Paragraph style={styles.sectionSubtitle}>
              Utenti a cui sei associato
            </Paragraph>
            
            {loading && !refreshing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                <Text style={styles.loadingText}>Caricamento in corso...</Text>
              </View>
            ) : (
              <>
                {utenti.length > 0 ? (
                  <List.Section>
                    {utenti.map((utente) => (
                      <List.Item
                        key={utente.id}
                        title={utente.nome}
                        description={`${utente.indirizzo || 'Indirizzo non specificato'} • ${utente.tipo_descrizione || utente.tipo}`}
                        left={props => <List.Icon {...props} icon="domain" />}
                        right={props => <List.Icon {...props} icon="chevron-right" />}
                        onPress={() => router.push(`/admin/centri/operatori?id=${utente.id}`)}
                        style={styles.listItem}
                      />
                    ))}
                  </List.Section>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      Non sei associato a nessun utente.
                    </Text>
                    <Text style={styles.emptyStateSubtext}>
                      Vai alla gestione utenti e associati a un utente.
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
            onPress={goToUtentiManagement}
            style={styles.button}
          >
            Gestione Utenti
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