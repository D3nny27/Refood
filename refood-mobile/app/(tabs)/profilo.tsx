import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Card, Avatar, List, Divider, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { RUOLI, PRIMARY_COLOR } from '../../src/config/constants';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfiloScreen() {
  const { user, logout } = useAuth();
  const theme = useTheme();

  // Gestisce il logout
  const handleLogout = async () => {
    Alert.alert(
      'Conferma logout',
      'Sei sicuro di voler effettuare il logout?',
      [
        {
          text: 'Annulla',
          style: 'cancel'
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        }
      ]
    );
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
               user?.ruolo === RUOLI.CENTRO_SOCIALE ? 'Centro Sociale' : 
               user?.ruolo === RUOLI.CENTRO_RICICLAGGIO ? 'Centro Riciclaggio' : 
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
              onPress={() => Alert.alert('Info', 'Funzionalità in sviluppo')}
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
            onPress={() => Alert.alert('Info', 'Funzionalità in sviluppo')}
            style={styles.listItem}
          />
          <Divider />
          <List.Item
            title="Cambia Password"
            left={props => <List.Icon {...props} icon="lock-reset" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => Alert.alert('Info', 'Funzionalità in sviluppo')}
            style={styles.listItem}
          />
          <Divider />
          <List.Item
            title="Notifiche"
            left={props => <List.Icon {...props} icon="bell-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => Alert.alert('Info', 'Funzionalità in sviluppo')}
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
      >
        Logout
      </Button>

      <Text style={styles.version}>ReFood v1.0.0</Text>
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