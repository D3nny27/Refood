import React from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';

// Questo componente reindirizza automaticamente l'utente
// La logica di reindirizzamento è nel layout principale
export default function IndexPage() {
  // Utilizziamo Redirect per evitare di mostrare qualsiasi contenuto
  return <Redirect href="/" />;
} 