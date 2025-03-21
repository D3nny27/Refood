import { View, Text, StyleSheet } from 'react-native';

export default function PrenotazioniScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pagina Prenotazioni</Text>
      <Text style={styles.subtitle}>Qui verranno visualizzate le prenotazioni</Text>
    </View>
  );
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