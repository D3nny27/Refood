import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Button, Card, Avatar, List, Divider, useTheme, Dialog, Portal, Paragraph } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { RUOLI, PRIMARY_COLOR } from '../../src/config/constants';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../src/config/constants';
import { useState } from 'react';
import Toast from 'react-native-toast-message';
import toastHelper from '../../src/utils/toastHelper';
import logger from '../../src/utils/logger';

export default function ProfiloScreen() {
  const { user, logout, forceAuthUpdate } = useAuth();
  const theme = useTheme();
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [developmentDialogVisible, setDevelopmentDialogVisible] = useState(false);

  // Funzione di logout forzata che pulisce tutto
  const forceLogout = async () => {
    console.log('ProfiloScreen - Inizio processo di logout');
    try {
      // Pulizia dei dati in AsyncStorage
      try {
        await AsyncStorage.removeItem('user');
        console.log('ProfiloScreen - forceLogout: Dati utente rimossi da AsyncStorage');
        await AsyncStorage.removeItem('token');
        console.log('ProfiloScreen - forceLogout: Token rimosso da AsyncStorage');
        await AsyncStorage.multiRemove(['user', 'token']);
        console.log('ProfiloScreen - forceLogout: Pulizia aggiuntiva dati completata');
      } catch (storageError) {
        console.error('ProfiloScreen - forceLogout: Errore durante la pulizia di AsyncStorage:', storageError);
      }

      // Chiama la funzione di logout nel contesto di autenticazione
      try {
        logout();
        console.log('ProfiloScreen - forceLogout: Funzione logout chiamata con successo');
      } catch (logoutError) {
        console.error('ProfiloScreen - forceLogout: Errore durante la chiamata a logout():', logoutError);
      }

      // Rimuovo completamente l'uso di Toast per evitare errori

      // Utilizziamo un timeout più lungo per assicurarci che tutte le operazioni siano completate
      console.log('ProfiloScreen - forceLogout: Attesa di 800ms prima del reindirizzamento');
      setTimeout(() => {
        try {
          console.log('ProfiloScreen - forceLogout: Tentativo di reindirizzamento a /');
          
          // Metodo di navigazione ottimizzato per web
          // Su web, preferiamo sempre router.push con URL assoluto
          if (Platform.OS === 'web') {
            // Su web, usiamo un approccio più diretto
            console.log('ProfiloScreen - forceLogout: Piattaforma web rilevata, usando navigazione web-specifica');
            
            // Per web, push è più affidabile
            router.push('/');
            
            // Come fallback in caso di problemi, possiamo provare a manipolare direttamente la location
            // dopo un breve timeout
            setTimeout(() => {
              if (typeof window !== 'undefined' && window.location) {
                try {
                  console.log('ProfiloScreen - forceLogout: Fallback, tentativo di reindirizzamento diretto');
                  // Questo dovrebbe funzionare anche se router.push fallisce
                  window.location.href = '/';
                } catch (windowError) {
                  console.error('ProfiloScreen - forceLogout: Fallback di navigazione fallito:', windowError);
                }
              }
            }, 300);
          } else {
            // Per mobile, continuiamo a usare l'approccio esistente
            router.push('/');
            console.log('ProfiloScreen - forceLogout: Reindirizzamento avviato con router.push');
          }
        } catch (navigationError) {
          console.error('ProfiloScreen - forceLogout: ERRORE durante il reindirizzamento:', navigationError);
          
          // Tentativo di backup con replace in caso di errore
          try {
            console.log('ProfiloScreen - forceLogout: Tentativo alternativo con router.replace');
            router.replace('/');
          } catch (fallbackError) {
            console.error('ProfiloScreen - forceLogout: Anche il tentativo alternativo è fallito:', fallbackError);
            
            // Ultima risorsa: tentativo con manipolazione diretta della location (solo su web)
            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
              try {
                console.log('ProfiloScreen - forceLogout: Tentativo finale con window.location');
                window.location.href = '/';
              } catch (finalError) {
                console.error('ProfiloScreen - forceLogout: Tutti i tentativi di navigazione sono falliti');
              }
            } else {
              // Per mobile, tentiamo ancora con push dopo un ritardo
              setTimeout(() => {
                try {
                  console.log('ProfiloScreen - forceLogout: Ultimo tentativo di reindirizzamento');
                  router.push('/');
                } catch (lastError) {
                  console.error('ProfiloScreen - forceLogout: Impossibile reindirizzare dopo tutti i tentativi:', lastError);
                }
              }, 500);
            }
          }
        }
      }, 800);
    } catch (criticalError) {
      console.error('ProfiloScreen - forceLogout: ERRORE CRITICO', criticalError);
      // Tentativo finale di navigazione in caso di errore grave
      try {
        router.push('/');
      } catch (e) {
        console.error('ProfiloScreen - forceLogout: Impossibile reindirizzare anche dopo errore critico');
        // Se siamo su web, ultimo tentativo con window.location
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
    }
  };

  // Funzione di gestione del logout con Dialog di conferma
  const handleLogout = () => {
    console.log('ProfiloScreen - handleLogout: mostrando Dialog di conferma');
    setLogoutDialogVisible(true);
  };

  // Handler per funzionalità in sviluppo
  const handleDevelopmentFeature = () => {
    setDevelopmentDialogVisible(true);
  };

  // Verifica se l'utente è amministratore
  const isAdmin = user?.ruolo === RUOLI.AMMINISTRATORE;

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.profileCard}>
        <Card.Content style={styles.profileContent}>
          <Avatar.Icon 
            size={80} 
            icon="account" 
            style={styles.avatar} 
            color="#fff" 
          />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user?.nome} {user?.cognome}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.role}>
              {user?.ruolo === RUOLI.AMMINISTRATORE ? 'Amministratore' : 
               user?.ruolo === RUOLI.OPERATORE ? 'Operatore' : 
               'Utente'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Sezione Amministrazione (visibile solo agli admin) */}
      {isAdmin && (
        <Card style={styles.sectionCard}>
          <Card.Title 
            title="Amministrazione" 
            left={(props) => <MaterialCommunityIcons name="shield-account" size={24} color={theme.colors.primary} />} 
          />
          <Card.Content>
            <List.Item
              title="Gestione Centri"
              description="Aggiungi, modifica e assegna centri agli operatori"
              left={props => <List.Icon {...props} icon="domain" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/admin/centri')}
              style={styles.listItem}
            />
            <Divider />
            <List.Item
              title="Gestione Utenti"
              description="Amministra gli account utente"
              left={props => <List.Icon {...props} icon="account-group" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/admin/utenti')}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>
      )}

      {/* Impostazioni account */}
      <Card style={styles.sectionCard}>
        <Card.Title 
          title="Impostazioni Account" 
          left={(props) => <MaterialCommunityIcons name="account-cog" size={24} color={theme.colors.primary} />} 
        />
        <Card.Content>
          <List.Item
            title="Modifica Profilo"
            left={props => <List.Icon {...props} icon="account-edit" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleDevelopmentFeature}
            style={styles.listItem}
          />
          <Divider />
          <List.Item
            title="Cambia Password"
            left={props => <List.Icon {...props} icon="lock-reset" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleDevelopmentFeature}
            style={styles.listItem}
          />
          <Divider />
          <List.Item
            title="Notifiche"
            left={props => <List.Icon {...props} icon="bell-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleDevelopmentFeature}
            style={styles.listItem}
          />
        </Card.Content>
      </Card>

      {/* Pulsante di logout */}
      <Button 
        mode="contained" 
        onPress={handleLogout}
        style={styles.logoutButton}
        contentStyle={styles.logoutButtonContent}
        icon="logout"
        labelStyle={{ fontSize: 16 }}
        accessibilityLabel="Logout"
        testID="logout-button"
      >
        Logout
      </Button>

      <Text style={styles.version}>ReFood v1.0.0</Text>

      {/* Dialog di conferma logout - compatibile con web e mobile */}
      <Portal>
        <Dialog visible={logoutDialogVisible} onDismiss={() => setLogoutDialogVisible(false)}>
          <Dialog.Title>Conferma Logout</Dialog.Title>
          <Dialog.Content>
            <Paragraph>Sei sicuro di voler effettuare il logout?</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLogoutDialogVisible(false)}>Annulla</Button>
            <Button 
              onPress={() => {
                setLogoutDialogVisible(false);
                forceLogout();
              }}
              textColor="#f44336"
            >
              Logout
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Dialog per funzionalità in sviluppo */}
      <Portal>
        <Dialog visible={developmentDialogVisible} onDismiss={() => setDevelopmentDialogVisible(false)}>
          <Dialog.Title>Informazione</Dialog.Title>
          <Dialog.Content>
            <Paragraph>Questa funzionalità è in fase di sviluppo.</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDevelopmentDialogVisible(false)}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  profileCard: {
    margin: 16,
    elevation: 4,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  avatar: {
    backgroundColor: PRIMARY_COLOR,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  role: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '500',
    marginTop: 4,
  },
  sectionCard: {
    margin: 16,
    marginTop: 0,
    elevation: 4,
  },
  listItem: {
    paddingVertical: 8,
  },
  logoutButton: {
    margin: 16,
    backgroundColor: '#f44336',
  },
  logoutButtonContent: {
    paddingVertical: 8,
  },
  version: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginBottom: 24,
  },
}); 