import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Chip, Text, Badge } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Lotto } from '../services/lottiService';
import { STATUS_COLORS } from '../config/constants';

interface LottoCardProps {
  lotto: Lotto;
  onPress: (lotto: Lotto) => void;
}

// Funzione di utilità per formattare la data
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'N/D';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Data non valida';
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (error) {
    console.error('Errore nel parsing della data:', error);
    return 'Errore data';
  }
};

// Funzione di utilità per determinare il colore in base allo stato
const getStatusColor = (stato: string | undefined) => {
  switch (stato) {
    case 'Verde':
      return STATUS_COLORS.SUCCESS;
    case 'Arancione':
      return STATUS_COLORS.WARNING;
    case 'Rosso':
      return STATUS_COLORS.ERROR;
    default:
      return STATUS_COLORS.INFO;
  }
};

// Funzione per ottenere il testo descrittivo per lo stato
const getStatusDescription = (stato: string | undefined) => {
  switch (stato) {
    case 'Verde':
      return 'Lontano dalla scadenza';
    case 'Arancione':
      return 'Vicino alla scadenza';
    case 'Rosso':
      return 'Molto vicino/scaduto';
    default:
      return 'Stato sconosciuto';
  }
};

const LottoCard: React.FC<LottoCardProps> = ({ lotto, onPress }) => {
  // Gestione valori sicuri per evitare errori di rendering
  const nome = lotto.nome || 'Lotto senza nome';
  const centroNome = lotto.centro_nome || `Centro #${lotto.centro_id || 'N/D'}`;
  const quantita = isNaN(Number(lotto.quantita)) ? '0' : lotto.quantita.toString();
  const unitaMisura = lotto.unita_misura || 'pz';
  const descrizione = lotto.descrizione || 'Nessuna descrizione disponibile';
  const stato = lotto.stato || 'Verde';
  
  return (
    <TouchableOpacity onPress={() => onPress(lotto)} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={styles.statusBadge}>
          <Badge
            size={12}
            style={{ backgroundColor: getStatusColor(stato) }}
          />
        </View>
        <Card.Content>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Title style={styles.title}>{nome}</Title>
              <Paragraph style={styles.subtitle}>{centroNome}</Paragraph>
            </View>
            <View style={styles.quantityContainer}>
              <Text style={styles.quantity}>{quantita}</Text>
              <Text style={styles.unit}>{unitaMisura}</Text>
            </View>
          </View>
          
          <Paragraph style={styles.description} numberOfLines={2}>
            {descrizione}
          </Paragraph>
          
          <View style={styles.footer}>
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.date}>Scadenza: {formatDate(lotto.data_scadenza)}</Text>
            </View>
            
            <View style={styles.statusContainer}>
              <Chip 
                style={[styles.statusChip, { backgroundColor: getStatusColor(stato) + '30' }]} 
                textStyle={[styles.statusChipText, { color: getStatusColor(stato) }]}
              >
                {stato}
              </Chip>
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  quantityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    minWidth: 60,
  },
  quantity: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  unit: {
    fontSize: 12,
    color: '#666',
  },
  description: {
    marginBottom: 12,
    color: '#444',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  statusContainer: {
    flexDirection: 'row',
  },
  statusChip: {
    height: 28,
    paddingHorizontal: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default LottoCard; 