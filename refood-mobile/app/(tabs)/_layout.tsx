import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useNotifiche } from '../../src/context/NotificheContext';
import { PRIMARY_COLOR } from '../../src/config/constants';
import { View, Text, StyleSheet } from 'react-native';
import { useEffect } from 'react';

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
  const { user } = useAuth();
  const { nonLette, aggiornaConteggio } = useNotifiche();
  
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

  // Assicuriamoci che l'utente sia autenticato prima di mostrare le tab
  if (!user) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY_COLOR,
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="lotti"
        options={{
          title: 'Lotti',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="prenotazioni"
        options={{
          title: 'Prenotazioni',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="statistiche"
        options={{
          title: 'Statistiche',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="notifiche"
        options={{
          title: 'Notifiche',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="notifications-outline" size={size} color={color} />
              <NotificationBadge count={nonLette} />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="profilo"
        options={{
          title: 'Profilo',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
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
});
