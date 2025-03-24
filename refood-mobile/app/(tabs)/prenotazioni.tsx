import { View, Text, StyleSheet } from 'react-native';
import PrenotazioniScreen from '../prenotazioni/index';

export default function PrenotazioniTabScreen() {
  return <PrenotazioniScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#4CAF50',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
  },
}); 