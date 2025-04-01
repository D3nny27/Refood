/**
 * Script per monitorare le risorse del server durante i test di performance
 * Da eseguire in parallelo con i test k6
 * 
 * Requisiti:
 * - Node.js
 * - Pacchetti: systeminformation, chart.js, canvas
 */

const si = require('systeminformation');
const fs = require('fs');
const { createCanvas } = require('canvas');
const Chart = require('chart.js/auto');
const path = require('path');

// Configurazione
const CONFIG = {
  monitoringDuration: process.env.DURATION || 300, // secondi (default: 5 minuti)
  samplingInterval: process.env.INTERVAL || 1,     // secondi
  outputDir: '../../test_results/server_metrics',
  scenario: process.env.SCENARIO || 'unknown'
};

// Crea directory di output se non esiste
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// Inizializza array per le metriche
const metrics = {
  timestamp: [],
  cpu: [],
  memory: {
    used: [],
    total: []
  },
  networkRx: [],
  networkTx: [],
  diskIO: {
    read: [],
    write: []
  },
  loadavg: []
};

// Funzione per raccogliere i dati
async function collectMetrics() {
  try {
    // CPU
    const cpuData = await si.currentLoad();
    metrics.cpu.push(cpuData.currentLoad);
    
    // Memoria
    const memData = await si.mem();
    metrics.memory.used.push(memData.used / 1024 / 1024); // MB
    metrics.memory.total.push(memData.total / 1024 / 1024); // MB
    
    // Network
    const netData = await si.networkStats();
    if (netData.length > 0) {
      metrics.networkRx.push(netData[0].rx_sec / 1024); // KB/s
      metrics.networkTx.push(netData[0].tx_sec / 1024); // KB/s
    } else {
      metrics.networkRx.push(0);
      metrics.networkTx.push(0);
    }
    
    // Disk IO
    const diskData = await si.disksIO();
    metrics.diskIO.read.push(diskData.rIO_sec || 0);
    metrics.diskIO.write.push(diskData.wIO_sec || 0);
    
    // Load Average (1 minuto)
    const loadData = await si.currentLoad();
    metrics.loadavg.push(loadData.avgLoad);
    
    // Timestamp
    metrics.timestamp.push(new Date());
    
    console.log(`[${new Date().toISOString()}] Metriche raccolte - CPU: ${cpuData.currentLoad.toFixed(2)}%, MEM: ${(memData.used / 1024 / 1024 / 1024).toFixed(2)} GB`);
  } catch (error) {
    console.error('Errore nella raccolta delle metriche:', error);
  }
}

// Funzione per generare grafici
async function generateCharts() {
  console.log('Generazione grafici...');
  
  // Prepara timestamps per i grafici (formato HH:MM:SS)
  const labels = metrics.timestamp.map(timestamp => 
    timestamp.toISOString().substr(11, 8)
  );
  
  // Funzione per generare un grafico
  async function createChart(config) {
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');
    
    const chart = new Chart(ctx, {
      type: config.type || 'line',
      data: {
        labels: labels,
        datasets: config.datasets
      },
      options: {
        scales: {
          y: {
            beginAtZero: config.beginAtZero !== undefined ? config.beginAtZero : true
          }
        },
        plugins: {
          title: {
            display: true,
            text: config.title
          }
        }
      }
    });
    
    // Salva il grafico come immagine
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(CONFIG.outputDir, `${config.filename}.png`), buffer);
    chart.destroy();
  }
  
  // Grafico CPU
  await createChart({
    title: 'Utilizzo CPU durante il test',
    filename: `${CONFIG.scenario}_cpu`,
    beginAtZero: true,
    datasets: [{
      label: 'CPU %',
      data: metrics.cpu,
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }]
  });
  
  // Grafico Memoria
  await createChart({
    title: 'Utilizzo Memoria durante il test',
    filename: `${CONFIG.scenario}_memory`,
    beginAtZero: true,
    datasets: [{
      label: 'Memoria Usata (MB)',
      data: metrics.memory.used,
      borderColor: 'rgb(255, 99, 132)',
      tension: 0.1
    }]
  });
  
  // Grafico Network
  await createChart({
    title: 'Traffico di Rete durante il test',
    filename: `${CONFIG.scenario}_network`,
    beginAtZero: true,
    datasets: [
      {
        label: 'Download (KB/s)',
        data: metrics.networkRx,
        borderColor: 'rgb(54, 162, 235)',
        tension: 0.1
      },
      {
        label: 'Upload (KB/s)',
        data: metrics.networkTx,
        borderColor: 'rgb(255, 159, 64)',
        tension: 0.1
      }
    ]
  });
  
  // Grafico Disk IO
  await createChart({
    title: 'Operazioni Disco durante il test',
    filename: `${CONFIG.scenario}_disk`,
    beginAtZero: true,
    datasets: [
      {
        label: 'Letture/s',
        data: metrics.diskIO.read,
        borderColor: 'rgb(153, 102, 255)',
        tension: 0.1
      },
      {
        label: 'Scritture/s',
        data: metrics.diskIO.write,
        borderColor: 'rgb(255, 205, 86)',
        tension: 0.1
      }
    ]
  });
  
  // Grafico Load Average
  await createChart({
    title: 'Carico di Sistema durante il test',
    filename: `${CONFIG.scenario}_load`,
    beginAtZero: true,
    datasets: [{
      label: 'Load Average (1m)',
      data: metrics.loadavg,
      borderColor: 'rgb(201, 203, 207)',
      tension: 0.1
    }]
  });
  
  console.log(`Grafici generati nella directory: ${CONFIG.outputDir}`);
}

// Funzione per salvare i dati grezzi
function saveRawData() {
  const filename = path.join(CONFIG.outputDir, `${CONFIG.scenario}_raw_data.json`);
  fs.writeFileSync(filename, JSON.stringify(metrics, null, 2));
  console.log(`Dati grezzi salvati in: ${filename}`);
}

// Funzione principale
async function main() {
  console.log(`
========================================================
  MONITORAGGIO RISORSE SERVER - SCENARIO: ${CONFIG.scenario}
========================================================
Durata: ${CONFIG.monitoringDuration} secondi
Intervallo: ${CONFIG.samplingInterval} secondi
Output: ${CONFIG.outputDir}
`);

  // Avvia il monitoraggio a intervalli regolari
  const intervalId = setInterval(collectMetrics, CONFIG.samplingInterval * 1000);
  
  // Termina il monitoraggio dopo la durata specificata
  setTimeout(async () => {
    clearInterval(intervalId);
    console.log('Monitoraggio completato, generazione dei report...');
    saveRawData();
    await generateCharts();
    console.log('Processo completato.');
  }, CONFIG.monitoringDuration * 1000);
}

// Avvia il programma
main().catch(error => {
  console.error('Errore nel programma principale:', error);
  process.exit(1);
}); 