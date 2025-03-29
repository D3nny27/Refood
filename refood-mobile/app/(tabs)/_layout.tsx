import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useNotifiche } from '../../src/context/NotificheContext';
import { PRIMARY_COLOR, RUOLI, TIPI_UTENTE } from '../../src/config/constants';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { useEffect, useMemo } from 'react';
import { useTheme } from '@react-navigation/native';

// Componente Badge per il contatore delle notifiche
function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  
  return (
    <View style={styles.badgeContainer}>
      <Text style={styles.badgeText}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const { nonLette, aggiornaConteggio } = useNotifiche();
  const theme = useTheme();
  
  // Aggiorniamo il conteggio quando il componente viene montato e quando l'utente cambia
  useEffect(() => {
    // Esce se non c'è un utente
    if (!user) return;
    
    // Aggiorna immediatamente il conteggio
    aggiornaConteggio();
    
    // Impostiamo un intervallo per aggiornare periodicamente il conteggio
    const interval = setInterval(() => {
      aggiornaConteggio();
    }, 30000); // Ogni 30 secondi (ridotto da 60 secondi per aggiornamenti più frequenti)
    
    // Pulizia dell'intervallo quando il componente si smonta o l'utente cambia
    return () => clearInterval(interval);
  }, [user, aggiornaConteggio]); // Dipendenze: user e aggiornaConteggio

  // Determina il tipo di utente e imposta il colore appropriato
  let userTypeColor = '#757575'; // Default grigio
  let userTypeIcon = 'account';  // Default icona account
  let userLabel = '';
  
  if (user?.ruolo === RUOLI.AMMINISTRATORE) {
    userTypeColor = '#2196F3'; // Blu per amministratori
    userTypeIcon = 'shield-account';
    userLabel = 'Amministratore';
  } else if (user?.ruolo === RUOLI.OPERATORE) {
    userTypeColor = '#2196F3'; // Blu per operatori
    userTypeIcon = 'account-wrench';
    userLabel = 'Operatore';
  } else if (user?.ruolo === RUOLI.UTENTE && user?.tipo_utente) {
    const tipoUtenteUpper = user.tipo_utente.toUpperCase();
    
    if (tipoUtenteUpper === 'PRIVATO') {
      userTypeColor = '#4CAF50'; // Verde per utenti privati
      userTypeIcon = 'account';
      userLabel = 'Utente Privato';
    } else if (tipoUtenteUpper === 'CANALE SOCIALE') {
      userTypeColor = '#FF9800'; // Arancione per canali sociali
      userTypeIcon = 'account-group';
      userLabel = 'Canale Sociale';
    } else if (tipoUtenteUpper === 'CENTRO RICICLO') {
      userTypeColor = '#F44336'; // Rosso per centri di riciclo
      userTypeIcon = 'delete';
      userLabel = 'Centro Riciclo';
    }
  }

  const determineActiveTab = useMemo(() => {
    // Solo per utenti autenticati
    if (user) {
      // Se è amministratore o operatore, usa il blu
      if (user?.ruolo === RUOLI.AMMINISTRATORE || user?.ruolo === RUOLI.OPERATORE) {
        return '#2196F3'; // blu
      }
      
      // Cambia il colore del badge in base al tipo utente
      if (user?.ruolo === RUOLI.UTENTE && user?.tipo_utente) {
        const tipoUtenteUpper = user.tipo_utente.toUpperCase();
        
        if (tipoUtenteUpper === 'PRIVATO') {
          return '#4CAF50'; // verde
        } else if (tipoUtenteUpper === 'CANALE SOCIALE') {
          return '#FF9800'; // arancione
        } else if (tipoUtenteUpper === 'CENTRO RICICLO') {
          return '#F44336'; // rosso
        }
      }
      
      return theme.colors.primary; // colore default per altri ruoli
    }
    
    return theme.colors.primary; // non autenticato
  }, [user, theme]);

  // Assicuriamoci che l'utente sia autenticato prima di mostrare le tab
  if (!user) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: determineActiveTab,
        headerStyle: {
          backgroundColor: PRIMARY_COLOR,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#e1e1e1'
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 3
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home" color={color} size={28} />,
        }}
      />
      
      <Tabs.Screen
        name="lotti"
        options={{
          title: 'Lotti',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="package-variant" color={color} size={28} />,
        }}
      />
      
      <Tabs.Screen
        name="prenotazioni"
        options={{
          title: 'Prenotazioni',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="calendar" color={color} size={28} />,
        }}
      />
      
      <Tabs.Screen
        name="statistiche"
        options={{
          title: 'Statistiche',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="chart-bar" color={color} size={28} />,
        }}
      />
      
      <Tabs.Screen
        name="notifiche"
        options={{
          title: 'Notifiche',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="bell" color={color} size={28} />,
        }}
      />
      
      <Tabs.Screen
        name="profilo"
        options={{
          title: 'Profilo',
          tabBarIcon: ({ color }) => (
            <View style={styles.profileTabContainer}>
              <MaterialCommunityIcons name="account-circle" color={color} size={28} />
              
              {/* Badge per il tipo di utente - visibile per tutti i tipi */}
              {userLabel && (
                <View style={[styles.userTypeBadge, { backgroundColor: userTypeColor }]}>
                  <Text style={styles.userTypeText}>{userLabel}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: 'red',
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileTabContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userTypeBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 10,
    top: -8,
    right: -16,
    minWidth: 60,
    maxWidth: 90,
  },
  userTypeText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
