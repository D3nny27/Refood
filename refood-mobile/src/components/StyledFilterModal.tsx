import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Modal, Portal, Text, Button, Divider, Surface, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PRIMARY_COLOR, STATUS_COLORS } from '../config/constants';

interface StyledFilterModalProps {
  visible: boolean;
  onDismiss: () => void;
  onApply: () => void;
  onReset: () => void;
  title?: string;
  // Proprietà opzionali per il filtro sullo stato
  selectedStato?: string | null;
  setSelectedStato?: (stato: string | null) => void;
  // Permette di passare contenuto personalizzato
  children?: React.ReactNode;
}

const StyledFilterModal: React.FC<StyledFilterModalProps> = ({
  visible,
  onDismiss,
  onApply,
  onReset,
  title = "Filtri avanzati",
  selectedStato,
  setSelectedStato,
  children
}) => {
  // Verifica se utilizzare l'approccio preesistente o quello basato su children
  const useCustomContent = Boolean(children);
  
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <Surface style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <MaterialCommunityIcons name="filter-variant" size={24} color={PRIMARY_COLOR} />
          </View>
          <Divider />
          
          <ScrollView style={styles.modalBody}>
            {useCustomContent ? (
              // Utilizzo il contenuto personalizzato passato come children
              children
            ) : (
              // Utilizzo il comportamento predefinito del componente
              <>
                {setSelectedStato && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Stato del lotto</Text>
                    <Text style={styles.sectionDescription}>
                      Lo stato viene calcolato automaticamente in base alla data di scadenza:
                    </Text>
                    <View style={styles.stateFilters}>
                      <Chip
                        selected={selectedStato === 'Verde'}
                        onPress={() => setSelectedStato(selectedStato === 'Verde' ? null : 'Verde')}
                        style={[styles.stateChip, {borderColor: STATUS_COLORS.SUCCESS}, selectedStato === 'Verde' ? {backgroundColor: STATUS_COLORS.SUCCESS} : {}]}
                        selectedColor="#fff"
                        mode="outlined"
                        showSelectedCheck
                      >
                        Verde
                      </Chip>
                      <Chip
                        selected={selectedStato === 'Arancione'}
                        onPress={() => setSelectedStato(selectedStato === 'Arancione' ? null : 'Arancione')}
                        style={[styles.stateChip, {borderColor: STATUS_COLORS.WARNING}, selectedStato === 'Arancione' ? {backgroundColor: STATUS_COLORS.WARNING} : {}]}
                        selectedColor="#fff"
                        mode="outlined"
                        showSelectedCheck
                      >
                        Arancione
                      </Chip>
                      <Chip
                        selected={selectedStato === 'Rosso'}
                        onPress={() => setSelectedStato(selectedStato === 'Rosso' ? null : 'Rosso')}
                        style={[styles.stateChip, {borderColor: STATUS_COLORS.ERROR}, selectedStato === 'Rosso' ? {backgroundColor: STATUS_COLORS.ERROR} : {}]}
                        selectedColor="#fff"
                        mode="outlined"
                        showSelectedCheck
                      >
                        Rosso
                      </Chip>
                    </View>
                    <View style={styles.stateDescriptions}>
                      <Text style={styles.stateDescription}>
                        <Text style={{fontWeight: 'bold', color: STATUS_COLORS.SUCCESS}}>Verde:</Text> Lontano dalla scadenza
                      </Text>
                      <Text style={styles.stateDescription}>
                        <Text style={{fontWeight: 'bold', color: STATUS_COLORS.WARNING}}>Arancione:</Text> Vicino alla scadenza
                      </Text>
                      <Text style={styles.stateDescription}>
                        <Text style={{fontWeight: 'bold', color: STATUS_COLORS.ERROR}}>Rosso:</Text> Molto vicino/scaduto
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
          
          <Divider />
          <View style={styles.modalFooter}>
            <Button 
              mode="text" 
              onPress={onReset}
              style={styles.footerButton}
              icon="refresh"
            >
              Azzera
            </Button>
            <View style={styles.footerActions}>
              <Button 
                mode="outlined" 
                onPress={onDismiss}
                style={styles.footerButton}
              >
                Annulla
              </Button>
              <Button 
                mode="contained" 
                onPress={onApply}
                style={[styles.footerButton, styles.applyButton]}
                icon="check"
              >
                Applica
              </Button>
            </View>
          </View>
        </Surface>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    maxHeight: 500,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#555',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  stateFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  stateChip: {
    margin: 4,
  },
  stateDescriptions: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  stateDescription: {
    fontSize: 13,
    marginBottom: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  footerActions: {
    flexDirection: 'row',
  },
  footerButton: {
    marginLeft: 8,
  },
  applyButton: {
    backgroundColor: PRIMARY_COLOR,
  },
});

export default StyledFilterModal; 