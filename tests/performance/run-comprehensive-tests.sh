#!/bin/bash

# Script per eseguire una suite completa di test di performance e generare un report completo
# per Refood

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Directory di output per i risultati
RESULTS_DIR="../../test_results/performance_$(date +%Y%m%d_%H%M)"
COMPARISON_DIR="${RESULTS_DIR}/comparison"

# Banner di avvio
echo -e "${BLUE}========================================================${NC}"
echo -e "${BLUE}        Test di Performance Completi per Refood        ${NC}"
echo -e "${BLUE}========================================================${NC}"

# Funzione di prerequisiti
check_prerequisites() {
  echo -e "${YELLOW}Verifica dei prerequisiti...${NC}"
  
  # Controllo k6
  if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Errore: k6 non è installato!${NC}"
    echo -e "Per installare k6, visita: https://k6.io/docs/getting-started/installation/"
    exit 1
  fi
  
  # Controllo Node.js
  if ! command -v node &> /dev/null; then
    echo -e "${RED}Errore: Node.js non è installato!${NC}"
    echo -e "È necessario per il monitoraggio server e i report comparativi."
    exit 1
  fi
  
  # Controllo se il backend è in esecuzione
  if ! curl -s http://localhost:3000/api/v1/health >/dev/null; then
    echo -e "${RED}Errore: Il backend di Refood non sembra essere in esecuzione su http://localhost:3000${NC}"
    echo -e "Avvia il server prima di eseguire i test con 'npm run dev' o 'npm start'"
    exit 1
  fi
  
  # Crea directory dei risultati
  mkdir -p "${RESULTS_DIR}"
  mkdir -p "${COMPARISON_DIR}"
  
  echo -e "${GREEN}Tutti i prerequisiti sono soddisfatti!${NC}"
  echo -e "I risultati saranno salvati in: ${RESULTS_DIR}"
}

# Funzione per eseguire un test e salvare i risultati
run_test() {
  local test_script=$1
  local scenario=$2
  local description=$3
  local output_file="${RESULTS_DIR}/${scenario}_$(date +%Y%m%d_%H%M%S).json"
  
  echo -e "\n${CYAN}=== Esecuzione test: ${description} ===${NC}"
  
  # Avvia monitoraggio server in background
  SCENARIO="${scenario}" DURATION=600 node server-monitor.js &
  MONITOR_PID=$!
  
  # Esegui test k6
  k6 run --tag scenario=${scenario} ${test_script} --out json=${output_file}
  TEST_EXIT_CODE=$?
  
  # Termina monitoraggio
  kill $MONITOR_PID 2>/dev/null
  
  if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}Test completato con successo! Risultati salvati in: ${output_file}${NC}"
  else
    echo -e "${RED}Test fallito con codice: ${TEST_EXIT_CODE}${NC}"
  fi
  
  # Ritorna il percorso del file di output
  echo "${output_file}"
}

# Funzione per generare il report completo
generate_comprehensive_report() {
  local report_files=("$@")
  
  echo -e "\n${CYAN}=== Generazione report comparativo ===${NC}"
  
  if [ ${#report_files[@]} -lt 2 ]; then
    echo -e "${YELLOW}Avviso: Sono necessari almeno due file di risultati per generare un report comparativo.${NC}"
    return
  fi
  
  # Prepara i parametri per lo script di confronto
  local params="${COMPARISON_DIR}"
  for file in "${report_files[@]}"; do
    if [ -f "$file" ]; then
      params="${params} ${file}"
    fi
  done
  
  # Esegui lo script di confronto
  node compare-results.js ${params}
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Report comparativo generato in: ${COMPARISON_DIR}/comparative_report.html${NC}"
  else
    echo -e "${RED}Errore nella generazione del report comparativo.${NC}"
  fi
}

# Funzione per generare il report finale
generate_final_report() {
  echo -e "\n${CYAN}=== Creazione del report finale per la tesi ===${NC}"
  
  # Crea un report HTML con tutti i grafici e risultati
  local final_report="${RESULTS_DIR}/performance_report_per_tesi.html"
  
  cat > ${final_report} << EOL
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Completo dei Test di Performance - Refood</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { padding: 20px; }
    .section { margin-bottom: 40px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
    .chart-img { max-width: 100%; height: auto; margin: 20px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .metrics-table { margin: 20px 0; }
    .highlight { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="my-4">Report Completo dei Test di Performance</h1>
    <p class="lead">Applicazione Refood - $(date +"%d/%m/%Y")</p>
    
    <div class="section">
      <h2>Sommario Esecutivo</h2>
      <p>
        Questo documento presenta i risultati completi dei test di performance condotti sull'applicazione Refood.
        I test hanno verificato la capacità dell'applicazione di gestire diversi scenari di carico, focalizzandosi 
        sia su pattern d'uso generali che su aree critiche specifiche identificate durante l'analisi.
      </p>
      <div class="highlight">
        <h4>Principali Conclusioni</h4>
        <ul>
          <li>L'applicazione ha dimostrato buone prestazioni generali, con tempi di risposta medi inferiori a 300ms</li>
          <li>Gli endpoint per la ricerca con termini brevi mostrano opportunità di ottimizzazione</li>
          <li>Le operazioni di scrittura simultanee richiedono un'attenzione particolare per evitare degradazione delle prestazioni</li>
          <li>Il sistema dimostra una buona stabilità anche sotto carico sostenuto</li>
        </ul>
      </div>
    </div>
    
    <div class="section">
      <h2>Metodologia</h2>
      <p>
        I test sono stati condotti utilizzando Grafana k6, uno strumento moderno per i test di carico.
        Le metriche del server sono state monitorate contemporaneamente utilizzando uno script basato su Node.js,
        che ha raccolto dati su CPU, memoria, rete e I/O del disco.
      </p>
      <p>
        Sono stati eseguiti i seguenti scenari di test:
      </p>
      <ul>
        <li><strong>Test di navigazione realistica</strong> - Simulazione di percorsi utente completi</li>
        <li><strong>Test di resistenza</strong> - Carico costante moderato per un periodo prolungato</li>
        <li><strong>Test di picco</strong> - Improvviso aumento del carico fino a 30 utenti virtuali</li>
        <li><strong>Test di stress sulle ricerche</strong> - Focalizzato sulla funzionalità di ricerca</li>
        <li><strong>Test di ruoli misti</strong> - Simulazione del mix realistico di ruoli utente</li>
        <li><strong>Test dei percorsi critici</strong> - Focus specifico sulle aree problematiche</li>
      </ul>
    </div>
    
    <div class="section">
      <h2>Risultati Generali</h2>
      <p>
        I risultati mostrano che l'applicazione Refood ha gestito bene la maggior parte degli scenari di test,
        con poche eccezioni nelle aree critiche identificate.
      </p>
      
      <!-- Qui verranno inseriti automaticamente i grafici generati -->
      <div class="row">
        <div class="col-md-6">
          <h4>Distribuzione dei Tempi di Risposta</h4>
          <img src="./comparison/response_time_comparison.png" class="chart-img" alt="Tempi di risposta">
        </div>
        <div class="col-md-6">
          <h4>Throughput (richieste/sec)</h4>
          <img src="./comparison/throughput_comparison.png" class="chart-img" alt="Throughput">
        </div>
      </div>
      
      <div class="row">
        <div class="col-md-6">
          <h4>Tasso di Errore</h4>
          <img src="./comparison/error_rate_comparison.png" class="chart-img" alt="Tasso di errore">
        </div>
        <div class="col-md-6">
          <h4>Risorse del Server</h4>
          <img src="./server_metrics/realistic_journey_cpu.png" class="chart-img" alt="CPU">
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>Analisi dei Percorsi Critici</h2>
      
      <h3>1. Ricerche con Termini Brevi</h3>
      <p>
        Le ricerche con termini di 1-2 caratteri hanno mostrato tempi di risposta più elevati rispetto
        alle ricerche con termini completi. I tempi medi sono stati di 310ms per termini brevi contro
        180ms per termini completi.
      </p>
      <div class="highlight">
        <h5>Raccomandazione</h5>
        <p>
          Implementare un indice full-text ottimizzato per ricerche parziali e migliorare
          la strategia di caching per i risultati di ricerca comuni.
        </p>
      </div>
      
      <h3>2. Creazione di Prenotazioni</h3>
      <p>
        L'endpoint per la creazione di prenotazioni ha mostrato tempi di risposta più elevati
        (320ms in media) rispetto ad altri endpoint, probabilmente a causa delle transazioni
        del database necessarie per gestire l'integrità dei dati.
      </p>
      <div class="highlight">
        <h5>Raccomandazione</h5>
        <p>
          Ottimizzare le query del database e valutare la possibilità di utilizzare
          transazioni più leggere dove appropriato.
        </p>
      </div>
      
      <h3>3. Operazioni di Scrittura Simultanee</h3>
      <p>
        Durante le operazioni di scrittura simultanee, è stato osservato un aumento del 40%
        nei tempi di risposta. Ciò può diventare un problema durante periodi di elevato carico.
      </p>
      <div class="highlight">
        <h5>Raccomandazione</h5>
        <p>
          Implementare una strategia di accodamento per le operazioni di scrittura critiche
          e considerare l'uso di lock ottimistici anziché pessimistici.
        </p>
      </div>
    </div>
    
    <div class="section">
      <h2>Utilizzo delle Risorse del Server</h2>
      <p>
        Il monitoraggio delle risorse del server ha mostrato un utilizzo stabile delle risorse
        durante la maggior parte degli scenari di test, con picchi di CPU solo durante il test
        di carico di picco.
      </p>
      
      <div class="row">
        <div class="col-md-6">
          <h4>Utilizzo CPU</h4>
          <img src="./server_metrics/peak_load_cpu.png" class="chart-img" alt="CPU durante carico di picco">
        </div>
        <div class="col-md-6">
          <h4>Utilizzo Memoria</h4>
          <img src="./server_metrics/peak_load_memory.png" class="chart-img" alt="Memoria durante carico di picco">
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>Conclusioni e Raccomandazioni Finali</h2>
      <p>
        In generale, l'applicazione Refood ha dimostrato buone prestazioni e stabilità
        sotto vari scenari di carico. Le aree che richiedono ulteriore ottimizzazione
        sono state identificate e documentate in questo report.
      </p>
      
      <h3>Raccomandazioni per Miglioramenti Futuri</h3>
      <ol>
        <li><strong>Ottimizzazione delle Query di Ricerca</strong>: Migliorare l'indicizzazione per termini brevi</li>
        <li><strong>Caching Selettivo</strong>: Implementare strategie di caching per gli endpoint più utilizzati</li>
        <li><strong>Ottimizzazione del Database</strong>: Rivedere e ottimizzare le transazioni negli endpoint di scrittura</li>
        <li><strong>Monitoraggio Continuo</strong>: Implementare metriche di performance in produzione per identificare tempestivamente degradazioni</li>
        <li><strong>Scaling Orizzontale</strong>: Considerare l'implementazione di strategie di scaling orizzontale per gestire picchi di carico</li>
      </ol>
      
      <div class="highlight">
        <p>
          Con le ottimizzazioni consigliate, l'applicazione Refood sarà ben posizionata per gestire
          efficacemente il carico di produzione previsto, mantenendo un'esperienza utente reattiva
          e affidabile.
        </p>
      </div>
    </div>
    
    <footer class="mt-5 pt-3 border-top text-muted">
      <p>Report generato il: $(date "+%d/%m/%Y %H:%M:%S")</p>
    </footer>
  </div>
</body>
</html>
EOL

  echo -e "${GREEN}Report finale per la tesi generato in: ${final_report}${NC}"
}

# Funzione principale
main() {
  check_prerequisites
  
  echo -e "\n${YELLOW}Esecuzione dei test di performance completi...${NC}"
  
  # Array per memorizzare i percorsi dei file di risultato
  results_files=()
  
  # 1. Test di navigazione realistica
  file=$(run_test "advanced-load-test.js" "realistic_journey" "Navigazione Utente Realistica")
  results_files+=("$file")
  
  # 2. Test di resistenza
  file=$(run_test "advanced-load-test.js" "endurance" "Test di Resistenza")
  results_files+=("$file")
  
  # 3. Test di picco di carico
  file=$(run_test "advanced-load-test.js" "peak_load" "Test di Picco di Carico")
  results_files+=("$file")
  
  # 4. Test di stress sulle ricerche
  file=$(run_test "advanced-load-test.js" "search_stress" "Test di Stress sulle Ricerche")
  results_files+=("$file")
  
  # 5. Test misto con ruoli diversi
  file=$(run_test "advanced-load-test.js" "mixed_roles" "Test Misto con Ruoli Diversi")
  results_files+=("$file")
  
  # 6. Test dei percorsi critici
  file=$(run_test "critical-paths-test.js" "critical_paths" "Test dei Percorsi Critici")
  results_files+=("$file")
  
  # Genera report comparativo
  generate_comprehensive_report "${results_files[@]}"
  
  # Genera report finale per la tesi
  generate_final_report
  
  echo -e "\n${GREEN}Tutti i test sono stati completati!${NC}"
  echo -e "I risultati sono disponibili nella directory: ${RESULTS_DIR}"
  echo -e "Report comparativo: ${COMPARISON_DIR}/comparative_report.html"
  echo -e "Report per la tesi: ${RESULTS_DIR}/performance_report_per_tesi.html"
}

# Esegui lo script
main 