import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Text, IconButton, useTheme } from 'react-native-paper';
import { Notifica, TipoNotifica } from '../types/notification';
import { useNotifiche } from '../context/NotificheContext';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface NotificaItemProps {
  notifica: Notifica;
  onPress: (notifica: Notifica) => void;
}

const NotificaItem: React.FC<NotificaItemProps> = ({ notifica, onPress }) => {
  const { segnaComeLetta, eliminaNotifica } = useNotifiche();
  const theme = useTheme();

  // Costanti per i colori
  const COLORS = {
    alta: '#F44336',    // rosso
    media: '#FF9800',   // arancione
    bassa: '#2196F3',   // blu
    default: '#757575', // grigio
    green: '#4CAF50'    // verde
  };

  // Ottieni l'icona in base al tipo di notifica
  const getIconByType = (tipo: TipoNotifica): string => {
    switch (tipo) {
      case 'CambioStato':
        return 'sync';
      case 'Prenotazione':
        return 'shopping';
      case 'Alert':
        return 'alert-circle';
      default:
        return 'bell';
    }
  };

  // Ottieni il colore in base alla priorità
  const getColorByPriority = (): string => {
    switch (notifica.priorita) {
      case 'Alta':
        return COLORS.alta;
      case 'Media':
        return COLORS.media;
      case 'Bassa':
        return COLORS.bassa;
      default:
        return COLORS.default;
    }
  };

  // Formatta la data della notifica
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return format(date, 'dd/MM/yyyy, HH:mm', { locale: it });
    } catch (error) {
      console.error('Errore nel formato data:', error);
      return dateString;
    }
  };

  // Gestisce il click sul pulsante di lettura
  const handleMarkAsRead = async (e: any) => {
    e.stopPropagation();
    await segnaComeLetta(notifica.id);
  };

  // Gestisce il click sul pulsante di eliminazione
  const handleDelete = async (e: any) => {
    e.stopPropagation();
    await eliminaNotifica(notifica.id);
  };

  return (
    <TouchableOpacity 
      onPress={() => onPress(notifica)}
      style={styles.container}
      activeOpacity={0.7}
    >
      <Card 
        style={[
          styles.card, 
          !notifica.letta && styles.unreadCard
        ]}
      >
        <View style={styles.contentContainer}>
          <View style={[styles.priorityIndicator, { backgroundColor: getColorByPriority() }]} />
          
          <View style={styles.iconContainer}>
            <IconButton
              icon={getIconByType(notifica.tipo)}
              size={24}
              iconColor={getColorByPriority()}
            />
          </View>
          
          <View style={styles.textContent}>
            <Title style={styles.title}>{notifica.titolo}</Title>
            <Paragraph style={styles.message}>{notifica.messaggio}</Paragraph>
            <Text style={styles.date}>{formatDateTime(notifica.data)}</Text>
          </View>
          
          <View style={styles.actionsContainer}>
            {!notifica.letta && (
              <IconButton
                icon="check"
                size={20}
                iconColor={COLORS.green}
                onPress={handleMarkAsRead}
                style={styles.actionButton}
              />
            )}
            <IconButton
              icon="delete"
              size={20}
              iconColor={COLORS.alta}
              onPress={handleDelete}
              style={styles.actionButton}
            />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  card: {
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 5,
    borderLeftColor: '#2196F3', // blu
  },
  contentContainer: {
    flexDirection: 'row',
    padding: 12,
  },
  priorityIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  iconContainer: {
    marginRight: 8,
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#444',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#777',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    margin: 0,
  },
});

export default NotificaItem; 