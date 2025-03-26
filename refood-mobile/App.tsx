import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { Slot } from 'expo-router';
import { AuthProvider } from './src/context/AuthContext';
import { NotificheProvider } from './src/context/NotificheContext';
import Toast from 'react-native-toast-message';

export default function App() {
  return (
    <AuthProvider>
      <NotificheProvider>
        <PaperProvider>
          <StatusBar style="auto" />
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Slot />
          </GestureHandlerRootView>
          <Toast />
        </PaperProvider>
      </NotificheProvider>
    </AuthProvider>
  );
} 