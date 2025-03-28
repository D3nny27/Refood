import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button, Card, Avatar, List, Divider, useTheme, Dialog, Portal, Paragraph } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { RUOLI, PRIMARY_COLOR } from '../../src/config/constants';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../src/config/constants';
import { useState } from 'react';

export default function ProfiloScreen() {
  const { user, logout, forceAuthUpdate } = useAuth();
  const theme = useTheme();
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [developmentDialogVisible, setDevelopmentDialogVisible] = useState(false);

  // Funzione di logout forzata che pulisce tutto
  const forceLogout = async () => {
    console.log('ProfiloScreen - forceLogout: INIZIO pulizia manuale di tutti i dati');
    
    // Verifica disponibilità delle funzioni prima di chiamarle
    const logoutFnAvailable = typeof logout === 'function';
    const forceUpdateAvailable = typeof forceAuthUpdate === 'function';
    console.log(`ProfiloScreen - forceLogout: funzioni disponibili? logout: ${logoutFnAvailable ? 'SÌ' : 'NO'} forceAuthUpdate: ${forceUpdateAvailable ? 'SÌ' : 'NO'}`);
    
    try {
      // Pulizia AsyncStorage
      console.log('ProfiloScreen - forceLogout: pulizia AsyncStorage');
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_TOKEN,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.REFRESH_TOKEN
      ]).then(() => {
        console.log('ProfiloScreen - forceLogout: AsyncStorage pulito con successo');
      }).catch(err => {
        console.error('ProfiloScreen - forceLogout: ERRORE pulizia AsyncStorage', err);
      });
      
      // Chiama logout() se disponibile
      if (logoutFnAvailable) {
        console.log('ProfiloScreen - forceLogout: chiamata funzione logout()');
        await logout().then(() => {
          console.log('ProfiloScreen - forceLogout: chiamata logout() completata');
        }).catch(err => {
          console.error('ProfiloScreen - forceLogout: ERRORE chiamata logout()', err);
        });
      }
      
      // Forza aggiornamento contesto auth se disponibile
      if (forceUpdateAvailable) {
        console.log('ProfiloScreen - forceLogout: aggiornamento contesto auth');
        try {
          forceAuthUpdate();
        } catch (err) {
          console.error('ProfiloScreen - forceLogout: ERRORE aggiornamento contesto auth', err);
        }
      }
      
      // Reindirizzamento esplicito alla schermata di login
      console.log('ProfiloScreen - forceLogout: reindirizzamento esplicito alla schermata di login');
      
      // Breve timeout per assicurarsi che tutte le operazioni precedenti siano completate
      setTimeout(() => {
        router.replace('/');
        console.log('ProfiloScreen - forceLogout: reindirizzamento completato');
      }, 100);
      
    } catch (criticalError) {
      console.error('ProfiloScreen - forceLogout: ERRORE CRITICO', criticalError);
      
      // In caso di errore critico, tenta comunque la navigazione
      try {
        router.replace('/');
        console.log('ProfiloScreen - forceLogout: reindirizzamento di emergenza completato');
      } catch (navError) {
        console.error('ProfiloScreen - forceLogout: ERRORE durante il reindirizzamento di emergenza', navError);
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