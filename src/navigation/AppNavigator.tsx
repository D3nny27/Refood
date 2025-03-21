import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

// Schermate
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';

// Tipi di navigazione
type AuthStackParamList = {
  Login: undefined;
};

type MainTabParamList = {
  Home: undefined;
  Lotti: undefined;
  Prenotazioni: undefined;
  Profilo: undefined;
};

// Stack per l'autenticazione
const AuthStack = createStackNavigator<AuthStackParamList>();
const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
  </AuthStack.Navigator>
);

// Tab per l'app principale
const MainTab = createBottomTabNavigator<MainTabParamList>();
const MainNavigator = () => {
  const { user } = useAuth();
  
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Lotti') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Prenotazioni') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profilo') {
            iconName = focused ? 'person' : 'person-outline';
          }
          
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <MainTab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Dashboard' }}
      />
      {/* Per ora utilizziamo solo la HomeScreen per tutte le tab, in seguito implementeremo le altre schermate */}
      <MainTab.Screen
        name="Lotti"
        component={HomeScreen}
        options={{ title: 'Lotti' }}
      />
      <MainTab.Screen
        name="Prenotazioni"
        component={HomeScreen}
        options={{ title: 'Prenotazioni' }}
      />
      <MainTab.Screen
        name="Profilo"
        component={HomeScreen}
        options={{ title: 'Profilo' }}
      />
    </MainTab.Navigator>
  );
};

// Navigatore principale che decide quale stack mostrare in base allo stato di autenticazione
const AppNavigator = () => {
  const { user, isLoading } = useAuth();

  // Se sta caricando, potremmo mostrare uno splash screen
  if (isLoading) {
    return null; // Qui potremmo mettere uno splash screen
  }

  return (
    <NavigationContainer>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default AppNavigator; 