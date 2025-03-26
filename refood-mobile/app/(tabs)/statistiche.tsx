import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Dimensions, RefreshControl, TouchableOpacity, Share, Platform } from 'react-native';
import { Text, Card, Title, Paragraph, Button, Divider, Menu, Appbar, Chip } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import {
  LineChart,
  BarChart,
  PieChart,
  ProgressChart,
} from 'react-native-chart-kit';
import { useAuth } from '../../src/context/AuthContext';
import statisticheService, {
  StatisticheCompleteResponse,
  StatisticheGenerali,
  StatistichePerPeriodo,
  StatisticheCompletamento
} from '../../src/services/statisticheService';
import logger from '../../src/utils/logger';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

// Costanti per il grafico
const screenWidth = Dimensions.get('window').width - 32; // Larghezza schermo meno padding
const CHART_HEIGHT = 220;

const CHART_CONFIG = {
  backgroundColor: '#fff',
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '6',
    strokeWidth: '2',
    stroke: '#4CAF50',
  },
};

// Periodi disponibili per le statistiche
const PERIODI = [
  { label: 'Ultimi 12 mesi', value: 'ultimi_12_mesi' },
  { label: 'Ultimi 6 mesi', value: 'ultimi_6_mesi' },
  { label: 'Ultimi 3 mesi', value: 'ultimi_3_mesi' },
  { label: 'Ultimo mese', value: 'ultimo_mese' },
];

export default function StatisticheScreen() {
  const { user } = useAuth();
  const [statistiche, setStatistiche] = useState<StatisticheCompleteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [periodoSelezionato, setPeriodoSelezionato] = useState(PERIODI[0].value);
  const [periodoMenuVisible, setPeriodoMenuVisible] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  // Carica le statistiche
  const loadStatistiche = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Carica i dati delle statistiche
      const data = await statisticheService.getStatisticheComplete(forceRefresh);
      setStatistiche(data);
      logger.log('Statistiche caricate con successo');
    } catch (err) {
      logger.error('Errore durante il caricamento delle statistiche:', err);
      setError('Impossibile caricare le statistiche. Riprova più tardi.');
      
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Impossibile caricare le statistiche',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  // Effetto per caricare le statistiche all'apertura della schermata
  useFocusEffect(
    useCallback(() => {
      loadStatistiche();
    }, [loadStatistiche])
  );
  
  // Effetto per ricaricare le statistiche quando cambia il periodo selezionato
  useEffect(() => {
    if (periodoSelezionato) {
      loadStatistiche(true);
    }
  }, [periodoSelezionato, loadStatistiche]);
  
  // Gestisce il refresh pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStatistiche(true);
  }, [loadStatistiche]);
  
  // Formatta i numeri per la visualizzazione
  const formatNumber = (num: number, decimals = 0) => {
    return num.toLocaleString('it-IT', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };
  
  // Formatta i valori monetari
  const formatCurrency = (value: number) => {
    return value.toLocaleString('it-IT', {
      style: 'currency',
      currency: 'EUR',
    });
  };
  
  // Esporta i dati delle statistiche
  const exportStatistiche = async () => {
    try {
      setExportLoading(true);
      
      // Esporta le statistiche in formato CSV
      const csvData = await statisticheService.esportaStatisticheCSV(periodoSelezionato);
      
      // Condividi il file CSV
      await Share.share({
        message: 'Statistiche ReFood',
        title: `Statistiche_ReFood_${format(new Date(), 'yyyy-MM-dd')}.csv`,
        url: Platform.OS === 'ios' ? csvData : `data:text/csv;base64,${Buffer.from(csvData).toString('base64')}`,
      });
      
      Toast.show({
        type: 'success',
        text1: 'Esportazione completata',
        text2: 'Le statistiche sono state esportate con successo',
        visibilityTime: 3000,
      });
    } catch (err) {
      logger.error('Errore durante l\'esportazione delle statistiche:', err);
      
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Impossibile esportare le statistiche',
        visibilityTime: 3000,
      });
    } finally {
      setExportLoading(false);
    }
  };
  
  // Restituisce i dati per il grafico dell'andamento dei salvataggi
  const getSalvataggioChartData = () => {
    if (!statistiche?.perPeriodo) return null;
    
    const labels = statistiche.perPeriodo.map(periodo => {
      // Formatta l'etichetta in base al formato del periodo (es. "2023-01" diventa "Gen")
      const parts = periodo.periodo.split('-');
      if (parts.length === 2) {
        const monthNumber = parseInt(parts[1]) - 1; // mese da 0 a 11
        return format(new Date(2000, monthNumber, 1), 'MMM', { locale: it }).charAt(0).toUpperCase() + format(new Date(2000, monthNumber, 1), 'MMM', { locale: it }).slice(1);
      }
      return periodo.periodo;
    });
    
    return {
      labels,
      datasets: [
        {
          data: statistiche.perPeriodo.map(periodo => periodo.quantitaAlimentiSalvati),
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
          strokeWidth: 2,
        },
      ],
      legend: ['Kg di alimenti salvati'],
    };
  };
  
  // Restituisce i dati per il grafico delle categorie
  const getCategorieChartData = () => {
    if (!statistiche?.perCategoria) return null;
    
    // Colori per le categorie
    const colors = [
      '#4CAF50', // verde
      '#8BC34A', // lime
      '#CDDC39', // giallo-verde
      '#FFC107', // giallo
      '#FF9800', // arancione
      '#FF5722', // rosso-arancio
    ];
    
    return statistiche.perCategoria.map((categoria, index) => ({
      name: categoria.nome,
      population: categoria.quantita,
      color: colors[index % colors.length],
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    }));
  };
  
  // Restituisce i dati per il grafico del tasso di completamento
  const getCompletamentoChartData = () => {
    if (!statistiche?.completamento || !Array.isArray(statistiche.completamento) || statistiche.completamento.length === 0) return null;
    
    const labels = statistiche.completamento.map(item => {
      // Formatta l'etichetta in base al formato del periodo (es. "2023-01" diventa "Gen")
      try {
        const parts = item.periodo?.split('-');
        if (parts && parts.length === 2) {
          const monthNumber = parseInt(parts[1], 10) - 1; // mese da 0 a 11
          if (!isNaN(monthNumber) && monthNumber >= 0 && monthNumber < 12) {
            return format(new Date(2000, monthNumber, 1), 'MMM', { locale: it }).charAt(0).toUpperCase() + format(new Date(2000, monthNumber, 1), 'MMM', { locale: it }).slice(1);
          }
        }
        return item.periodo || 'N/A';
      } catch (error) {
        logger.error('Errore nella formattazione del periodo:', error);
        return 'N/A';
      }
    });
    
    // Calcola i tassi di completamento per il grafico con verifica dei valori numerici
    const tassi = statistiche.completamento.map(item => {
      // Verifica se il valore è un numero valido
      let tasso = 0;
      if (typeof item.percentualeCompletamento === 'number' && !isNaN(item.percentualeCompletamento)) {
        tasso = Math.max(0, Math.min(1, item.percentualeCompletamento / 100)); // Limita tra 0 e 1
      } else if (item.completate && item.annullate) {
        // Se possibile, calcola il tasso dai valori grezzi
        const totale = item.completate + item.annullate;
        tasso = totale > 0 ? Math.max(0, Math.min(1, item.completate / totale)) : 0;
      }
      return tasso;
    });
    
    // Verifica ulteriormente che non ci siano valori NaN
    const validTassi = tassi.every(t => typeof t === 'number' && !isNaN(t)) ? tassi : tassi.map(t => typeof t === 'number' && !isNaN(t) ? t : 0);
    
    return {
      labels,
      data: validTassi, // Array semplice di numeri (non annidato) per ProgressChart
    };
  };
  
  // Restituisce i dati per il grafico di CO2 risparmiata
  const getCO2ChartData = () => {
    if (!statistiche?.perPeriodo) return null;
    
    const labels = statistiche.perPeriodo.map(periodo => {
      // Formatta l'etichetta in base al formato del periodo
      const parts = periodo.periodo.split('-');
      if (parts.length === 2) {
        const monthNumber = parseInt(parts[1]) - 1; // mese da 0 a 11
        return format(new Date(2000, monthNumber, 1), 'MMM', { locale: it }).charAt(0).toUpperCase() + format(new Date(2000, monthNumber, 1), 'MMM', { locale: it }).slice(1);
      }
      return periodo.periodo;
    });
    
    return {
      labels,
      datasets: [
        {
          data: statistiche.perPeriodo.map(periodo => periodo.co2Risparmiata),
          color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
          strokeWidth: 2,
        },
      ],
      legend: ['Kg di CO2 risparmiata'],
    };
  };
  
  // Restituisce i dati per il grafico dei tempi di prenotazione
  const getTempiPrenotazioneChartData = () => {
    if (!statistiche?.tempoPrenotazione?.distribuzioneTempi) return null;
    
    const labels = statistiche.tempoPrenotazione.distribuzioneTempi.map(item => item.intervallo);
    
    return {
      labels,
      datasets: [
        {
          data: statistiche.tempoPrenotazione.distribuzioneTempi.map(item => item.conteggio),
          color: (opacity = 1) => `rgba(156, 39, 176, ${opacity})`,
          strokeWidth: 2,
        },
      ],
      legend: ['Numero di prenotazioni per tempo di risposta'],
    };
  };
  
  // Calcola l'equivalente in alberi della CO2 risparmiata
  const getAlberiEquivalenti = () => {
    if (!statistiche?.generali?.co2Risparmiata) return 0;
    
    // Un albero assorbe in media 22kg di CO2 all'anno
    return Math.round(statistiche.generali.co2Risparmiata / 22);
  };
  
  // Renderizza i KPI principali
  const renderKPI = () => {
    if (!statistiche?.generali) return null;
    
    const { totaleAlimentiSalvati, co2Risparmiata, valoreEconomicoRisparmiato, numeroLottiSalvati } = statistiche.generali;
    
    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Impatto del recupero alimentare</Title>
          
          <View style={styles.kpiGrid}>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{formatNumber(totaleAlimentiSalvati)}</Text>
              <Text style={styles.kpiLabel}>Kg salvati</Text>
            </View>
            
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{formatNumber(co2Risparmiata)}</Text>
              <Text style={styles.kpiLabel}>Kg CO₂ evitata</Text>
            </View>
            
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{formatNumber(numeroLottiSalvati)}</Text>
              <Text style={styles.kpiLabel}>Lotti salvati</Text>
            </View>
            
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{formatCurrency(valoreEconomicoRisparmiato)}</Text>
              <Text style={styles.kpiLabel}>Valore salvato</Text>
            </View>
          </View>
          
          <View style={styles.impactContainer}>
            <View style={styles.treeImpact}>
              <Ionicons name="leaf" size={24} color="#4CAF50" />
              <Text style={styles.impactText}>
                Equivalente a {getAlberiEquivalenti()} alberi per un anno
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };
  
  // Renderizza il grafico dell'andamento dei salvataggi
  const renderSalvataggioChart = () => {
    const data = getSalvataggioChartData();
    if (!data) return null;
    
    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.chartTitle}>Andamento alimenti salvati</Title>
          <Paragraph style={styles.chartSubtitle}>Quantità in kg per periodo</Paragraph>
          
          <LineChart
            data={data}
            width={screenWidth}
            height={CHART_HEIGHT}
            chartConfig={CHART_CONFIG}
            bezier
            style={styles.chart}
          />
        </Card.Content>
      </Card>
    );
  };
  
  // Renderizza il grafico delle categorie
  const renderCategorieChart = () => {
    const data = getCategorieChartData();
    if (!data) return null;
    
    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.chartTitle}>Distribuzione per categorie</Title>
          <Paragraph style={styles.chartSubtitle}>Quantità salvata per tipologia</Paragraph>
          
          <PieChart
            data={data}
            width={screenWidth}
            height={CHART_HEIGHT}
            chartConfig={CHART_CONFIG}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </Card.Content>
      </Card>
    );
  };
  
  // Renderizza il grafico del tasso di completamento
  const renderCompletamentoChart = () => {
    const data = getCompletamentoChartData();
    if (!data) return null;
    
    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.chartTitle}>Tasso di completamento</Title>
          <Paragraph style={styles.chartSubtitle}>Percentuale prenotazioni completate</Paragraph>
          
          <ProgressChart
            data={data}
            width={screenWidth}
            height={CHART_HEIGHT}
            chartConfig={{
              ...CHART_CONFIG,
              color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
            }}
            strokeWidth={16}
            radius={32}
            hideLegend={false}
          />
        </Card.Content>
      </Card>
    );
  };
  
  // Renderizza il grafico della CO2 risparmiata
  const renderCO2Chart = () => {
    const data = getCO2ChartData();
    if (!data) return null;
    
    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.chartTitle}>Impatto ambientale</Title>
          <Paragraph style={styles.chartSubtitle}>CO₂ risparmiata in kg</Paragraph>
          
          <LineChart
            data={data}
            width={screenWidth}
            height={CHART_HEIGHT}
            chartConfig={{
              ...CHART_CONFIG,
              color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
            }}
            bezier
            style={styles.chart}
          />
        </Card.Content>
      </Card>
    );
  };
  
  // Renderizza il grafico dei tempi di prenotazione
  const renderTempiPrenotazioneChart = () => {
    const data = getTempiPrenotazioneChartData();
    if (!data) return null;
    
    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.chartTitle}>Tempi di prenotazione</Title>
          <Paragraph style={styles.chartSubtitle}>Distribuzione per intervalli temporali</Paragraph>
          
          <BarChart
            data={data}
            width={screenWidth}
            height={CHART_HEIGHT}
            chartConfig={{
              ...CHART_CONFIG,
              color: (opacity = 1) => `rgba(156, 39, 176, ${opacity})`,
            }}
            style={styles.chart}
            verticalLabelRotation={30}
            yAxisLabel=""
            yAxisSuffix=""
          />
          
          {statistiche?.tempoPrenotazione && (
            <View style={styles.averageTimeContainer}>
              <Text style={styles.averageTimeText}>
                Tempo medio: {statistiche.tempoPrenotazione.tempoMedio.toFixed(1)} ore
              </Text>
              <Text style={styles.averageTimeText}>
                Tempo mediano: {statistiche.tempoPrenotazione.tempoMediano.toFixed(1)} ore
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };
  
  // Renderizza il selettore di periodo
  const renderPeriodoSelector = () => {
    const periodoAttuale = PERIODI.find(p => p.value === periodoSelezionato);
    
    return (
      <View style={styles.periodSelectorContainer}>
        <Text style={styles.periodLabel}>Periodo:</Text>
        <Menu
          visible={periodoMenuVisible}
          onDismiss={() => setPeriodoMenuVisible(false)}
          anchor={
            <TouchableOpacity
              style={styles.periodSelector}
              onPress={() => setPeriodoMenuVisible(true)}
            >
              <Text style={styles.periodSelectorText}>{periodoAttuale?.label || 'Seleziona periodo'}</Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          }
        >
          {PERIODI.map((periodo) => (
            <Menu.Item
              key={periodo.value}
              onPress={() => {
                setPeriodoSelezionato(periodo.value);
                setPeriodoMenuVisible(false);
              }}
              title={periodo.label}
            />
          ))}
        </Menu>
      </View>
    );
  };
  
  // Gestisce lo scroll a fine pagina
  const handleEndReached = () => {
    // Potremmo implementare il caricamento di dati aggiuntivi qui se necessario
    logger.log('Fine della pagina raggiunta');
  };
  
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Statistiche e Reportistica" />
        {!loading && (
          <Appbar.Action
            icon="file-export-outline"
            disabled={exportLoading}
            onPress={exportStatistiche}
          />
        )}
      </Appbar.Header>
      
      {renderPeriodoSelector()}
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Caricamento statistiche...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={() => loadStatistiche(true)} style={styles.retryButton}>
            Riprova
          </Button>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4CAF50']}
            />
          }
          onScrollEndDrag={handleEndReached}
        >
          {renderKPI()}
          
          <Divider style={styles.divider} />
          
          <View style={styles.chartsContainer}>
            {renderSalvataggioChart()}
            {renderCO2Chart()}
            {renderCategorieChart()}
            {renderCompletamentoChart()}
            {renderTempiPrenotazioneChart()}
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              I dati vengono aggiornati quotidianamente
            </Text>
            <Text style={styles.footerTimestamp}>
              Ultimo aggiornamento: {format(new Date(), 'dd/MM/yyyy HH:mm')}
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
    borderRadius: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kpiItem: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  impactContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  treeImpact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  impactText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1B5E20',
  },
  divider: {
    marginVertical: 16,
  },
  chartsContainer: {
    marginTop: 8,
  },
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  footerTimestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  periodSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  periodSelectorText: {
    fontSize: 14,
    marginRight: 8,
  },
  averageTimeContainer: {
    marginTop: 16,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
  },
  averageTimeText: {
    fontSize: 14,
    marginBottom: 4,
  },
}); 