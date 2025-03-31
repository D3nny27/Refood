import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Button, Card, Avatar, List, Divider, useTheme, Dialog, Portal, Paragraph, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { RUOLI, PRIMARY_COLOR } from '../../src/config/constants';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../src/config/constants';
import { useState, useContext } from 'react';
import { ThemeContext } from '../_layout';

export default function ProfiloScreen() {
  const { user, logout, forceAuthUpdate } = useAuth();
  const theme = useTheme();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
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
      
      // Non eseguiamo più un reindirizzamento diretto qui
      // ma lasciamo che sia il sistema di autenticazione a occuparsene
      console.log('ProfiloScreen - forceLogout: completato, attendo il reindirizzamento automatico');
      
    } catch (criticalError) {
      console.error('ProfiloScreen - forceLogout: ERRORE CRITICO', criticalError);
      // Non tentare di navigare in caso di errore critico
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
    <ScrollView style={[styles.container, isDarkMode && styles.containerDark]}>
      <Card style={styles.profileCard}>
        <Card.Content style={styles.profileContent}>
          <Avatar.Icon 
            size={80} 
            icon="account" 
            style={styles.avatar} 
            color="#fff" 
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.name, isDarkMode && styles.textLight]}>{user?.nome} {user?.cognome}</Text>
            <Text style={[styles.email, isDarkMode && styles.textLightSecondary]}>{user?.email}</Text>
            <View style={styles.roleContainer}>
              {user?.ruolo === RUOLI.AMMINISTRATORE ? (
                <View style={styles.userTypeContainer}>
                  <Text style={styles.role}>Amministratore</Text>
                  <View style={[styles.userTypeBadge, styles.badgeAmministratore]} />
                </View>
              ) : user?.ruolo === RUOLI.OPERATORE ? (
                <View style={styles.userTypeContainer}>
                  <Text style={styles.role}>Operatore</Text>
                  <View style={[styles.userTypeBadge, styles.badgeOperatore]} />
                </View>
              ) : (
                <View style={styles.userTypeContainer}>
                  <Text style={styles.role}>
                    {user?.tipo_utente && typeof user.tipo_utente === 'string' ? 
                      (user.tipo_utente.toUpperCase() === 'PRIVATO' ? 'Utente privato' :
                       user.tipo_utente.toUpperCase() === 'CANALE SOCIALE' ? 'Canale Sociale' :
                       user.tipo_utente.toUpperCase() === 'CENTRO RICICLO' ? 'Centro riciclo' :
                       user.tipo_utente) : 'Utente'}
                  </Text>
                  <View style={[
                    styles.userTypeBadge,
                    user?.tipo_utente && typeof user.tipo_utente === 'string' ? 
                      (user.tipo_utente.toUpperCase() === 'PRIVATO' ? styles.badgePrivato :
                       user.tipo_utente.toUpperCase() === 'CANALE SOCIALE' ? styles.badgeSociale :
                       user.tipo_utente.toUpperCase() === 'CENTRO RICICLO' ? styles.badgeRiciclo :
                       {}) : {}
                  ]} />
                </View>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>

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

      {/* Impostazioni app */}
      <Card style={styles.sectionCard}>
        <Card.Title 
          title="Impostazioni App" 
          left={(props) => <MaterialCommunityIcons name="cellphone-cog" size={24} color={theme.colors.primary} />} 
        />
        <Card.Content>
          <List.Item
            title="Tema Scuro"
            description={isDarkMode ? "Attivato" : "Disattivato"}
            left={props => <List.Icon {...props} icon={isDarkMode ? "weather-night" : "weather-sunny"} />}
            right={() => (
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                color={theme.colors.primary}
              />
            )}
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

      <Text style={[styles.version, isDarkMode && styles.textLightSecondary]}>ReFood v1.0.0</Text>

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
  containerDark: {
    backgroundColor: '#121212',
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
  textLight: {
    color: '#FFFFFF',
  },
  textLightSecondary: {
    color: '#AEAEAE',
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  role: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '500',
    marginTop: 4,
  },
  userTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userTypeBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: 8,
  },
  badgePrivato: {
    backgroundColor: '#4caf50',  // Verde
  },
  badgeSociale: {
    backgroundColor: '#ff9800',  // Arancione
  },
  badgeRiciclo: {
    backgroundColor: '#f44336',  // Rosso
  },
  badgeOperatore: {
    backgroundColor: '#2196F3',  // Blu
  },
  badgeAmministratore: {
    backgroundColor: '#2196F3',  // Blu
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