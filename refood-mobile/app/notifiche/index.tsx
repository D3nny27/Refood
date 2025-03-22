import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Appbar, Button, Text, Chip, Divider, Menu, Portal, Dialog } from 'react-native-paper';
import { useNotifiche } from '../../src/context/NotificheContext';
import NotificaItem from '../../src/components/NotificaItem';
import { NotificaFiltri, Notifica } from '../../src/types/notification';
import pushNotificationService from '../../src/services/pushNotificationService';
import Toast from 'react-native-toast-message';

export default function NotificheScreen() {
  const { 
    notifiche, 
    loading, 
    error, 
    caricaNotifiche, 
    refreshNotifiche, 
    segnaTutteLette 
  } = useNotifiche();
  
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [filterDialogVisible, setFilterDialogVisible] = useState(false);
  const [filtri, setFiltri] = useState<NotificaFiltri>({});
  const [filtriFiltro, setFiltriFiltro] = useState<NotificaFiltri>({});
  const [initialLoadCompleted, setInitialLoadCompleted] = useState(false);
  const lastLoadTimeRef = useRef<number>(0);
  
  // Carica i dati solo la prima volta o quando la schermata è a fuoco
  useFocusEffect(
    useCallback(() => {
      // Se il caricamento è già in corso, non fare nulla
      if (loading || refreshing) return;
      
      const now = Date.now();
      const timeSinceLastLoad = now - lastLoadTimeRef.current;
      const REFRESH_THRESHOLD = 60000; // 1 minuto
      
      // Carica solo se non abbiamo ancora fatto un caricamento iniziale
      // o se è passato abbastanza tempo dall'ultimo caricamento
      if (!initialLoadCompleted || timeSinceLastLoad > REFRESH_THRESHOLD) {
        const loadNotifiche = async () => {
          try {
            await refreshNotifiche();
            setInitialLoadCompleted(true);
            lastLoadTimeRef.current = Date.now();
          } catch (error) {
            console.error('Errore durante il caricamento delle notifiche:', error);
          }
        };
        
        loadNotifiche();
      }
    }, [refreshNotifiche, loading, refreshing, initialLoadCompleted])
  );
  
  // Gestisce il refresh delle notifiche
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshNotifiche();
      lastLoadTimeRef.current = Date.now();
    } catch (error) {
      console.error('Errore durante il refresh delle notifiche:', error);
    } finally {
      setRefreshing(false);
    }
  };
  
  // Carica più notifiche
  const loadMoreNotifiche = async () => {
    if (loadingMore || loading) return;
    
    setLoadingMore(true);
    await caricaNotifiche(page + 1, 20, filtri);
    setPage(page + 1);
    setLoadingMore(false);
  };
  
  // Gestisce la pressione su una notifica
  const handleNotificaPress = (notifica: Notifica) => {
    // Verifica che l'ID sia valido
    if (!notifica || !notifica.id || isNaN(Number(notifica.id))) {
      console.error('Tentativo di navigare a una notifica con ID non valido:', notifica?.id);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Impossibile aprire questa notifica',
        visibilityTime: 3000,
      });
      return;
    }
    
    // Navighiamo alla pagina di dettaglio con il formato corretto
    router.push({
      pathname: "/notifiche/[id]",
      params: { id: String(notifica.id) }
    });
  };
  
  // Gestisce il segna tutte come lette
  const handleMarkAllAsRead = async () => {
    await segnaTutteLette();
    setMenuVisible(false);
  };
  
  // Gestisce l'applicazione dei filtri
  const applyFilters = () => {
    setFiltri(filtriFiltro);
    setFilterDialogVisible(false);
    setPage(1);
    caricaNotifiche(1, 20, filtriFiltro);
  };
  
  // Gestisce la cancellazione dei filtri
  const clearFilters = () => {
    setFiltriFiltro({});
    setFilterDialogVisible(false);
  };
  
  // Verifica se i filtri sono attivi
  const hasActiveFilters = () => {
    return Object.keys(filtri).length > 0;
  };
  
  // Renderizza un chip per il filtro attivo
  const renderFilterChips = () => {
    const chips = [];
    
    if (filtri.tipo) {
      chips.push(
        <Chip 
          key="tipo" 
          style={styles.filterChip}
          onClose={() => {
            const newFiltri = { ...filtri };
            delete newFiltri.tipo;
            setFiltri(newFiltri);
            setFiltriFiltro(newFiltri);
            caricaNotifiche(1, 20, newFiltri);
          }}
        >
          Tipo: {filtri.tipo}
        </Chip>
      );
    }
    
    if (filtri.priorita) {
      chips.push(
        <Chip 
          key="priorita" 
          style={styles.filterChip}
          onClose={() => {
            const newFiltri = { ...filtri };
            delete newFiltri.priorita;
            setFiltri(newFiltri);
            setFiltriFiltro(newFiltri);
            caricaNotifiche(1, 20, newFiltri);
          }}
        >
          Priorità: {filtri.priorita}
        </Chip>
      );
    }
    
    if (filtri.letta !== undefined) {
      chips.push(
        <Chip 
          key="letta" 
          style={styles.filterChip}
          onClose={() => {
            const newFiltri = { ...filtri };
            delete newFiltri.letta;
            setFiltri(newFiltri);
            setFiltriFiltro(newFiltri);
            caricaNotifiche(1, 20, newFiltri);
          }}
        >
          {filtri.letta ? 'Lette' : 'Non lette'}
        </Chip>
      );
    }
    
    return chips;
  };
  
  // Renderizza il footer della lista
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" />
      </View>
    );
  };
  
  // Renderizza un messaggio di errore
  const renderError = () => {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={onRefresh} style={styles.retryButton}>
          Riprova
        </Button>
      </View>
    );
  };
  
  // Renderizza un messaggio quando non ci sono notifiche
  const renderEmpty = () => {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>
          {hasActiveFilters() 
            ? 'Nessuna notifica corrisponde ai filtri applicati.' 
            : 'Non hai notifiche al momento.'}
        </Text>
        {hasActiveFilters() && (
          <Button 
            mode="outlined" 
            onPress={() => {
              setFiltri({});
              setFiltriFiltro({});
              caricaNotifiche(1, 20, {});
            }}
            style={styles.clearFiltersButton}
          >
            Cancella filtri
          </Button>
        )}
      </View>
    );
  };
  
  // Nel componente NotificheScreen, aggiungi un metodo per inviare una notifica di test
  const inviaNotificaTest = async () => {
    await pushNotificationService.sendLocalNotification(
      'Notifica di Test',
      'Questa è una notifica di test per verificare il funzionamento del sistema.',
      { type: 'notifica' }
    );
    
    Toast.show({
      type: 'success',
      text1: 'Notifica di test inviata',
      text2: 'Controlla la barra delle notifiche del dispositivo',
      visibilityTime: 3000,
    });
  };
  
  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Notifiche',
          headerShown: false
        }} 
      />
      
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Notifiche" />
        <Appbar.Action icon="filter" onPress={() => setFilterDialogVisible(true)} />
        <Appbar.Action icon="dots-vertical" onPress={() => setMenuVisible(true)} />
        <Appbar.Action 
          icon="bell-ring" 
          onPress={inviaNotificaTest} 
          color="#4CAF50" 
          style={{marginRight: 5}}
        />
      </Appbar.Header>
      
      {hasActiveFilters() && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderFilterChips()}
          </ScrollView>
        </View>
      )}
      
      {loading && !refreshing && notifiche.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Caricamento notifiche...</Text>
        </View>
      ) : error ? (
        renderError()
      ) : (
        <FlatList
          data={notifiche}
          renderItem={({ item }) => (
            <NotificaItem
              notifica={item}
              onPress={() => handleNotificaPress(item)}
            />
          )}
          keyExtractor={item => item.id.toString()}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={['#4CAF50']} 
            />
          }
          onEndReached={loadMoreNotifiche}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={loading ? null : renderEmpty()}
          contentContainerStyle={notifiche.length === 0 ? styles.emptyListContainer : undefined}
        />
      )}
      
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={{ x: 0, y: 0 }}
        style={styles.menu}
      >
        <Menu.Item 
          onPress={handleMarkAllAsRead} 
          title="Segna tutte come lette" 
          leadingIcon="check-all"
        />
        <Divider />
        <Menu.Item 
          onPress={() => {
            setFiltri({ letta: false });
            setFiltriFiltro({ letta: false });
            caricaNotifiche(1, 20, { letta: false });
            setMenuVisible(false);
          }} 
          title="Mostra solo non lette" 
          leadingIcon="bell"
        />
        <Menu.Item 
          onPress={() => {
            setFiltri({});
            setFiltriFiltro({});
            caricaNotifiche(1, 20, {});
            setMenuVisible(false);
          }} 
          title="Mostra tutte" 
          leadingIcon="bell-outline"
        />
      </Menu>
      
      <Portal>
        <Dialog
          visible={filterDialogVisible}
          onDismiss={() => setFilterDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Filtra notifiche</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.filterLabel}>Tipo</Text>
            <View style={styles.chipContainer}>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, tipo: 'CambioStato' })}>
                <Chip 
                  selected={filtriFiltro.tipo === 'CambioStato'}
                  style={styles.chipFilter}
                >
                  Cambio Stato
                </Chip>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, tipo: 'Prenotazione' })}>
                <Chip 
                  selected={filtriFiltro.tipo === 'Prenotazione'}
                  style={styles.chipFilter}
                >
                  Prenotazione
                </Chip>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, tipo: 'Alert' })}>
                <Chip 
                  selected={filtriFiltro.tipo === 'Alert'}
                  style={styles.chipFilter}
                >
                  Alert
                </Chip>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.filterLabel}>Priorità</Text>
            <View style={styles.chipContainer}>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, priorita: 'Alta' })}>
                <Chip 
                  selected={filtriFiltro.priorita === 'Alta'}
                  style={styles.chipFilter}
                >
                  Alta
                </Chip>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, priorita: 'Media' })}>
                <Chip 
                  selected={filtriFiltro.priorita === 'Media'}
                  style={styles.chipFilter}
                >
                  Media
                </Chip>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, priorita: 'Bassa' })}>
                <Chip 
                  selected={filtriFiltro.priorita === 'Bassa'}
                  style={styles.chipFilter}
                >
                  Bassa
                </Chip>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.filterLabel}>Stato</Text>
            <View style={styles.chipContainer}>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, letta: true })}>
                <Chip 
                  selected={filtriFiltro.letta === true}
                  style={styles.chipFilter}
                >
                  Lette
                </Chip>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, letta: false })}>
                <Chip 
                  selected={filtriFiltro.letta === false}
                  style={styles.chipFilter}
                >
                  Non lette
                </Chip>
              </TouchableOpacity>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={clearFilters}>Cancella</Button>
            <Button onPress={applyFilters}>Applica</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
  },
  clearFiltersButton: {
    marginTop: 8,
  },
  menu: {
    position: 'absolute',
    top: 56,
    right: 8,
  },
  dialog: {
    borderRadius: 8,
  },
  filterLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 8,
  },
  chipFilter: {
    margin: 4,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterChip: {
    marginRight: 8,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
}); 