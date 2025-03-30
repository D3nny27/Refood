import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Chip, Text, Badge, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Lotto } from '../services/lottiService';
import { STATUS_COLORS, PRIMARY_COLOR, RUOLI } from '../config/constants';
import { useAuth } from '../context/AuthContext';

interface LottoCardProps {
  lotto: Lotto;
  onPress: (lotto: Lotto) => void;
  onPrenota?: (lotto: Lotto) => void;
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
const getStatusColor = (lotto: Lotto | string) => {
  // Gestione degli oggetti Lotto
  if (typeof lotto !== 'string') {
    console.log(`[LottoCard] getStatusColor per lotto ID:${lotto.id} - stato_prenotazione:`, lotto.stato_prenotazione);
    
    // Se è prenotato, restituisce il colore per prenotato (blu)
    if (lotto.stato_prenotazione === 'Prenotato') {
      console.log(`[LottoCard] Lotto ${lotto.id} è PRENOTATO, uso colore INFO`);
      return STATUS_COLORS.INFO;
    }
    
    // Altrimenti usa il colore normale
    return getStatusColorByState(lotto.stato);
  }
  
  // Gestione delle stringhe
  return getStatusColorByState(lotto);
};

// Funzione ausiliaria per ottenere il colore in base allo stato come stringa
const getStatusColorByState = (stato: string | undefined) => {
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
const getStatusText = (lotto: Lotto | string) => {
  // Gestione degli oggetti Lotto
  if (typeof lotto !== 'string') {
    console.log(`[LottoCard] getStatusText per lotto ID:${lotto.id} - stato_prenotazione:`, lotto.stato_prenotazione);
    
    // Se è prenotato, restituisce "Prenotato"
    if (lotto.stato_prenotazione === 'Prenotato') {
      console.log(`[LottoCard] Lotto ${lotto.id} è PRENOTATO, mostro etichetta "Prenotato"`);
      return 'Prenotato';
    }
    
    // Altrimenti restituisce lo stato normale
    return lotto.stato;
  }
  
  // Gestione delle stringhe
  return lotto;
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
    case 'Prenotato':
      return 'Lotto già prenotato';
    default:
      return 'Stato sconosciuto';
  }
};

const LottoCard: React.FC<LottoCardProps> = ({ lotto, onPress, onPrenota }) => {
  const { user } = useAuth();
  
  // Controlla se l'utente può prenotare il lotto
  const canPrenotareLotto = user?.ruolo === 'Utente'; // Solo gli utenti normali possono prenotare
  
  // Gestione valori sicuri per evitare errori di rendering
  const nome = lotto.nome || 'Lotto senza nome';
  const quantita = isNaN(Number(lotto.quantita)) ? '0' : lotto.quantita.toString();
  const unitaMisura = lotto.unita_misura || 'pz';
  const descrizione = lotto.descrizione || 'Nessuna descrizione disponibile';
  
  // Determina lo stato e il colore da mostrare
  const displayState = getStatusText(lotto);
  const stateColor = getStatusColor(lotto);
  
  console.log(`[RENDER] LottoCard ${lotto.id}: stato=${lotto.stato}, stato_prenotazione=${lotto.stato_prenotazione}, displayState=${displayState}`);
  
  // Gestisci il click sul pulsante di prenotazione
  const handlePrenotaClick = (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    // Impedisci la propagazione dell'evento al TouchableOpacity parent
    e.stopPropagation();
    if (onPrenota) {
      onPrenota(lotto);
    }
  };
  
  return (
    <TouchableOpacity onPress={() => onPress(lotto)} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={styles.statusBadge}>
          <Badge
            size={12}
            style={{ backgroundColor: stateColor }}
          />
        </View>
        <Card.Content>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Title style={styles.title}>{nome}</Title>
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
                style={[styles.statusChip, { backgroundColor: stateColor + '30' }]} 
                textStyle={[styles.statusChipText, { color: stateColor }]}
              >
                {displayState}
              </Chip>
            </View>
          </View>
          
          {/* Mostra il prezzo se disponibile */}
          {lotto.prezzo !== undefined && lotto.prezzo !== null && (
            <View style={styles.priceContainer}>
              <Ionicons name="pricetag-outline" size={16} color="#666" />
              <Text style={styles.price}>Prezzo: {lotto.prezzo.toFixed(2)} €</Text>
            </View>
          )}
          
          {/* Pulsante di prenotazione (nascosto per lotti prenotati) */}
          {canPrenotareLotto && onPrenota && lotto.stato_prenotazione !== 'Prenotato' && (
            <View style={styles.buttonContainer}>
              <Button 
                mode="contained" 
                onPress={handlePrenotaClick as any}
                style={styles.prenotaButton}
                icon="cart-plus"
              >
                Prenota
              </Button>
            </View>
          )}
          
          {/* Informazione per lotti prenotati */}
          {lotto.stato_prenotazione === 'Prenotato' && (user?.ruolo === 'Amministratore' || user?.ruolo === 'Operatore') && (
            <View style={styles.prenotatoContainer}>
              <Text style={styles.prenotatoText}>
                <Ionicons name="information-circle" size={16} color={STATUS_COLORS.INFO} /> Questo lotto è già stato prenotato
              </Text>
              
              {/* Mostra prezzo se disponibile per lotti verdi */}
              {lotto.stato === 'Verde' && lotto.prezzo !== undefined && lotto.prezzo !== null && (
                <Text style={styles.prenotatoText}>
                  <Ionicons name="pricetag-outline" size={16} color={STATUS_COLORS.INFO} /> Prezzo: {lotto.prezzo.toFixed(2)} €
                </Text>
              )}
            </View>
          )}
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
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  price: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  buttonContainer: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  prenotaButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
  },
  prenotatoContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: `${STATUS_COLORS.INFO}15`, 
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: STATUS_COLORS.INFO,
  },
  prenotatoText: {
    fontSize: 12,
    color: '#444',
  },
});

export default LottoCard; 