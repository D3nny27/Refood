/**
 * Script per l'analisi comparativa dei risultati dei test di performance
 * Questo script prende due o più file JSON di risultati di k6 e genera un report comparativo
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const Chart = require('chart.js/auto');

// Configura i colori per i grafici
const CHART_COLORS = [
  'rgb(75, 192, 192)',   // teal
  'rgb(255, 99, 132)',   // rosa
  'rgb(54, 162, 235)',   // blu
  'rgb(255, 159, 64)',   // arancione
  'rgb(153, 102, 255)',  // viola
  'rgb(255, 205, 86)',   // giallo
  'rgb(201, 203, 207)'   // grigio
];

// Funzione principale
async function main() {
  // Controlla gli argomenti
  if (process.argv.length < 4) {
    console.error('Utilizzo: node compare-results.js <output_directory> <file1.json> <file2.json> [file3.json] ...');
    process.exit(1);
  }
  
  const outputDir = process.argv[2];
  const inputFiles = process.argv.slice(3);
  
  console.log(`Confronto di ${inputFiles.length} file di risultati`);
  console.log(`Directory di output: ${outputDir}`);
  
  // Crea la directory di output se non esiste
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Carica i dati
  const datasets = [];
  for (const file of inputFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      // Estrai lo scenario dal nome del file
      const scenarioName = path.basename(file, '.json').replace('performance_', '').split('_')[0];
      datasets.push({
        name: scenarioName,
        file: file,
        data: data
      });
      console.log(`Caricato: ${file} (Scenario: ${scenarioName})`);
    } catch (error) {
      console.error(`Errore nel caricamento del file ${file}:`, error);
    }
  }
  
  if (datasets.length < 2) {
    console.error('Sono necessari almeno due set di dati validi per il confronto');
    process.exit(1);
  }
  
  // Genera report comparativo
  await generateComparisonReport(datasets, outputDir);
}

// Funzione per generare il report comparativo
async function generateComparisonReport(datasets, outputDir) {
  // Genera grafici comparativi
  await generateResponseTimeChart(datasets, outputDir);
  await generateThroughputChart(datasets, outputDir);
  await generateErrorRateChart(datasets, outputDir);
  await generateComparativeMetrics(datasets, outputDir);
  
  // Genera report HTML
  generateHtmlReport(datasets, outputDir);
  
  console.log(`Report comparativo generato in: ${outputDir}`);
}

// Funzione per generare un grafico
async function generateChart(config) {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');
  
  const chart = new Chart(ctx, {
    type: config.type || 'bar',
    data: {
      labels: config.labels,
      datasets: config.datasets
    },
    options: {
      scales: {
        y: {
          beginAtZero: config.beginAtZero !== undefined ? config.beginAtZero : true,
          title: {
            display: true,
            text: config.yAxisTitle || ''
          }
        },
        x: {
          title: {
            display: true,
            text: config.xAxisTitle || ''
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: config.title
        },
        legend: {
          display: true,
          position: 'top'
        }
      }
    }
  });
  
  // Salva il grafico come immagine
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(config.outputDir, `${config.filename}.png`), buffer);
  
  // Pulisci le risorse
  chart.destroy();
  
  return `${config.filename}.png`;
}

// Genera grafico dei tempi di risposta
async function generateResponseTimeChart(datasets, outputDir) {
  const labels = ['Media', 'Mediana', 'P90', 'P95', 'P99', 'Min', 'Max'];
  const chartDatasets = datasets.map((dataset, index) => {
    const metrics = dataset.data.metrics ? dataset.data.metrics.http_req_duration : dataset.data;
    
    return {
      label: dataset.name,
      data: [
        metrics.avg,
        metrics.med,
        metrics['p(90)'],
        metrics['p(95)'],
        metrics['p(99)'],
        metrics.min,
        metrics.max
      ],
      backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
      borderColor: CHART_COLORS[index % CHART_COLORS.length],
      borderWidth: 1
    };
  });
  
  return await generateChart({
    title: 'Confronto Tempi di Risposta (ms)',
    filename: 'response_time_comparison',
    outputDir: outputDir,
    type: 'bar',
    labels: labels,
    datasets: chartDatasets,
    yAxisTitle: 'Millisecondi',
    xAxisTitle: 'Metriche'
  });
}

// Genera grafico del throughput
async function generateThroughputChart(datasets, outputDir) {
  const labels = datasets.map(d => d.name);
  const rpsValues = datasets.map(d => {
    const metrics = d.data.metrics ? d.data.metrics.http_reqs : d.data;
    return metrics.rate;
  });
  
  return await generateChart({
    title: 'Confronto Richieste al Secondo',
    filename: 'throughput_comparison',
    outputDir: outputDir,
    type: 'bar',
    labels: labels,
    datasets: [{
      label: 'Richieste/secondo',
      data: rpsValues,
      backgroundColor: 'rgb(75, 192, 192)',
      borderColor: 'rgb(75, 192, 192)',
      borderWidth: 1
    }],
    yAxisTitle: 'Richieste/secondo',
    xAxisTitle: 'Scenari'
  });
}

// Genera grafico del tasso di errore
async function generateErrorRateChart(datasets, outputDir) {
  const labels = datasets.map(d => d.name);
  const errorRates = datasets.map(d => {
    if (d.data.metrics && d.data.metrics.http_req_failed) {
      return d.data.metrics.http_req_failed.rate * 100; // Percentuale
    } else if (d.data.error_rate) {
      return d.data.error_rate * 100;
    } else {
      return 0;
    }
  });
  
  return await generateChart({
    title: 'Confronto Tasso di Errore (%)',
    filename: 'error_rate_comparison',
    outputDir: outputDir,
    type: 'bar',
    labels: labels,
    datasets: [{
      label: 'Tasso di Errore (%)',
      data: errorRates,
      backgroundColor: 'rgb(255, 99, 132)',
      borderColor: 'rgb(255, 99, 132)',
      borderWidth: 1
    }],
    yAxisTitle: 'Tasso di Errore (%)',
    xAxisTitle: 'Scenari'
  });
}

// Genera metriche comparative
async function generateComparativeMetrics(datasets, outputDir) {
  // Estrai le metriche per endpoint se disponibili
  const endpointMetrics = {};
  
  datasets.forEach(dataset => {
    if (dataset.data.metrics) {
      Object.keys(dataset.data.metrics).forEach(metricName => {
        if (metricName.startsWith('endpoint_')) {
          const endpoint = metricName.replace('endpoint_', '');
          if (!endpointMetrics[endpoint]) {
            endpointMetrics[endpoint] = {
              labels: [],
              avgValues: [],
              p95Values: []
            };
          }
          
          endpointMetrics[endpoint].labels.push(dataset.name);
          endpointMetrics[endpoint].avgValues.push(dataset.data.metrics[metricName].avg);
          endpointMetrics[endpoint].p95Values.push(dataset.data.metrics[metricName]['p(95)']);
        }
      });
    }
  });
  
  // Genera grafici per endpoint
  const endpointCharts = [];
  for (const [endpoint, metrics] of Object.entries(endpointMetrics)) {
    const chartFile = await generateChart({
      title: `Confronto Tempi di Risposta - ${endpoint}`,
      filename: `endpoint_${endpoint}_comparison`,
      outputDir: outputDir,
      type: 'bar',
      labels: metrics.labels,
      datasets: [
        {
          label: 'Tempo Medio (ms)',
          data: metrics.avgValues,
          backgroundColor: 'rgb(54, 162, 235)',
          borderColor: 'rgb(54, 162, 235)',
          borderWidth: 1
        },
        {
          label: 'P95 (ms)',
          data: metrics.p95Values,
          backgroundColor: 'rgb(255, 159, 64)',
          borderColor: 'rgb(255, 159, 64)',
          borderWidth: 1
        }
      ],
      yAxisTitle: 'Millisecondi',
      xAxisTitle: 'Scenari'
    });
    endpointCharts.push({ endpoint, chart: chartFile });
  }
  
  return endpointCharts;
}

// Genera report HTML
function generateHtmlReport(datasets, outputDir) {
  const reportFile = path.join(outputDir, 'comparative_report.html');
  
  // Tabella di confronto
  let comparisonTable = `
    <table class="table table-striped">
      <thead>
        <tr>
          <th>Metrica</th>
          ${datasets.map(d => `<th>${d.name}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;
  
  // Aggiungi righe per le metriche principali
  const metrics = [
    { name: 'Tempo di risposta medio (ms)', key: 'avg' },
    { name: 'Tempo di risposta P95 (ms)', key: 'p(95)' },
    { name: 'Richieste al secondo', key: 'rate' },
    { name: 'Tasso di errore (%)', key: 'error_rate', multiply: 100 },
    { name: 'Totale richieste', key: 'count' }
  ];
  
  metrics.forEach(metric => {
    comparisonTable += `
      <tr>
        <td>${metric.name}</td>
        ${datasets.map(d => {
          let value;
          if (d.data.metrics && d.data.metrics.http_req_duration && metric.key in d.data.metrics.http_req_duration) {
            value = d.data.metrics.http_req_duration[metric.key];
          } else if (d.data.metrics && d.data.metrics.http_reqs && metric.key in d.data.metrics.http_reqs) {
            value = d.data.metrics.http_reqs[metric.key];
          } else if (d.data.metrics && d.data.metrics.http_req_failed && metric.key === 'error_rate') {
            value = d.data.metrics.http_req_failed.rate * (metric.multiply || 1);
          } else if (metric.key in d.data) {
            value = d.data[metric.key] * (metric.multiply || 1);
          } else {
            value = 'N/A';
          }
          
          return `<td>${typeof value === 'number' ? value.toFixed(2) : value}</td>`;
        }).join('')}
      </tr>
    `;
  });
  
  comparisonTable += '</tbody></table>';
  
  // Crea il contenuto HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Report Comparativo dei Test di Performance</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body { padding: 20px; }
        .chart-container { margin-bottom: 40px; }
        .comparison-table { margin-bottom: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="my-4">Report Comparativo dei Test di Performance</h1>
        <p>Confronto tra ${datasets.length} scenari di test: ${datasets.map(d => d.name).join(', ')}</p>
        
        <div class="comparison-table">
          <h2>Tabella Comparativa</h2>
          ${comparisonTable}
        </div>
        
        <div class="chart-container">
          <h2>Tempi di Risposta</h2>
          <img src="response_time_comparison.png" class="img-fluid" alt="Confronto tempi di risposta">
        </div>
        
        <div class="chart-container">
          <h2>Throughput</h2>
          <img src="throughput_comparison.png" class="img-fluid" alt="Confronto throughput">
        </div>
        
        <div class="chart-container">
          <h2>Tasso di Errore</h2>
          <img src="error_rate_comparison.png" class="img-fluid" alt="Confronto tasso di errore">
        </div>
        
        <div class="endpoint-charts">
          <h2>Metriche per Endpoint</h2>
          <p>I seguenti grafici mostrano un confronto delle prestazioni per ciascun endpoint tra i diversi scenari.</p>
          <div id="endpoint-charts-container">
            <!-- Gli endpoint charts saranno aggiunti dinamicamente dopo la generazione -->
          </div>
        </div>
        
        <div class="conclusion mt-5">
          <h2>Conclusioni</h2>
          <p>
            Questo report comparativo mostra le differenze di performance tra i vari scenari di test.
            I dati possono essere utilizzati per identificare quale configurazione offre le migliori prestazioni
            e dove potrebbero esserci potenziali colli di bottiglia.
          </p>
        </div>
        
        <footer class="mt-5 pt-3 border-top text-muted">
          <p>Report generato il: ${new Date().toLocaleString()}</p>
        </footer>
      </div>
      
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    </body>
    </html>
  `;
  
  fs.writeFileSync(reportFile, htmlContent);
  console.log(`Report HTML generato: ${reportFile}`);
}

// Esegui lo script
main().catch(error => {
  console.error('Errore nell\'esecuzione dello script:', error);
  process.exit(1);
}); 